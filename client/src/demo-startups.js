// Public fictional startup profiles for the homepage.
export const featuredStartups = [
  {
    name: 'GreenSphere',
    slug: 'demo-greensphere',
    industry: 'Clean Energy & Sustainability',
    location: 'Garowe',
    description:
      'Support our data team in building a dashboard to monitor solar energy performance across regions.',
    requiredSkills: ['Data Visualization', 'Excel', 'Power BI'],
  },
  {
    name: 'CampusLink',
    slug: 'demo-campuslink',
    industry: 'Education & Community',
    location: '',
    description:
      'Create a 1-week social media campaign to grow awareness of CampusLink among university students.',
    requiredSkills: ['Canva', 'Copywriting', 'Branding'],
  },
  {
    name: 'EduSpark',
    slug: 'demo-eduspark',
    industry: 'EdTech & Learning',
    location: '',
    description:
      'Help build and maintain backend features for our online learning platform used by students nationwide.',
    requiredSkills: ['Node.js', 'Express', 'MongoDB'],
  },
].map((item) => ({ ...item, _id: item.slug, sample: true, staticProfile: true }));
