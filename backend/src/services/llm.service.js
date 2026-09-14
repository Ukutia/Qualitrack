// Cliente del LLM local (Ollama) para generación con salida estructurada.
//
// Se comunica con un servidor Ollama a través de LLM_SERVICE_URL. La salida se
// restringe con JSON Schema vía el parámetro `format`, que es el equivalente
// directo del `responseSchema` de Gemini: el modelo no puede emitir tokens que
// violen el esquema, así que el JSON siempre parsea.

const LLM_SERVICE_URL =
  process.env.LLM_SERVICE_URL || "http://localhost:11434";

const LLM_MODEL = process.env.LLM_MODEL || "qwen3.5:9b";

// La carga inicial del modelo a VRAM puede tardar decenas de segundos si los
// pesos viven en un disco mecánico. Después de eso cada respuesta son ~2-3s.
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 120000);

/**
 * Genera una respuesta JSON que cumple el esquema entregado.
 *
 * @param {object}  params
 * @param {string}  params.system  Instrucciones de sistema.
 * @param {string}  params.user    Contenido a analizar.
 * @param {object}  params.schema  JSON Schema que restringe la salida.
 * @returns {Promise<object>} El JSON ya parseado.
 */
export async function generateStructured({ system, user, schema }) {
  const response = await fetch(`${LLM_SERVICE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Permite poner un reverse proxy con autenticación delante de Ollama,
      // que por sí solo no tiene ningún control de acceso.
      ...(process.env.LLM_AUTH_TOKEN
        ? { Authorization: `Bearer ${process.env.LLM_AUTH_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      stream: false,
      // Desactiva el modo de razonamiento: para clasificar no aporta y
      // multiplica la latencia.
      think: false,
      format: schema,
      options: {
        temperature: 0,
      },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Error del servicio LLM (${response.status}): ${error}`
    );
  }

  const result = await response.json();
  const content = result?.message?.content;

  if (!content) {
    throw new Error("El servicio LLM devolvió una respuesta vacía");
  }

  return JSON.parse(content);
}

/**
 * Verifica que el servidor esté arriba y que el modelo esperado esté descargado.
 * Útil para diagnosticar antes de procesar un lote de documentos.
 */
export async function checkLlmAvailable() {
  try {
    const response = await fetch(`${LLM_SERVICE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { available: false, reason: `HTTP ${response.status}` };
    }

    const { models = [] } = await response.json();
    const names = models.map((m) => m.name);

    return {
      available: names.includes(LLM_MODEL),
      model: LLM_MODEL,
      reason: names.includes(LLM_MODEL)
        ? null
        : `El modelo ${LLM_MODEL} no está descargado. Modelos disponibles: ${
            names.join(", ") || "ninguno"
          }`,
    };
  } catch (err) {
    return { available: false, reason: err.message };
  }
}

export { LLM_MODEL, LLM_SERVICE_URL };
