const base = (size) => ({
  viewBox: '0 0 24 24',
  width: size,
  height: size,
  style: { display: 'block', flexShrink: 0 },
});

export const HomeIcon = ({ size = 20 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
    <path d="M9.5 20v-6h5v6" />
  </svg>
);

export const WalletIcon = ({ size = 20 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18" />
    <path d="M15.5 14.2h2.2" />
  </svg>
);

export const ChartIcon = ({ size = 20 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20V10" />
    <path d="M11 20V4" />
    <path d="M18 20v-7" />
    <path d="M3 20h18" />
  </svg>
);

export const GearIcon = ({ size = 20 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.6a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.4-.6-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.6a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4.6 2-3.4-2-1.6Z" />
  </svg>
);

export const PlusIcon = ({ size = 26 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const BackIcon = ({ size = 20 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const CameraIcon = ({ size = 20 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
