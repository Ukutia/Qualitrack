// pdf.js y su worker son pesados. Se cargan una sola vez y únicamente cuando
// hay un PDF visible en pantalla o el usuario abre su visor.
let pdfjsPromise;

export function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });

  return pdfjsPromise;
}
