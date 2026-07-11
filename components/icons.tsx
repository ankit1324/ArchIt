import type { ComponentProps } from "react";

type P = ComponentProps<"svg">;
const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const ApartmentsIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5" y="3" width="10" height="18" rx="1" />
    <path d="M15 9h4v12h-4M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1M17 13h.5M17 17h.5M10 21v-3h2v3" />
  </svg>
);

export const HouseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 9.5V21h12V9.5" />
    <path d="M10 21v-5h4v5" />
  </svg>
);

export const LandIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3v6M12 9c0-3 2-4 4-4 0 3-2 4-4 4zM12 9c0-3-2-4-4-4 0 3 2 4 4 4z" />
    <path d="M3 21c3-4 6-6 9-6s6 2 9 6" />
    <path d="M12 15V9" />
  </svg>
);

export const RoomIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="6" y="3" width="12" height="18" rx="1" />
    <path d="M6 21h12" />
    <circle cx="15" cy="12" r="0.8" fill="currentColor" />
  </svg>
);

export const BusinessIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 21h18" />
    <path d="M5 21V8h6v13M11 12h8v9" />
    <path d="M7 11h1M7 14h1M7 17h1M14 15h1M17 15h1M14 18h1M17 18h1M11 8V4h4v4" />
  </svg>
);

export const HotelsIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
    <path d="M2 21h20M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    <path d="M10 21v-3h4v3" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14" />
  </svg>
);

export const LayersIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 17l9 5 9-5" opacity="0.45" />
  </svg>
);

export const LogoMark = (p: P) => (
  <svg {...base} strokeWidth={1.6} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 16V8M16 16V8M8 12c2 3 6 3 8 0" />
  </svg>
);
