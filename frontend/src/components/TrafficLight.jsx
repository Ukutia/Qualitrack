const MAP = {
  green: { bg: 'bg-emerald-500', ring: 'ring-emerald-200', label: 'Suficiente' },
  yellow: { bg: 'bg-amber-400', ring: 'ring-amber-200', label: 'Parcial' },
  red: { bg: 'bg-rose-500', ring: 'ring-rose-200', label: 'Insuficiente' },
};

export default function TrafficLight({ color, size = 'md' }) {
  const c = MAP[color] || MAP.red;
  const dim = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <span
      className={`inline-block rounded-full ring-4 ${dim} ${c.bg} ${c.ring}`}
      title={c.label}
      aria-label={c.label}
    />
  );
}
