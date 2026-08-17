export function chunkText(text, chunkSize = 2000, overlap = 250) {
  if (!text || !text.trim()) return [];

  const cleaned = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);

    chunks.push(cleaned.slice(start, end));

    if (end === cleaned.length) break;

    start = end - overlap;
  }

  return chunks;
}