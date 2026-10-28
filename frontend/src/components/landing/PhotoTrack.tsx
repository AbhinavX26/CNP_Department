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
  { src: '/photos/photo-6.png', alt: 'Students with bubbles at outdoor club fair booth' },
  { src: '/photos/photo-7.jpg', alt: 'Students collaborating and planning club projects' },
  { src: '/photos/photo-8.jpg', alt: 'Students participating in tug-of-war activity' },
  { src: '/photos/photo-9.png', alt: 'Students enjoying food festival and social gathering' },
  { src: '/photos/photo-10.jpg', alt: 'Origami lanterns and paper boat celebration' },
  { src: '/photos/photo-11.png', alt: 'Students practicing archery at sports club' },
  { src: '/photos/photo-12.png', alt: 'Students holding up an earth globe together' },
  { src: '/photos/photo-13.png', alt: 'Football match on the campus grass field' },
  { src: '/photos/photo-14.png', alt: 'Student painting on canvas in fine arts club' },
];

export const PROJECT_PHOTOS = [
  { src: '/photos/project-1.png', alt: 'Students engineering and testing robotics rover prototype' },
  { src: '/photos/project-2.png', alt: 'Student conducting research and project work in library' },
  { src: '/photos/project-3.jpg', alt: 'Student building and assembling 3D printer hardware frame' },
  { src: '/photos/project-4.jpg', alt: 'Group of college students collaborating on research project' },
  { src: '/photos/project-5.png', alt: 'Student doing research in computer lab' },
  { src: '/photos/project-6.png', alt: 'Engineering student on university campus' },
  { src: '/photos/project-7.png', alt: 'Student taking project notes and coding with laptop' },
  { src: '/photos/project-8.png', alt: 'Students conducting experiment in science laboratory' },
];

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
