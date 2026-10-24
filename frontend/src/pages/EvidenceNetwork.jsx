import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import NetworkCanvas from '../components/NetworkCanvas.jsx';
import './EvidenceNetwork.css';

// Deterministic spring layout: shared documents pull their topics together.
function positionNetwork(data) {
  const nodes = [...data.topics.map((t) => ({ ...t, key: `t${t.id}`, type: 'topic' })),
    ...data.documents.map((d) => ({ ...d, key: `d${d.id}`, type: 'document' }))];
  nodes.forEach((n, i) => {
    const angle = i * 2.399963;
    const radius = 30 + Math.sqrt(i / Math.max(1, nodes.length)) * 220;
    n.x = 420 + Math.cos(angle) * radius; n.y = 300 + Math.sin(angle) * radius;
  });
  const byId = new Map(nodes.map((n) => [n.key, n]));
  const edges = data.connections.map((e) => ({ ...e, source: byId.get(`t${e.topicId}`), target: byId.get(`d${e.documentId}`) }));
  for (let step = 0; step < 180; step++) {
    const forces = new Map(nodes.map((n) => [n.key, { x: (420 - n.x) * .008, y: (300 - n.y) * .008 }]));
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y, dist = Math.max(1, Math.hypot(dx, dy));
      const strength = Math.min(12, 1800 / (dist * dist));
      forces.get(a.key).x += dx / dist * strength; forces.get(a.key).y += dy / dist * strength;
      forces.get(b.key).x -= dx / dist * strength; forces.get(b.key).y -= dy / dist * strength;
    }
    for (const { source: a, target: b } of edges) {
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.max(1, Math.hypot(dx, dy));
      const force = (dist - 110) * .025;
      forces.get(a.key).x += dx / dist * force; forces.get(a.key).y += dy / dist * force;
      forces.get(b.key).x -= dx / dist * force; forces.get(b.key).y -= dy / dist * force;
    }
    nodes.forEach((n) => { n.x += Math.max(-8, Math.min(8, forces.get(n.key).x)); n.y += Math.max(-8, Math.min(8, forces.get(n.key).y)); });
  }
  if (nodes.length) {
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min(2.5, 650 / Math.max(1, maxX - minX), 450 / Math.max(1, maxY - minY));
    nodes.forEach((n) => { n.x = 420 + (n.x - (minX + maxX) / 2) * scale; n.y = 300 + (n.y - (minY + maxY) / 2) * scale; });
  }
  return { nodes, edges };
}

const EMPTY = { topics: [], documents: [], connections: [] };

export default function EvidenceNetwork() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const graph = useQuery({ queryKey: ['topics', 'network'], queryFn: async ({ signal }) => (await api.get('/topics/network', { signal, timeout: 300000 })).data, retry: false });
  const data = graph.data || EMPTY;
  const layout = useMemo(() => positionNetwork(data), [data]);
  const [topicId, setTopicId] = useState(null);
  const [search, setSearch] = useState('');
  const topic = data.topics.find((t) => t.id === topicId);
  const related = topic ? data.connections.filter((e) => e.topicId === topic.id) : data.connections;
  const relatedIds = new Set(related.map((e) => e.documentId));
  const visibleDocuments = data.documents.filter((d) => relatedIds.has(d.id) && d.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const gaps = data.topics.filter((t) => !t.connections).length;
  const openDocument = (id) => navigate(`/documents/${id}/pasajes/0`);
  const selectNode = (n) => {
    if (n.type === 'topic') setTopicId(n.id);
    else openDocument(n.id);
  };

  return <div className="evidence-network">
    <header className="network-heading">
      <div><h2 className="font-display text-2xl">Red visual</h2><p>Descubre cómo se conectan tus temáticas y los documentos del repositorio.</p></div>
      <button className="network-button" disabled={graph.isFetching} onClick={() => qc.invalidateQueries({ queryKey: ['topics', 'network'] })}>{graph.isFetching ? 'Construyendo red…' : 'Actualizar red'}</button>
    </header>
    <div className="network-stats"><span><strong>{data.topics.length}</strong> temáticas</span><span><strong>{data.documents.length}</strong> documentos</span><span><strong>{data.connections.length}</strong> conexiones</span><span><strong>{gaps}</strong> temáticas sin evidencia ≥ 60%</span></div>
    {graph.isError && <p role="alert" className="network-error">No se pudo construir la red. Comprueba que la API y el servicio local de embeddings estén disponibles. <button onClick={() => graph.refetch()}>Reintentar</button></p>}
    <div className="network-workspace">
      <section className="network-map" aria-label="Mapa de temáticas y documentos">
        <div className="network-map-title"><strong>Mapa de relaciones</strong><span>Similitud mínima: 60%</span></div>
        {graph.isPending ? <div className="network-placeholder" role="status">Calculando relaciones semánticas…</div> : !data.topics.length ? <div className="network-placeholder"><strong>Tu red comienza con una temática</strong><p>Carga evidencias y agrega una temática para explorar sus relaciones.</p><Link to="/upload">Cargar evidencia</Link></div> : <NetworkCanvas layout={layout} topicId={topicId} documentId={null} onSelect={selectNode} />}
      </section>
      <aside className="network-panel">
        <label htmlFor="network-topic-select" className="network-eyebrow">TEMÁTICA SELECCIONADA</label>
        <select id="network-topic-select" value={topic?.id || ''} onChange={(e) => setTopicId(Number(e.target.value) || null)}><option value="">Todas las temáticas</option>{data.topics.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.connections})</option>)}</select>
        <h2>{topic?.name || 'Vista consolidada'}</h2>
        <p>{topic ? `${topic.connections} conexiones` : 'Selecciona un nodo para explorar sus relaciones.'}</p>
        {topic && <div className="network-dominant"><span>Subcriterio más presente</span><strong>{topic.dominantSubcriteria.length ? topic.dominantSubcriteria.map((s) => `${s.code} · ${s.name}`).join(' / ') : 'Sin subcriterio asociado'}</strong>{topic.dominantSubcriteria.length > 0 && <small>{topic.dominantSubcriteria[0].count} documento(s){topic.dominantSubcriteria.length > 1 ? ' por subcriterio · empate' : ''}</small>}</div>}
        <div className="network-list-heading"><h3>Documentos ({visibleDocuments.length})</h3>{topic && <button onClick={() => setTopicId(null)}>Ver todos</button>}</div>
        <input aria-label="Buscar documento en la red" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar documento…" />
        <div className="network-document-list">{visibleDocuments.map((d) => <button key={d.id} onClick={() => openDocument(d.id)} title="Abrir documento original"><span>{d.name}</span>{topic && <small>{(related.find((e) => e.documentId === d.id).similarity * 100).toFixed(1)}% de similitud</small>}</button>)}{!visibleDocuments.length && <p>{search ? 'No hay documentos con ese nombre.' : 'No hay documentos con similitud igual o superior al 60%.'}</p>}</div>
      </aside>
    </div>
  </div>;
}

