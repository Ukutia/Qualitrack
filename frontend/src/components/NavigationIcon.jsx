const paths = {
  '/app': 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  '/documents': 'M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM3 7V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2',
  '/upload': 'M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
  '/requests': 'M3 5h18v14H3zM3 5l9 7 9-7',
  '/search': 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  '/structure': 'M5 3h14v18H5zM9 7h6M9 12h6M9 17h3',
  '/report': 'M15 5l4 4M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15ZM3 22h18',
  '/cloud': 'M7 18H6a4 4 0 0 1-.7-7.9A7 7 0 0 1 19 9a4.5 4.5 0 0 1-.5 9H17M12 21V12m-3 3 3-3 3 3',
  '/trash': 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  '/security-events': 'm12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6ZM8.5 12l2.5 2.5 4.5-5',
  logout: 'M9 4H4v16h5M13 8l4 4-4 4M8 12h13',
  power: 'M12 3v9M7 5.5a8 8 0 1 0 10 0',
};

export default function NavigationIcon({ name, className = 'h-5 w-5' }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}><path d={paths[name] || paths['/documents']} /></svg>;
}
