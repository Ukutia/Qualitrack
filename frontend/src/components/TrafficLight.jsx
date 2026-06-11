const MAP = {
  green: { bg: 'bg-emerald-500', ring: 'ring-emerald-500/15', label: 'Suficiente', pulse: false },
  yellow: { bg: 'bg-amber-400', ring: 'ring-amber-400/20', label: 'Parcial', pulse: true },
  red: { bg: 'bg-rose-500', ring: 'ring-rose-500/15', label: 'Insuficiente', pulse: true },
};

export default function TrafficLight({ color, size = 'md' }) {
  const c = MAP[color] || MAP.red;
  const dim = size === 'lg' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5';
  const ring = size === 'lg' ? 'ring-[6px]' : 'ring-4';
  return (
    <span className="relative inline-flex shrink-0" title={c.label} aria-label={c.label}>
      {/* Halo que late solo cuando algo requiere atención */}
      {c.pulse && (
        <span className={`absolute inset-0 m-auto ${dim} rounded-full ${c.bg} opacity-60 animate-ping`} />
      )}
      <span className={`relative inline-block rounded-full ${ring} ${dim} ${c.bg} ${c.ring}`} />
    </span>
  );
}
