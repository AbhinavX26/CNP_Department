import { useEffect, useRef } from 'react';

export interface PhotoItem {
  src: string;
  alt: string;
  tag?: string;
}

interface PhotoTrackProps {
  id: string;
  title?: string;
  startIndex?: number;
  photos?: PhotoItem[];
}

export const CLUB_PHOTOS: PhotoItem[] = [
  { src: '/photos/photo-4.jpg', alt: 'Live musical performance at Ramzat annual festival', tag: 'Ramzat Festival' },
  { src: '/photos/photo-2.jpg', alt: 'Students competing in university chess championship', tag: 'Chess Club' },
  { src: '/photos/photo-3.jpg', alt: 'Stage dance performance by cultural club troupe', tag: 'Dance Troupe' },
  { src: '/photos/photo-5.jpg', alt: 'Basketball tournament match on campus court', tag: 'Basketball' },
  { src: '/photos/photo-10.jpg', alt: 'Origami lanterns and campus cultural decoration night', tag: 'Art & Design' },
  { src: '/photos/photo-11.png', alt: 'Target archery sports club student practice session', tag: 'Archery Club' },
  { src: '/photos/photo-13.png', alt: 'Inter-college football tournament match', tag: 'Football' },
  { src: '/photos/photo-14.png', alt: 'Fine arts student painting canvas exhibition', tag: 'Fine Arts' },
  { src: '/photos/photo-8.jpg', alt: 'Students participating in campus club outdoor event', tag: 'Adventure Club' },
  { src: '/photos/photo-1.jpg', alt: 'Distinguished guest speaker addressing students at auditorium', tag: 'Leadership Talk' },
  { src: '/photos/X1.jpeg', alt: 'National Cadet Corps ceremonial parade on campus', tag: 'NCC Cadets' },
  { src: '/photos/X2.jpeg', alt: 'Students celebrating annual cultural festival', tag: 'Cultural Fest' },
  { src: '/photos/X3.jpeg', alt: 'GSFC University annual celebration on stage', tag: 'Stage Honors' },
  { src: '/photos/X4.jpeg', alt: 'Volleyball sports tournament game on campus court', tag: 'Volleyball' },
  { src: '/photos/X6.jpeg', alt: 'Ramzat musical stage and acoustic sound setup', tag: 'Live Acoustics' },
  { src: '/photos/X7.jpeg', alt: 'Campus road safety awareness rally with police department', tag: 'Community Rally' },
  { src: '/photos/X8.jpeg', alt: 'Dramatic theater and stage acting performance at Infoplex', tag: 'Drama & Theater' },
  { src: '/photos/X11.jpeg', alt: 'Street play nukkad natak performance on campus plaza', tag: 'Street Theater' },
];

export const PROJECT_PHOTOS: PhotoItem[] = [
  { src: '/photos/project-1.png', alt: 'Autonomous robotics rover prototype with multi-terrain chassis', tag: 'Robotics Rover' },
  { src: '/photos/project-3.jpg', alt: '3D printing rapid prototyping and additive manufacturing lab', tag: '3D Prototyping Lab' },
  { src: '/photos/project-2.png', alt: 'Collaborative student research and software development in library', tag: 'Research Hub' },
  { src: '/photos/project-5.png', alt: 'Software engineering team developing campus web platform', tag: 'Software Engineering' },
  { src: '/photos/project-6.png', alt: 'Student engineering team fabricating custom hardware components', tag: 'Hardware Fabrication' },
  { src: '/photos/project-8.png', alt: 'Applied science research laboratory experiments and synthesis', tag: 'Applied Science' },
  { src: '/photos/project-7.png', alt: 'Electronics circuit design, breadboarding and microcontroller testing', tag: 'Circuit Prototyping' },
  { src: '/photos/project-4.jpg', alt: 'Electronic test bench and automated signal diagnostic station', tag: 'Diagnostics Lab' },
  { src: '/photos/X13.jpeg', alt: 'Student innovators presenting controlled-release fertilizer capsule', tag: 'Agri-Tech Capsule' },
  { src: '/photos/X14.jpeg', alt: 'Student research methodology and tinkering lab project presentation', tag: 'Tinkering Lab' },
  { src: '/photos/X15.jpeg', alt: 'Project team presenting progress and milestones to faculty mentor', tag: 'Mentor Review' },
  { src: '/photos/X9.jpeg', alt: 'Industrial safety equipment and hazard protocol demonstration', tag: 'Industrial Safety' },
  { src: '/photos/X10.jpeg', alt: 'Chemical protocol and safety equipment validation lab', tag: 'Safety Protocols' },
  { src: '/photos/X5.jpeg', alt: 'Inter-disciplinary student and faculty project collaboration meeting', tag: 'Innovation Council' },
  { src: '/photos/photo-6.png', alt: 'Campus renewable energy and power monitoring project workshop', tag: 'Clean Energy' },
  { src: '/photos/photo-9.png', alt: 'GUIITAR incubation council team brainstorming and strategy session', tag: 'Incubation Strategy' },
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
              {photo.tag && (
                <div className="track-badge">
                  <span>{photo.tag}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
