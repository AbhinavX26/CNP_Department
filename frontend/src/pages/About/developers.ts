/* The four people shown on the About us page.
   EDIT THIS FILE: replace the names, designations and bios, and drop each photo into
   `frontend/public/team/` (portrait, roughly 3:4, JPG or WebP) with the file name used
   in `photo`. A missing photo falls back to the person's initials, so nothing breaks
   while the real pictures are on their way. Links are optional; leave one out to hide it. */
export interface Developer {
  id: string;
  name: string;
  badge: string;
  designation: string;
  photo: string;
  bio: string;
  links?: { github?: string; linkedin?: string; email?: string };
}

export const DEVELOPERS: Developer[] = [
  {
    id: 'dev-1',
    name: 'Dhruvi Padhiyar',
    badge: 'TEAM LEADER & FRONTEND',
    designation: 'Team Leader | Frontend Developer',
    photo: '/team/dev-1.png',
    bio: 'Leader of the team, Dhruvi kept the team coordinated and on track to meet deadlines. She led the animated landing experience and guided website testing procedures.',
    links: { github: 'https://github.com/Dhruvi-180107', linkedin: 'https://in.linkedin.com/in/dhruvi-padhiyar-63002b34a' },
  },
  {
    id: 'dev-2',
    name: 'Abhinav Nair',
    badge: 'PROJECT PLANNER & FRONTEND',
    designation: 'Frontend Developer | Project Planner',
    photo: '/team/dev-2.jpeg',
    bio: 'The planner and architect, Abhinav built the dashboard interfaces and components across student and admin roles, spearheading frontend structure and resilient error handling.',
    links: { github: 'https://github.com/AbhinavX26', linkedin: 'https://in.linkedin.com/in/abhinav-nair-4a1601369' },
  },
  {
    id: 'dev-3',
    name: 'Nisarg Priyadarshi',
    badge: 'BACKEND & DATABASE DESIGNER',
    designation: 'Backend Developer | Database Designer',
    photo: '/team/dev-3.png',
    bio: 'Backend engineer and database designer, Nisarg architected the MongoDB schemas, REST endpoints, and authentication pipelines ensuring secure and reliable data flow.',
    links: { github: 'https://github.com/Nisarg-Priyadarshi', linkedin: 'https://in.linkedin.com/in/nisarg-priyadarshi-92a25b379' },
  },
  {
    id: 'dev-4',
    name: 'Vedant Mistry',
    badge: 'BACKEND & DOCUMENTATION',
    designation: 'Backend Developer | Documentation Worker',
    photo: '/team/dev-4.png',
    bio: 'Secondary backend engineer, Vedant managed project documentation, SRS requirements, API verification, and collaborated on feature fixing and fault identification.',
    links: { github: 'https://github.com/Vedant-1110', linkedin: 'https://www.linkedin.com/in/vedant-mistry-048b82333/' },
  },
];
