/** Line icons at 16 units, drawn with currentColor. Sized by the component that holds them. */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  Overview: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  ),
  Customers: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <circle cx="6" cy="5.5" r="2.5" />
      <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 3.5a2.5 2.5 0 010 5M12.5 9.7c1.5.5 2.5 1.8 2.5 3.8" />
    </svg>
  ),
  Billing: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 6.5h13M4 10h3" />
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <path d="M4 11V7a4 4 0 018 0v4l1.5 1.5h-11L4 11zM6.5 14a1.5 1.5 0 003 0" />
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  ),
  More: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <circle cx="3.5" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1" fill="currentColor" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  Download: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11" />
    </svg>
  ),
  Sun: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 16 16" aria-hidden="true" {...P}>
      <path d="M13.5 9.5A6 6 0 016.5 2.5a6 6 0 107 7z" />
    </svg>
  ),
};
