import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSemanticSearch, useTopics, useCreateTopic, } from '../hooks/useApi.js';

export default function SemanticSearch() {
  const search = useSemanticSearch();
  const topics = useTopics();
  const createTopic = useCreateTopic();
  const [topicName, setTopicName] = useState('');

  async function handleTopicSearch(topicName) {
    const value = topicName.trim();

    if (!value || search.isPending) return;

    await search.mutateAsync({
      query: value,
      limit: 10,
    });
  }

  const groupedResults = useMemo(() => {
    const results = search.data?.results || [];
    const grouped = {};

    for (const result of results) {
      if (!grouped[result.documentId]) {
        grouped[result.documentId] = {
          documentId: result.documentId,
          originalName: result.originalName,
          bestSimilarity: result.similarity,
          subcriterionCode: result.subcriterionCode,
          subcriterionName: result.subcriterionName,
          fragments: [],
        };
      }

      grouped[result.documentId].bestSimilarity = Math.max(
        grouped[result.documentId].bestSimilarity,
        result.similarity
      );

      grouped[result.documentId].fragments.push({
        chunkIndex: result.chunkIndex,
        content: result.content,
        similarity: result.similarity,
      });
    }

    return Object.values(grouped).sort(
      (a, b) => b.bestSimilarity - a.bestSimilarity
    );
  }, [search.data]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900">
          Búsqueda temática
        </h1>

        <p className="mt-1 text-stone-500">
          Busca una temática libre dentro del contenido de todas las evidencias
          del repositorio, independiente de su clasificación.
        </p>
      </header>

      <form
        onSubmit={async (event) => {
          event.preventDefault();

          const value = topicName.trim();

          if (value.length < 3) return;

          await createTopic.mutateAsync(value);
          setTopicName('');
        }}
        className="rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-stone-200/60"
      >
        <label
          htmlFor="topic-name"
          className="mb-2 block text-sm font-medium text-ink-900"
        >
          Nueva temática
        </label>

        <div className="flex gap-3">
          <input
            id="topic-name"
            type="text"
            value={topicName}
            onChange={(event) => setTopicName(event.target.value)}
            placeholder="Ej: Calidad docente"
            className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />

          <button
            type="submit"
            disabled={topicName.trim().length < 3 || createTopic.isPending}
            className="btn rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white shadow-soft hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createTopic.isPending ? 'Guardando…' : 'Guardar temática'}
          </button>
        </div>

        {topicName.trim().length > 0 && topicName.trim().length < 3 && (
          <p className="mt-2 text-xs text-rose-600">
            La temática debe tener al menos 3 caracteres.
          </p>
        )}

        {createTopic.isError && (
          <p className="mt-2 text-xs text-rose-600">
            {createTopic.error?.response?.data?.error ||
              'No fue posible guardar la temática.'}
          </p>
        )}
      </form>

      <section className="rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-stone-200/60">
        <div className="mb-4">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Temáticas guardadas
          </h2>

          <p className="mt-1 text-sm text-stone-500">
            Selecciona una temática para buscar evidencia relacionada.
          </p>
        </div>

        {topics.isLoading ? (
          <p className="text-sm text-stone-500">
            Cargando temáticas…
          </p>
        ) : topics.isError ? (
          <p className="text-sm text-rose-600">
            No fue posible cargar las temáticas.
          </p>
        ) : (topics.data?.topics || []).length === 0 ? (
          <p className="text-sm text-stone-500">
            Aún no hay temáticas guardadas.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topics.data.topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => handleTopicSearch(topic.name)}
                disabled={search.isPending}
                className="rounded-full bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100 disabled:cursor-wait disabled:opacity-60"
              >
                {topic.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {search.isPending && (
        <div className="rounded-xl2 bg-white p-5 text-sm text-stone-500 shadow-soft ring-1 ring-stone-200/60">
          Buscando evidencia relacionada…
        </div>
      )}

      {search.isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          No fue posible realizar la búsqueda.
        </div>
      )}

      {search.data && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">
                Evidencia relacionada
              </h2>

              <p className="mt-1 text-sm text-stone-500">
                {groupedResults.length}{' '}
                {groupedResults.length === 1
                  ? 'documento encontrado'
                  : 'documentos encontrados'}
              </p>
            </div>

            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
              “{search.data.query}”
            </span>
          </div>

          {groupedResults.length === 0 ? (
            <div className="rounded-xl2 bg-white px-6 py-12 text-center shadow-soft ring-1 ring-stone-200/60">
              <h3 className="font-medium text-ink-900">
                No se encontraron resultados
              </h3>

              <p className="mt-1 text-sm text-stone-500">
                Intenta describir la temática utilizando otros términos.
              </p>
            </div>
          ) : (
            groupedResults.map((document) => (
              <article
                key={document.documentId}
                className="rounded-xl2 bg-white p-5 shadow-soft ring-1 ring-stone-200/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/documents/${document.documentId}`}
                      className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      {document.originalName}
                    </Link>

                    {document.subcriterionCode && (
                      <p className="mt-1 text-sm text-stone-500">
                        Subcriterio {document.subcriterionCode}
                        {document.subcriterionName
                          ? ` — ${document.subcriterionName}`
                          : ''}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-stone-400">
                      {document.fragments.length}{' '}
                      {document.fragments.length === 1
                        ? 'fragmento relacionado'
                        : 'fragmentos relacionados'}
                    </p>
                  </div>

                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                    Similitud {document.bestSimilarity.toFixed(3)}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {document.fragments.slice(0, 3).map((fragment) => (
                    <div
                      key={`${document.documentId}-${fragment.chunkIndex}`}
                      className="rounded-lg border border-stone-100 bg-stone-50/70 p-4"
                    >
                      <p className="text-sm leading-6 text-stone-700">
                        {fragment.content.length > 450
                          ? `${fragment.content.slice(0, 450)}…`
                          : fragment.content}
                      </p>

                      <p className="mt-2 text-xs text-stone-400">
                        Fragmento {fragment.chunkIndex + 1} · similitud{' '}
                        {fragment.similarity.toFixed(3)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Link
                    to={`/documents/${document.documentId}`}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Ver evidencia →
                  </Link>
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}