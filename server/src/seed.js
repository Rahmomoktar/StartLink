import mongoose from 'mongoose';
import argon2 from 'argon2';
import { GraduateProfile, Opportunity, Startup, StartupMembership, User } from './models.js';
import { env, production } from './core.js';

const password = async (value) => {
  if (!value || value.length < 12)
    throw new Error('Seed passwords must be at least 12 characters.');
  return argon2.hash(value);
};
async function account(email, fullName, role, passwordHash) {
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $setOnInsert: { fullName, role, passwordHash, emailVerified: true, status: 'active' } },
    { upsert: true, new: true },
  );
  if (user.role !== role) throw new Error('Seed account email already belongs to another role.');
  return user;
}
if (!env.MONGODB_URI) throw new Error('Configure MONGODB_URI.');
await mongoose.connect(env.MONGODB_URI);
try {
  await Promise.all(Object.values(mongoose.models).map((Model) => Model.init()));
  if (env.SEED_ADMIN_EMAIL) {
    await account(
      env.SEED_ADMIN_EMAIL,
      'STARTLINK Administrator',
      'admin',
      await password(env.SEED_ADMIN_PASSWORD),
    );
    console.info('Administrator account is present.');
  }
  if (!production && env.DEMO_MODE === 'true') {
    const hash = await password(env.SEED_DEMO_PASSWORD);
    const graduate = await account('graduate@example.test', 'Alex Morgan', 'graduate', hash);
    await GraduateProfile.updateOne(
      { userId: graduate._id },
      {
        $setOnInsert: {
          headline: 'Frontend developer',
          skills: ['React', 'JavaScript'],
          interests: ['Technology'],
          location: 'Nairobi',
          workMode: 'remote',
          availability: 'Part time',
          visibility: true,
        },
      },
      { upsert: true },
    );
    const demo = [
      [
        'TechConnect Labs',
        'Technology',
        'Building digital experiences for growing businesses.',
        ['React', 'JavaScript'],
      ],
      [
        'InnovateHub',
        'Digital Solutions',
        'Helping ambitious ideas become useful digital products.',
        ['Product Design', 'Marketing'],
      ],
      [
        'GreenSpark',
        'Sustainability',
        'Exploring practical solutions for sustainable communities.',
        ['Research', 'Data Analysis'],
      ],
    ];
    for (const [index, [name, industry, description, requiredSkills]] of demo.entries()) {
      const user = await account(
        'startup' + (index + 1) + '@example.test',
        name + ' Demo Founder',
        'startup',
        hash,
      );
      const slug = 'demo-' + name.toLowerCase().replaceAll(' ', '-');
      const startup = await Startup.findOneAndUpdate(
        { slug },
        {
          $setOnInsert: {
            name,
            industry,
            description,
            requiredSkills,
            location: 'Nairobi',
            startupStage: 'Early stage',
            sample: true,
            visibility: true,
            verificationStatus: 'verified',
          },
        },
        { upsert: true, new: true },
      );
      const key = { startupId: startup._id, userId: user._id };
      await StartupMembership.updateOne(
        key,
        { $setOnInsert: { ...key, membershipRole: 'owner', status: 'active' } },
        { upsert: true },
      );
      if (index !== 0) continue;
      for (const type of ['project', 'challenge']) {
        const title =
          type === 'project'
            ? 'Build an accessible onboarding flow'
            : 'Design a keyboard-friendly form';
        await Opportunity.updateOne(
          { startupId: startup._id, title },
          {
            $setOnInsert: {
              createdBy: user._id,
              type,
              description: 'Demo opportunity. Explore accessible product design with a small team.',
              workMode: 'remote',
              requiredSkills: ['React', 'Accessibility'],
              deliverables: ['A short walkthrough'],
              instructions: 'Use a fictional example. Time limit: 45 minutes.',
              evaluationCriteria: ['Keyboard navigation', 'Readable labels'],
              deadline: new Date(Date.now() + 90 * 86400000),
              compensation:
                type === 'project'
                  ? 'Paid collaboration, terms agreed before work begins'
                  : 'Optional evaluation exercise',
              terms:
                'Demo terms. Participants retain ownership. Never submit private or commercial work.',
              status: 'published',
            },
          },
          { upsert: true },
        );
      }
    }
    console.info('Development demo records are present.');
  }
} finally {
  await mongoose.disconnect();
}
