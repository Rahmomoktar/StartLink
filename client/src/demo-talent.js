// Public fictional profiles for the Talent Showcase.
const profiles = [
  [
    'Ahmed Hassan',
    'Frontend developer',
    'Hargeisa',
    'BSc in Computer Science · Gollis University',
    ['React', 'Node.js', 'MongoDB', 'UI/UX'],
    'Full-stack developer interested in building accessible web applications for small businesses.',
  ],
  [
    'Amina Mohamed',
    'Software engineer',
    'Mogadishu',
    'BSc in Software Engineering · SIMAD University',
    ['JavaScript', 'Express.js', 'Git', 'Teamwork'],
    'Software engineering graduate who built an inventory workflow for small retailers.',
  ],
  [
    'Mohamed Ali',
    'Data analyst',
    'Mogadishu',
    'BSc in Data Science · Benadir University',
    ['Python', 'Data Analysis', 'SQL', 'Power BI'],
    'Data analyst who turns survey data into dashboards that help teams understand local transport needs.',
  ],
  [
    'Khadra Ahmed',
    'UI/UX designer',
    'Garowe',
    'BSc in Information Technology · Plasma University',
    ['UI/UX', 'Figma', 'Canva', 'Product Design'],
    'UI/UX designer focused on making everyday digital services easier to use.',
  ],
  [
    'Abdullahi Osman',
    'Electrical engineering graduate',
    'Hargeisa',
    'BSc in Electrical Engineering · East Africa University',
    ['IoT', 'Arduino', 'Electronics', 'Project Management'],
    'Engineering graduate who prototypes low-cost sensors for energy and water monitoring.',
  ],
  [
    'Sumaya Farah',
    'Business development graduate',
    'Mogadishu',
    'BSc in Business Administration · SIMAD University',
    ['Business Strategy', 'Marketing', 'Leadership', 'Research'],
    'Business graduate interested in customer research, startup growth, and go-to-market strategy.',
  ],
];

export const demoTalent = profiles
  .map(([fullName, headline, location, education, skills, bio], index) => ({
    _id: 'demo-' + (index + 1),
    userId: {
      _id: 'demo-' + (index + 1),
      fullName,
      sample: true,
      avatar: '/demo/talent-portraits.png#' + index,
    },
    headline,
    location,
    education: [education],
    skills,
    bio,
    interests: [],
    portfolioProjects: [],
  }))
  .reverse();
