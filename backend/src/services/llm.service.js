import { generateWithGemini } from './gemini.service.js';
import { generateWithOllama, ollamaModel } from './ollama.service.js';

// Se lee en cada llamada para no depender del orden en que se carga el .env.
// Por defecto es local: si la variable falta, ningún texto sale a la nube.
const provider = () => (process.env.LLM_PROVIDER || 'ollama').toLowerCase();

export const generateText = (args) =>
  provider() === 'gemini' ? generateWithGemini(args) : generateWithOllama(args);

export const llmLabel = () => (provider() === 'gemini' ? 'gemini' : `ollama:${ollamaModel()}`);