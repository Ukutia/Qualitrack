// Proxy autenticado delante de Ollama, para exponerlo por un túnel.
//
//   LLM_AUTH_TOKEN=<token> node scripts/ollama-proxy.js
//   cloudflared tunnel --url http://localhost:11435
//
// Ollama no tiene ningún control de acceso: publicar el 11434 tal cual deja la
// GPU abierta a internet, incluidos /api/delete y /api/pull. Este proxy exige
// un Bearer token y solo deja pasar los endpoints que el backend necesita.
//
// Escucha en 127.0.0.1 a propósito: el único que debe poder alcanzarlo es
// cloudflared, corriendo en esta misma máquina.

import http from 'node:http';

const PORT = Number(process.env.LLM_PROXY_PORT || 11435);
const OLLAMA_HOST = process.env.OLLAMA_UPSTREAM || '127.0.0.1';
const OLLAMA_PORT = Number(process.env.OLLAMA_UPSTREAM_PORT || 11434);
const TOKEN = process.env.LLM_AUTH_TOKEN;

// Solo lo que usa llm.service.js. Todo lo demás se rechaza.
const ALLOWED = [
  { method: 'POST', path: '/api/chat' },
  { method: 'GET', path: '/api/tags' },
  { method: 'GET', path: '/api/version' },
];

if (!TOKEN) {
  console.error('Falta LLM_AUTH_TOKEN. Sin token el proxy no protege nada.');
  console.error('Genera uno con:  node -e "console.log(crypto.randomUUID())"');
  process.exit(1);
}

if (TOKEN.length < 24) {
  console.error('LLM_AUTH_TOKEN es demasiado corto. Usa al menos 24 caracteres.');
  process.exit(1);
}

/** Comparación en tiempo constante para no filtrar el token por timing. */
function tokenMatches(received) {
  if (typeof received !== 'string' || received.length !== TOKEN.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < TOKEN.length; i++) {
    diff |= TOKEN.charCodeAt(i) ^ received.charCodeAt(i);
  }

  return diff === 0;
}

function deny(res, status, message, req) {
  console.warn(
    `[${new Date().toISOString()}] ${status} ${req.method} ${req.url} desde ${
      req.headers['cf-connecting-ip'] || req.socket.remoteAddress
    }`
  );
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

const server = http.createServer((req, res) => {
  const path = (req.url || '').split('?')[0];

  const permitido = ALLOWED.some(
    (rule) => rule.method === req.method && rule.path === path
  );

  if (!permitido) {
    return deny(res, 403, 'Endpoint no permitido.', req);
  }

  const auth = req.headers.authorization || '';
  const recibido = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!tokenMatches(recibido)) {
    return deny(res, 401, 'Token inválido o ausente.', req);
  }

  const started = Date.now();

  const upstream = http.request(
    {
      host: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${OLLAMA_HOST}:${OLLAMA_PORT}` },
    },
    (upstreamRes) => {
      console.log(
        `[${new Date().toISOString()}] ${upstreamRes.statusCode} ${req.method} ${path} ` +
          `(${((Date.now() - started) / 1000).toFixed(1)}s)`
      );
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on('error', (err) => {
    console.error(`Error hablando con Ollama: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `No se pudo contactar a Ollama: ${err.message}` }));
  });

  req.pipe(upstream);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Proxy autenticado en http://127.0.0.1:${PORT}`);
  console.log(`Reenviando a Ollama en http://${OLLAMA_HOST}:${OLLAMA_PORT}`);
  console.log(`Endpoints permitidos: ${ALLOWED.map((r) => `${r.method} ${r.path}`).join(', ')}`);
  console.log('\nPara publicarlo:  cloudflared tunnel --url http://localhost:' + PORT);
});
