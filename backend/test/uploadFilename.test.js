import { describe, expect, it } from 'vitest';
import { normalizeUploadFilename } from '../src/middleware/upload.js';

describe('normalización del nombre de archivos subidos', () => {
  it('recupera tildes UTF-8 interpretadas como Latin-1 por multipart', () => {
    const expected = 'Política de evaluación académica.pdf';
    const mojibake = Buffer.from(expected, 'utf8').toString('latin1');

    expect(mojibake).toBe('PolÃ­tica de evaluaciÃ³n acadÃ©mica.pdf');
    expect(normalizeUploadFilename(mojibake)).toBe(expected);
  });

  it('conserva nombres que ya contienen Unicode correcto', () => {
    expect(normalizeUploadFilename('Política institucional.pdf'))
      .toBe('Política institucional.pdf');
    expect(normalizeUploadFilename('Informe 📚.pdf')).toBe('Informe 📚.pdf');
  });

  it('guarda caracteres equivalentes en su forma Unicode compuesta', () => {
    expect(normalizeUploadFilename('Evaluacio\u0301n.docx')).toBe('Evaluación.docx');
  });
});
