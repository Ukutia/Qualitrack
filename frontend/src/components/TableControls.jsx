function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

export function TableSearch({
  id,
  label,
  placeholder,
  value,
  onChange,
  onboardingKey,
  onboardingOrder,
}) {
  return (
    <div className="relative min-w-[15rem] flex-1 sm:max-w-md">
      <label htmlFor={id} className="sr-only">{label}</label>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-steel-400"><SearchIcon /></span>
      <input
        id={id}
        type="search"
        data-onboarding-key={onboardingKey}
        data-onboarding-order={onboardingOrder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-steel-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-steel-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}

export function PageSizeSelect({ value, onChange, onboardingKey, onboardingOrder }) {
  return (
    <label className="flex items-center gap-2 text-xs text-steel-600">
      Filas por página
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        data-onboarding-key={onboardingKey}
        data-onboarding-order={onboardingOrder}
        className="rounded-lg border border-steel-200 bg-white px-2 py-1.5 text-steel-700"
      >
        {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
  );
}

function pageNumbersFor(page, pages) {
  return [...new Set([1, ...Array.from({ length: 5 }, (_, index) => page - 2 + index), pages])]
    .filter((value) => value >= 1 && value <= pages)
    .sort((a, b) => a - b);
}

export function PaginationFooter({
  page,
  pages,
  pageSize,
  total,
  itemLabel,
  ariaLabel,
  onPageChange,
  disabled = false,
  onboardingKeys,
  onboardingOrder = 0,
}) {
  const pageNumbers = pageNumbersFor(page, pages);
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-steel-100 px-5 py-4 text-xs text-steel-600">
      <span aria-live="polite">{total ? `${first}–${last} de ${total}` : `0 ${itemLabel}`} · Página {page} de {pages}</span>
      <nav aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={page === 1 || disabled} onClick={() => onPageChange(page - 1)} data-onboarding-key={onboardingKeys?.previous} data-onboarding-order={onboardingKeys ? onboardingOrder : undefined} className="rounded-lg border border-steel-200 px-3 py-2 font-medium text-steel-700 hover:bg-steel-50 disabled:cursor-not-allowed disabled:opacity-40">← Anterior</button>
        {pageNumbers.map((number, index) => (
          <span key={number} className="inline-flex items-center gap-1.5">
            {index > 0 && number > pageNumbers[index - 1] + 1 && <span aria-hidden="true" className="px-1">…</span>}
            <button type="button" aria-label={`Ir a la página ${number}`} aria-current={number === page ? 'page' : undefined} disabled={disabled} onClick={() => onPageChange(number)} data-onboarding-key={onboardingKeys?.page} data-onboarding-order={onboardingKeys ? onboardingOrder + 1 : undefined} className={`min-w-8 rounded-lg border px-2 py-2 font-medium disabled:opacity-50 ${number === page ? 'border-brand-600 bg-brand-600 text-white' : 'border-steel-200 text-steel-700 hover:bg-steel-50'}`}>{number}</button>
          </span>
        ))}
        <button type="button" disabled={page >= pages || disabled} onClick={() => onPageChange(page + 1)} data-onboarding-key={onboardingKeys?.next} data-onboarding-order={onboardingKeys ? onboardingOrder + 2 : undefined} className="rounded-lg border border-steel-200 px-3 py-2 font-medium text-steel-700 hover:bg-steel-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente →</button>
      </nav>
    </footer>
  );
}
