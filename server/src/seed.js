import mongoose from 'mongoose';
import argon2 from 'argon2';
import {
  Application,
  Category,
  ChallengeSubmission,
  Connection,
  Conversation,
  GraduateProfile,
  Message,
  Notification,
  Opportunity,
  Startup,
  StartupFollow,
  StartupMembership,
  User,
} from './models.js';
import { env, production } from './core.js';

async function password(value) {
  if (!value || value.length < 12)
    throw new Error('Seed passwords must be at least 12 characters.');
  return argon2.hash(value);
}
async function insert(Model, key, values) {
  return Model.findOneAndUpdate(
    key,
    { $setOnInsert: { ...key, ...values } },
    { upsert: true, new: true },
  );
}
async function account(email, fullName, role, passwordHash, sample = false) {
  const user = await insert(
    User,
    { email: email.toLowerCase() },
    {
      fullName,
      role,
      passwordHash,
      sample,
      emailVerified: true,
      status: 'active',
    },
  );
  if (user.role !== role) throw new Error('Seed account email already belongs to another role.');
  if (sample && !user.sample) {
    if (!email.endsWith('@example.test')) throw new Error('Demo accounts must use example.test.');
    await User.updateOne({ _id: user._id }, { sample: true });
  }
  return user;
}

const talent = [
  [
    'Alex Morgan',
    'Frontend developer',
    'Nairobi',
    'BSc in Computer Science',
    ['React', 'JavaScript', 'Accessibility'],
    'Built a keyboard-friendly onboarding prototype for mobile users.',
  ],
  [
    'Amina Yusuf',
    'Product designer',
    'Hargeisa',
    'BA in Digital Media',
    ['Figma', 'Product Design', 'User Research'],
    'Designed and tested an inventory workflow for small retailers.',
  ],
  [
    'Brian Otieno',
    'Data analyst',
    'Kisumu',
    'BSc in Statistics',
    ['Python', 'Data Analysis', 'SQL'],
    'Cleaned public transport survey data and built a dashboard to summarize travel patterns.',
  ],
  [
    'Hodan Hassan',
    'Backend developer',
    'Hargeisa',
    'BSc in Software Engineering',
    ['Node.js', 'MongoDB', 'API Design'],
    'Built a REST API for appointment scheduling with role-based access.',
  ],
  [
    'Neema Mwangi',
    'Sustainability researcher',
    'Nakuru',
    'BSc in Environmental Science',
    ['Research', 'Field Surveys', 'Data Analysis'],
    'Mapped collection points and interviewed vendors about food waste.',
  ],
];
const companies = [
  [
    'TechConnect Labs',
    'Technology',
    'Nairobi',
    'Pilot',
    'Builds accessible booking and payment tools for small service businesses.',
    ['React', 'JavaScript', 'Accessibility'],
    'Build an accessible onboarding flow',
    'Design a keyboard-friendly form',
  ],
  [
    'InnovateHub',
    'Digital Solutions',
    'Hargeisa',
    'Prototype',
    'Prototypes inventory and sales tools with independent retailers.',
    ['Figma', 'Product Design', 'User Research'],
    'Prototype a mobile stock counter',
    'Design an empty-state for inventory',
  ],
  [
    'GreenSpark',
    'Sustainability',
    'Nakuru',
    'Early stage',
    'Helps market vendors track food waste and coordinate neighborhood collection.',
    ['Research', 'Python', 'Data Analysis'],
    'Build a food waste dashboard',
    'Analyze a waste collection dataset',
  ],
];

async function seedGraduates(hash) {
  const graduates = [];
  for (const [index, [name, headline, location, education, skills, project]] of talent.entries()) {
    const user = await account(
      index === 0 ? 'graduate@example.test' : 'graduate' + (index + 1) + '@example.test',
      name,
      'graduate',
      hash,
      true,
    );
    graduates.push(user);
    await insert(
      GraduateProfile,
      { userId: user._id },
      {
        headline,
        skills,
        location,
        education: [education],
        bio: project + ' Interested in collaborating with early-stage teams.',
        interests: [headline],
        availability: index % 2 ? 'Full time' : 'Part time',
        workMode: index % 2 ? 'hybrid' : 'remote',
        visibility: true,
        portfolioProjects: [
          { title: 'Selected project', description: project, technologies: skills },
        ],
      },
    );
  }
  return graduates;
}

