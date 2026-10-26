/* The four people shown on the About us page.
   EDIT THIS FILE: replace the names, designations and bios, and drop each photo into
   `frontend/public/team/` (portrait, roughly 3:4, JPG or WebP) with the file name used
   in `photo`. A missing photo falls back to the person's initials, so nothing breaks
   while the real pictures are on their way. Links are optional; leave one out to hide it. */
export interface Developer {
  id: string;
  name: string;
  designation: string;
  photo: string;
  bio: string;
  links?: { github?: string; linkedin?: string; email?: string };
}

export const DEVELOPERS: Developer[] = [
  {
    id: 'dev-1',
    name: 'Dhruvi Padhiyar',
    designation: 'Team Leader | Frontend Developer',
    photo: '/team/dev-1.png',
    bio: 'Builds the screens students and staff use every day: the dashboard, clubs, projects and events.',
  },
  {
    id: 'dev-2',
    name: 'Abhinav Nair',
    designation: 'Frontend Developer | Project Planner',
    photo: '/team/dev-2.jpeg',
    bio: 'Owns the API behind the portal: sign-in, roles, join requests and notifications.',
  },
  {
    id: 'dev-3',
    name: 'Nisarg Priyadarshi',
    designation: 'Backend Developer | Database Designee',
    photo: '/team/dev-3.png',
    bio: 'Designs how clubs, projects, members and events are stored and kept consistent.',
  },
  {
    id: 'dev-4',
    name: 'Vedant Mistry',
    designation: 'Backend Developer | Documentation Worker',
    photo: '/team/dev-4.png',
    bio: 'Shapes how the portal looks and feels, from the colour palette to how each page flows.',
  },
];
