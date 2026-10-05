import { config } from '../config/env.js';

const REQUEST_TIMEOUT_MS = 30_000;
// 150 palabras en español ≈ 250-300 tokens; en modelos con "thinking" los tokens de
// razonamiento también cuentan contra este tope.
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const OVERLOAD_RETRY_DELAYS_MS = [1000, 3000];
// Con la cuota agotada, esperar más que esto dentro de la petición no sirve de nada.
const MAX_QUOTA_WAIT_SECONDS = 5;
// Tras un 429 no se vuelve a llamar a ese modelo hasta que pase el tiempo que indicó Google:
// evita gastar peticiones (y hacer esperar al usuario) mientras la cuota sigue agotada.
const DEFAULT_COOLDOWN_SECONDS = 30;
const cooldownUntil = new Map(); // modelo -> timestamp (ms)

function providerError(message, { status, code = 'AI_PROVIDER_ERROR', cause, retryAfterSeconds } = {}) {
  const error = new Error(message);
  error.code = code;
  if (status) error.status = status;
  if (cause) error.cause = cause;
  if (retryAfterSeconds != null) error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gemini informa cuánto esperar en error.details[].retryDelay ("34s") o en el mensaje. */
function parseRetryDelaySeconds(payload) {
  const details = payload?.error?.details;
  const info = Array.isArray(details)
    ? details.find((d) => String(d?.['@type'] || '').includes('RetryInfo'))
    : null;
  const fromDetails = String(info?.retryDelay ?? '').match(/([\d.]+)s/);
  if (fromDetails) return Math.ceil(Number(fromDetails[1]));
  const fromMessage = String(payload?.error?.message || '').match(/retry in ([\d.]+)s/i);
  return fromMessage ? Math.ceil(Number(fromMessage[1])) : null;
}

const isQuota = (err) => err?.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(err?.message || '');
const isOverload = (err) =>
  [500, 502, 503, 504].includes(err?.status) || /high demand|UNAVAILABLE|overloaded/i.test(err?.message || '');

function primaryModel() {
  return process.env.GEMINI_MODEL || config.gemini?.model || 'gemini-3.8-flash';
}

async function requestGemini({ system, prompt, model, maxOutputTokens, json }) {
  const apiKey = process.env.GEMINI_API_KEY || config.gemini?.apiKey;
  if (!apiKey) {
    throw providerError('La generación de vista previa no está configurada. Falta GEMINI_API_KEY.', {
      code: 'AI_NOT_CONFIGURED',
    });
  }

  // La clave va en cabecera: en la URL puede terminar en logs y mensajes de error.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxOutputTokens || Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw providerError('No se pudo contactar a Gemini (tiempo de espera o red).', { status: 503, cause });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw providerError(payload?.error?.message || 'Gemini no pudo generar la respuesta.', {
      status: response.status,
      retryAfterSeconds: response.status === 429 ? parseRetryDelaySeconds(payload) : undefined,
    });
  }

  const candidate = payload?.candidates?.[0];
  // Con "thinking" la respuesta puede venir en varias partes; se excluyen las de razonamiento.
  const text = (candidate?.content?.parts || [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join('')
    .trim();

  if (!text) {
    throw providerError(
      `La respuesta de Gemini vino vacía (finishReason: ${candidate?.finishReason ?? 'desconocido'}).`
    );
  }
  if (candidate?.finishReason === 'MAX_TOKENS') {
    console.warn(`[gemini] Respuesta cortada por maxOutputTokens (modelo ${model}).`);
  }
  return text;
}

async function requestWithRetry(args) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestGemini(args);
    } catch (err) {
      if (isQuota(err)) {
        // Cuota corta (unos segundos): se espera una vez. Cuota agotada: se abandona ya.
        const wait = err.retryAfterSeconds;
        if (wait != null && wait <= MAX_QUOTA_WAIT_SECONDS && attempt === 0) {
          await sleep(wait * 1000 + 250);
          continue;
        }
        throw err;
      }
      if (isOverload(err) && attempt < OVERLOAD_RETRY_DELAYS_MS.length) {
        await sleep(OVERLOAD_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw err;
    }
  }
}

/**
 * @param {{ system?: string, prompt: string, maxOutputTokens?: number, json?: boolean }} args
 * Errores propios: AI_NOT_CONFIGURED, AI_RATE_LIMITED (cuota; con retryAfterSeconds) y AI_UNAVAILABLE.
 * Si GEMINI_FALLBACK_MODEL está definido, se prueba tras agotar el modelo principal
 * (la cuota es por modelo, así que suele haber margen en otro).
 */
export async function generateWithGemini(args) {
  const models = [...new Set([primaryModel(), process.env.GEMINI_FALLBACK_MODEL].filter(Boolean))];
  console.log(`[gemini] modelos a probar: ${models.join(', ')}`);
  const quotaWaits = [];
  let lastError;

  for (const model of models) {
    const remaining = Math.ceil(((cooldownUntil.get(model) ?? 0) - Date.now()) / 1000);
    if (remaining > 0) {
      quotaWaits.push(remaining); // cuota aún agotada: no se llama a Google
      continue;
    }

    try {
      return await requestWithRetry({ ...args, model });
    } catch (err) {
      if (isQuota(err)) {
        const wait = err.retryAfterSeconds ?? DEFAULT_COOLDOWN_SECONDS;
        cooldownUntil.set(model, Date.now() + wait * 1000);
        quotaWaits.push(wait);
        // El mensaje original de Google indica qué cuota es (por minuto, por día, "limit: 0"…).
        console.warn(`[gemini] Cuota agotada en ${model}; espera ${wait}s. Detalle: ${String(err.message).slice(0, 500)}`);
        lastError = err;
        continue;
      }
      if (isOverload(err)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  if (quotaWaits.length > 0) {
    const wait = Math.min(...quotaWaits);
    throw providerError(`Se alcanzó el límite de uso de la IA. Intente nuevamente en ${wait} segundos.`, {
      status: 429,
      code: 'AI_RATE_LIMITED',
      retryAfterSeconds: wait,
      cause: lastError,
    });
  }
  throw providerError('El servicio de IA está saturado. Intente nuevamente en unos segundos.', {
    status: 503,
    code: 'AI_UNAVAILABLE',
    cause: lastError,
  });
}