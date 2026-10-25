import type { CSSProperties, ReactNode } from 'react';
import { GearIcon, ScrewdriverIcon, SpannerIcon } from '../icons/ToolIcons';
import { BookIcon, DetectiveGlassesIcon, LaptopIcon, MusicNoteIcon, SneakerIcon } from './NeonIcons';

interface OrbitIcon {
  icon: ReactNode;
  /** Neon colour of the icon (also drives its glow). */
  color: string;
}

/**
 * Student Managed Clubs first (book, then what clubs do), then GUIITAR Projects
 * (laptop, then the tools), spread evenly round one ring.
 */
const ICONS: OrbitIcon[] = [
  { icon: <BookIcon size={28} />, color: '#62b4ff' },
  { icon: <SneakerIcon size={28} />, color: '#ff4d5e' },
  { icon: <MusicNoteIcon size={28} />, color: '#ffc83d' },
  { icon: <DetectiveGlassesIcon size={28} />, color: '#b583ff' },
  { icon: <LaptopIcon size={28} />, color: '#38d9e8' },
  { icon: <GearIcon size={28} />, color: '#aeb8cc' },
  { icon: <SpannerIcon size={28} />, color: '#ffffff' },
  { icon: <ScrewdriverIcon size={28} />, color: '#46e08c' },
];

/**
 * Icons circling the welcome text on an ellipse. Pure CSS: each icon is moved by two
 * nested animations (x and y) a quarter-turn apart, which traces an ellipse and keeps
 * the icon upright. Radii come from --rx / --ry on the stage so they can change per screen.
 */
export function WelcomeOrbit() {
  return (
    <div className="landing-orbit" aria-hidden="true">
      <div className="landing-orbit-ring" />
      {ICONS.map((item, i) => (
        <div key={i} className="landing-orbit-x" style={{ '--p': i / ICONS.length, '--i': i } as CSSProperties}>
          <div className="landing-orbit-y">
            <div className="landing-orbit-icon" style={{ color: item.color }}>
              {item.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
