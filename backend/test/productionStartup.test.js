import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

// Use the actual Node entry point, without Vitest mocks or the real database.
// This catches module/route initialization failures hidden by controller tests.
it('arranca el servidor de producción, sirve el health check y rechaza una API sin sesión', async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port),
      // Dedicated unreachable address: never mutate a development or Railway DB.
      DATABASE_URL: 'postgresql://smoke:smoke@127.0.0.1:1/smoke?connect_timeout=1',
      JWT_SECRET: 'isolated-production-startup-test', REQUEST_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
      EMBEDDINGS_ENABLED: 'false', REQUEST_SCHEDULER_INTERVAL_MS: '3600000',
      SMTP_HOST: '', BREVO_API_KEY: '', GEMINI_API_KEY: '',
    }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`El servidor no arrancó: ${output}`)), 45000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Salida ${code}: ${output}`)); });
      const read = (chunk) => {
        output = (output + chunk.toString()).slice(-16000);
        if (output.includes('Qualitrack API escuchando')) { clearTimeout(timer); resolve(); }
      };
      child.stdout.on('data', read);
      child.stderr.on('data', read);
    });
    const base = `http://127.0.0.1:${port}/api`;
    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
    const audit = await fetch(`${base}/security-events`);
    expect(audit.status).toBe(401);
    expect(await audit.json()).toMatchObject({ error: 'No autenticado.' });
  } finally {
    if (child.exitCode === null) {
      const closed = once(child, 'exit');
      child.kill();
      await closed;
    }
  }
}, 60000);
