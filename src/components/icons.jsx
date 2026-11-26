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

export const EditIcon = ({ size = 18 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);

export const TrashIcon = ({ size = 16 }) => (
  <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16" />
    <path d="M9 7V4.5h6V7" />
    <path d="M6.5 7l1 13h9l1-13" />
  </svg>
);

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const BondsIcon = ({ size = 20 }) => (
  <svg {...base(size)} {...line}>
    <rect x="4" y="3.5" width="14" height="17" rx="2.5" />
    <path d="M8 8.5h6M8 12h6M8 15.5h3.5" />
  </svg>
);

export const CalendarIcon = ({ size = 20 }) => (
  <svg {...base(size)} {...line}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

export const AddDocIcon = ({ size = 22 }) => (
  <svg {...base(size)} {...line}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

export const ScanIcon = ({ size = 22 }) => (
  <svg {...base(size)} {...line}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M7.5 12h9" />
  </svg>
);

export const DownloadIcon = ({ size = 22 }) => (
  <svg {...base(size)} {...line}>
    <path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14" />
  </svg>
);

export const UploadIcon = ({ size = 22 }) => (
  <svg {...base(size)} {...line}>
    <path d="M12 16V5M7.5 9 12 4.5 16.5 9M5 20h14" />
  </svg>
);

export const FolderPlusIcon = ({ size = 22 }) => (
  <svg {...base(size)} {...line}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    <path d="M12 11v5M9.5 13.5h5" />
  </svg>
);

export const BellIcon = ({ size = 22 }) => (
  <svg {...base(size)} {...line}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);

export const GridIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
  </svg>
);
export const StarIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4.5 13.8 9h4.7l-3.8 3 1.4 4.7L12 14.4 7.9 16.7 9.3 12l-3.8-3h4.7L12 4.5Z" />
  </svg>
);
export const FlameIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20c-2-6 1.5-8 1.5-12A4 4 0 0 0 8 8c0 5 4 8 4 12Z" />
    <path d="M12 8c.4-2 2.2-3.4 4-3 1 .2 2 1.2 2 2.8 0 2.6-2.6 4.2-6 6.2" />
  </svg>
);
export const CheckCircleIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

const SERIE_CHROME = {
  ordinario: { tone: 'cyan', Icon: BondsIcon },
  '3x4': { tone: 'amber', Icon: GridIcon },
  minori: { tone: 'violet', Icon: FlameIcon },
  plus: { tone: 'coral', Icon: StarIcon },
  '4anni': { tone: 'coral', Icon: StarIcon },
  '18mesi': { tone: 'mint', Icon: CheckCircleIcon },
};

export function chromeOf(bond, portfolio) {
  const key = String(bond?.serieKey || '').toLowerCase();
  if (SERIE_CHROME[key]) return SERIE_CHROME[key];
  if (key.includes('minori')) return SERIE_CHROME.minori;
  if (key.includes('3x4') || key.includes('3×4')) return SERIE_CHROME['3x4'];
  if (key.includes('18')) return SERIE_CHROME['18mesi'];
  if (key.includes('plus') || key.includes('4')) return SERIE_CHROME.plus;
  const serie = String(bond?.serie || '').toLowerCase();
  if (serie.includes('minori')) return SERIE_CHROME.minori;
  if (serie.includes('3x4') || serie.includes('3×4')) return SERIE_CHROME['3x4'];
  if (serie.includes('18')) return SERIE_CHROME['18mesi'];
  if (serie.includes('plus')) return SERIE_CHROME.plus;
  if (serie.includes('ordinario')) return SERIE_CHROME.ordinario;
  return { tone: portfolio?.colore || 'cyan', Icon: BondsIcon };
}
