import { useEffect, useRef } from 'react';

interface PhotoTrackProps {
  id: string;
  title?: string;
  startIndex?: number;
  photos?: Array<{ src: string; alt: string }>;
}

export const CLUB_PHOTOS = [
  { src: '/photos/photo-1.jpg', alt: 'Speaker addressing students at campus event' },
  { src: '/photos/photo-2.jpg', alt: 'Students competing in chess tournament' },
  { src: '/photos/photo-3.jpg', alt: 'Stage dance performance' },
  { src: '/photos/photo-4.jpg', alt: 'Ramzat musical event live performance' },
  { src: '/photos/photo-5.jpg', alt: 'Students playing basketball on the campus court' },
  { src: '/photos/X6.jpeg', alt: 'Ramzat musical stage and performance setup' },
  { src: '/photos/X7.jpeg', alt: 'Campus rally and awareness event with police and cadets' },
  { src: '/photos/X8.jpeg', alt: 'Students drama and theatrical performance at Infoplex' },
  { src: '/photos/X9.jpeg', alt: 'Industrial safety equipment demonstration' },
  { src: '/photos/X10.jpeg', alt: 'Student safety protocol demonstration' },
  { src: '/photos/X11.jpeg', alt: 'Campus street play performance' },
  { src: '/photos/X12.jpeg', alt: 'Theater mono-act dialogue performance' },
  { src: '/photos/X13.jpeg', alt: 'Students presenting smart fertilizer capsule project' },
  { src: '/photos/X14.jpeg', alt: 'Student research methodology and tinkering presentation' },
  { src: '/photos/X15.jpeg', alt: 'Student team presenting project to faculty mentors' },
  { src: '/photos/X16.jpeg', alt: 'Fine arts and floral design exhibition' },
];

export const PROJECT_PHOTOS = CLUB_PHOTOS;

export function PhotoTrack({ id, title, photos = CLUB_PHOTOS }: PhotoTrackProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm) return;

    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    let busy = false;

    function upd() {
      busy = false;
      if (!section || !track) return;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const rect = section.getBoundingClientRect();
      const q = Math.min(Math.max(-rect.top / (section.offsetHeight - vh || 1), 0), 1);
      const mx = Math.max(track.scrollWidth - vw, 0);
      track.style.transform = `translateX(${-q * mx}px)`;
    }

    function sc() {
      if (!busy) {
        busy = true;
        requestAnimationFrame(upd);
      }
    }

    window.addEventListener('scroll', sc, { passive: true });
    window.addEventListener('resize', sc);
    upd();

    return () => {
      window.removeEventListener('scroll', sc);
      window.removeEventListener('resize', sc);
    };
  }, []);

  return (
    <section className="hs" id={id} ref={sectionRef}>
      <div>
        {title && (
          <div className="hs-header">
            <h2 className="hs-title">{title}</h2>
          </div>
        )}
        <div className="track" ref={trackRef}>
          {photos.map((photo, i) => (
            <div
              key={photo.src}
              className="ph"
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading={i < 4 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
