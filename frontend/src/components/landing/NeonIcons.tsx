import type { FC } from 'react';

/**
 * Line icons for the landing hero's club orbit (the project orbit reuses ToolIcons).
 * `color` is applied as a stroke; the hero CSS adds the neon glow.
 */
interface NeonIconProps {
  size?: number | string;
  color?: string;
}

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** Dance sneaker. */
export const SneakerIcon: FC<NeonIconProps> = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} stroke={color} {...common}>
    <path d="M2.5 16.5v-3.4c0-.8.5-1.5 1.2-1.8l3.4-1.4 1.2-3.9h3.3l.9 2.6c1.7.5 3.8 1.5 5.3 2.6 1.4 1 2.2 2.2 2.2 3.4v2.2Z" />
    <path d="M2.5 19.3h19" />
    <path d="M9.3 9.6l1.9 1.2M11 7.6l1.9 1.2" />
  </svg>
);

/** Music note. */
export const MusicNoteIcon: FC<NeonIconProps> = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} stroke={color} {...common}>
    <path d="M9 18V6.2l10-2V16" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
    <path d="M9 9.2l10-2" />
  </svg>
);

/** Detective's round spectacles. */
export const DetectiveGlassesIcon: FC<NeonIconProps> = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} stroke={color} {...common}>
    <circle cx="7" cy="14" r="3.6" />
    <circle cx="17" cy="14" r="3.6" />
    <path d="M10.6 13.2c.9-.7 1.9-.7 2.8 0" />
    <path d="M3.4 13.4 2 10.5M20.6 13.4 22 10.5" />
    <path d="M5.4 12.6a2.4 2.4 0 0 1 1.6-.9M15.4 12.6a2.4 2.4 0 0 1 1.6-.9" />
  </svg>
);

/** Open book. */
export const BookIcon: FC<NeonIconProps> = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} stroke={color} {...common}>
    <path d="M12 6.5C10.2 5 7.6 4.3 3.5 4.5v13c4.1-.2 6.7.5 8.5 2 1.8-1.5 4.4-2.2 8.5-2v-13c-4.1-.2-6.7.5-8.5 2Z" />
    <path d="M12 6.5V19.5" />
    <path d="M6 8.5c1.2 0 2.2.2 3.2.6M6 11.5c1.2 0 2.2.2 3.2.6M18 8.5c-1.2 0-2.2.2-3.2.6M18 11.5c-1.2 0-2.2.2-3.2.6" />
  </svg>
);

/** Laptop with a smiley on screen. */
export const LaptopIcon: FC<NeonIconProps> = ({ size = 32, color = 'currentColor' }) => (
  <svg width={size} height={size} stroke={color} {...common}>
    <rect x="4.5" y="5" width="15" height="10.5" rx="1.6" />
    <path d="M2.5 19h19" />
    <path d="M9.4 11.4c.7 1 1.6 1.4 2.6 1.4s1.9-.4 2.6-1.4" />
    <path d="M9.6 8.6h.01M14.4 8.6h.01" />
  </svg>
);
