const PATHS = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  chart: <><rect x="3" y="3" width="18" height="18" /><path d="M3 3l18 18M21 3L3 21M12 3l9 9-9 9-9-9z" /></>,
  chat: <path d="M4 5h16v11H10l-5 4v-4H4z" />,
  match: <><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  back: <path d="M15 5l-7 7 7 7" />,
  go: <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  star: <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.800 3 2.800 15 0 18M12 3c-2.800 3-2.800 15 0 18" /></>,
  planet: <><circle cx="12" cy="12" r="5" /><path d="M3.5 15.5c-1.500 2.500 4 1.500 9-1.500s8.500-7.500 7-10" /></>,
};

/** Line icons. Decorative: the text beside an icon always says what it means. */
export default function Icon({ name, size = 22 }) {
  return (
    <svg className={`icon icon-${name}`} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}
