import { describe, it, expect } from 'vitest';
import { generateWithGemini } from '../src/services/gemini.service.js';

describe('Gemini API smoke test', () => {
  const apiKey = process.env.GEMINI_API_KEY;

  it.skipIf(!apiKey)('realiza una llamada real cuando GEMINI_API_KEY está configurada', async () => {
    const text = await generateWithGemini({
      system: 'Responde únicamente en español y en una oración.',
      prompt: 'Escribe una oración breve sobre la importancia de revisar fuentes.',
    });

    expect(text).toBeTruthy();
    expect(text).toMatch(/[\p{L}\p{N}]/u);
  }, 30000);
});