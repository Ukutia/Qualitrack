import { dispatcherParaTailnet } from './tailnet.service.js';
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

function providerError(message, { status, code = 'AI_PROVIDER_ERROR', cause } = {}) {
  const error = new Error(message);
  error.code = code;
  if (status) error.status = status;
  if (cause) error.cause = cause;
  return error;
}

export const ollamaModel = () => process.env.OLLAMA_MODEL || 'qwen3:8b';

async function requestOllama({ model, system, prompt, maxOutputTokens, json }) {
  const baseUrl = process.env.OLLAMA_URL || 'http://ollama:11434';
  const body = {
    model,
    stream: false,
    keep_alive: '30m',
    // qwen3 razona antes de responder y eso gasta tiempo y tokens: se desactiva.
    ...(/^qwen3/i.test(model) ? { think: false } : {}),
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
    options: {
      temperature: 0,
      num_ctx: Number(process.env.OLLAMA_NUM_CTX) || 8192,
      num_predict: maxOutputTokens || Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS,
    },
    ...(json ? { format: 'json' } : {}),
  };

  let response;
  try {
    const dispatcher = dispatcherParaTailnet(baseUrl);
    response = await fetch(`${baseUrl}/api/chat`, {
      ...(dispatcher ? { dispatcher } : {}),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS) || 300_000),
    });
  } catch (cause) {
    const err = providerError('No se pudo contactar al modelo local (¿Ollama está en marcha?).', {
      status: 503,
      code: 'AI_UNAVAILABLE',
      cause,
    });
    // Timeout: otro modelo puede ayudar. Conexión rechazada: Ollama está caído.
    err.unreachable = cause?.name !== 'TimeoutError';
    throw err;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw providerError(`El modelo "${model}" no está descargado. Ejecute: ollama pull ${model}`, {
        status: 503,
        code: 'AI_NOT_CONFIGURED',
      });
    }
    throw providerError(payload?.error || 'El modelo local no pudo generar la respuesta.', {
      status: response.status,
    });
  }

  // Quita restos de razonamiento (<think>...</think>) si la versión de Ollama los deja en el texto.
  const text = String(payload?.message?.content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim();

  if (!text) throw providerError('La respuesta del modelo local vino vacía.');
  if (payload?.done_reason === 'length') {
    console.warn(`[ollama] Respuesta cortada por límite de tokens (modelo ${model}).`);
  }
  return text;
}

export async function generateWithOllama(args) {
  const models = [...new Set([ollamaModel(), process.env.OLLAMA_FALLBACK_MODEL].filter(Boolean))];
  let lastError;

  for (const model of models) {
    try {
      return await requestOllama({ ...args, model });
    } catch (err) {
      lastError = err;
      if (err.unreachable) throw err;
      console.warn(`[ollama] Falló ${model}: ${String(err.message).slice(0, 300)}`);
    }
  }
  throw lastError;
}