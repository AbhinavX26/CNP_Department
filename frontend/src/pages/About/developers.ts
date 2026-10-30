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
    bio: 'Leader of the team, Dhruvi has managed to keep the team together and on track, persistently encouraging the members to meet their deadlines and work with coordination. She was also responsible for the animated Home Page and the website testing procedures.',
    links: { github: 'https://github.com/Dhruvi-180107', linkedin: 'https://in.linkedin.com/in/dhruvi-padhiyar-63002b34a' },
  },
  {
    id: 'dev-2',
    name: 'Abhinav Nair',
    designation: 'Frontend Developer | Project Planner',
    photo: '/team/dev-2.jpeg',
    bio: 'The planner and plotter, Abhinav made the inner frontend by creating every all the dashboard and components for each and every role. Planning the project as well as main frontend was his contribution, along with error handling of the website.',
    links: { github: 'https://github.com/AbhinavX26', linkedin: 'https://in.linkedin.com/in/abhinav-nair-4a1601369' },
  },
  {
    id: 'dev-3',
    name: 'Nisarg Priyadarshi',
    designation: 'Backend Developer | Database Designer',
    photo: '/team/dev-3.png',
    bio: 'Backend engineer and database designer, Nisarg made sure that every feature of the website functioned the way it was meant to. Bringing the planning and features to life, he made sure the website worked in intended ways and the data stored remained safe.',
    links: { github: 'https://github.com/Nisarg-Priyadarshi', linkedin: 'https://in.linkedin.com/in/nisarg-priyadarshi-92a25b379' },
  },
  {
    id: 'dev-4',
    name: 'Vedant Mistry',
    designation: 'Backend Developer | Documentation Worker',
    photo: '/team/dev-4.png',
    bio: 'Secondary backend helper, Vedant has been more involved in the documentation processes. He has also been helping with feature fixing and fault identification for the frontend engineers.',
    links: { github: 'https://github.com/Vedant-1110', linkedin: ':https://www.linkedin.com/in/vedant-mistry-048b82333/' },
  },
];