async function seedDemo() {
  const hash = await password(env.SEED_DEMO_PASSWORD);
  const graduates = await seedGraduates(hash);
  const teams = [];
  for (const [
    index,
    [name, industry, location, startupStage, description, skills, project, challenge],
  ] of companies.entries()) {
    const founder = await account(
      'startup' + (index + 1) + '@example.test',
      name + ' Demo Founder',
      'startup',
      hash,
      true,
    );
    const startup = await insert(
      Startup,
      { slug: 'demo-' + name.toLowerCase().replaceAll(' ', '-') },
      {
        name,
        industry,
        description,
        location,
        startupStage,
        requiredSkills: skills,
        founders: [founder.fullName],
        sample: true,
        visibility: true,
        verificationStatus: 'verified',
      },
    );
    await insert(
      StartupMembership,
      { startupId: startup._id, userId: founder._id },
      { membershipRole: 'owner', status: 'active' },
    );
    const category = await insert(Category, { name: industry }, {});
    const listings = [];
    for (const [type, title] of [
      ['project', project],
      ['challenge', challenge],
    ]) {
      const isProject = type === 'project';
      listings.push(
        await insert(
          Opportunity,
          { startupId: startup._id, title },
          {
            createdBy: founder._id,
            type,
            location,
            category: category.name,
            description: isProject
              ? description + ' Join the team to turn a scoped prototype into a pilot.'
              : description + ' Use a fictional scenario to demonstrate one improvement.',
            workMode: index % 2 ? 'hybrid' : 'remote',
            requiredSkills: skills,
            deliverables: [
              isProject
                ? 'Working prototype and short handover'
                : 'One solution and a brief rationale',
            ],
            instructions: 'Use sample data and describe any assumptions.',
            evaluationCriteria: ['Clarity of the solution', 'Practicality and accessibility'],
            deadline: new Date(Date.now() + 90 * 86400000),
            duration: isProject ? '3 weeks' : '60 minutes',
            compensation: isProject
              ? 'Paid collaboration, terms agreed before work begins'
              : 'Unpaid practice challenge',
            terms: 'Demo listing. Participants retain ownership of their work.',
            capacity: isProject ? 3 : 12,
            status: 'published',
            publishedAt: new Date(),
          },
        ),
      );
    }
    teams.push({ startup, founder, listings });
  }

  const [graduate, designer] = graduates;
  const [{ startup, founder, listings }, designTeam] = teams;
  await insert(StartupFollow, { graduateId: graduate._id, startupId: startup._id }, {});
  await insert(
    Application,
    { graduateId: graduate._id, opportunityId: listings[0]._id },
    {
      motivation:
        'I have built onboarding interfaces with React and would like to help test the keyboard flow.',
      skills: ['React', 'Accessibility'],
      availability: '10 hours per week',
      status: 'submitted',
    },
  );
  await insert(
    ChallengeSubmission,
    { graduateId: designer._id, challengeId: designTeam.listings[1]._id },
    {
      content:
        'Show a short explanation, a primary Add stock button, and a secondary Import CSV action.',
      reviewStatus: 'submitted',
    },
  );
  const connection = await insert(
    Connection,
    { graduateId: graduate._id, startupId: startup._id },
    {
      startupUserId: founder._id,
      requestedBy: graduate._id,
      recipientUserId: founder._id,
      status: 'accepted',
      respondedAt: new Date(),
      message: 'I would like to learn more about your accessibility work.',
    },
  );
  if (connection.status === 'accepted') {
    const conversation = await insert(
      Conversation,
      { connectionId: connection._id },
      {
        participants: [graduate._id, founder._id],
        lastMessageAt: new Date(),
      },
    );
    await insert(
      Message,
      {
        conversationId: conversation._id,
        senderId: founder._id,
        body: 'Hi Alex! We can share the pilot checklist and discuss a time for a short introduction.',
      },
      {
        readBy: [founder._id],
      },
    );
  }
  await insert(
    Notification,
    { recipientId: graduate._id, type: 'connection', relatedEntityId: connection._id },
    {
      title: 'Connection accepted',
      body: 'TechConnect Labs accepted your connection request.',
    },
  );
  console.info('Development demo records are present.');
}

if (!env.MONGODB_URI) throw new Error('Configure MONGODB_URI.');
const graduatesOnly = process.argv.includes('--graduates-only');
await mongoose.connect(env.MONGODB_URI);
try {
  await Promise.all(Object.values(mongoose.models).map((Model) => Model.init()));
  if (!graduatesOnly && env.SEED_ADMIN_EMAIL) {
    await account(
      env.SEED_ADMIN_EMAIL,
      'STARTLINK Administrator',
      'admin',
      await password(env.SEED_ADMIN_PASSWORD),
    );
    console.info('Administrator account is present.');
  }
  if (!production && env.DEMO_MODE === 'true') {
    if (graduatesOnly) {
      await seedGraduates(await password(env.SEED_DEMO_PASSWORD));
      console.info('Development graduate profiles are present.');
    } else {
      await seedDemo();
    }
  }
} finally {
  await mongoose.disconnect();
}
