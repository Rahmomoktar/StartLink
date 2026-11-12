import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  Application,
  ChallengeSubmission,
  Connection,
  GraduateProfile,
  Opportunity,
  Startup,
  StartupFollow,
  StartupMembership,
  User,
} from './models.js';
import { role, verified } from './auth.js';
import { validateAttachments } from './files.js';
import {
  attachment,
  body,
  escape,
  exists,
  fail,
  list,
  oid,
  optional,
  page,
  param,
  query,
  required,
  send,
  url,
} from './core.js';

export const startupFields = {
  name: required(100),
  description: required(4000),
  industry: required(100),
  location: required(100),
  website: url.optional(),
  logo: url.optional(),
  banner: url.optional(),
  founders: list.optional(),
  startupStage: optional(80).optional(),
  requiredSkills: list.optional(),
  preferredSkills: list.optional(),
  visibility: z.boolean().optional(),
};
const project = z
  .object({
    title: required(),
    description: required(3000),
    technologies: list.optional(),
    screenshots: z.array(url).max(8).optional(),
    repositoryUrl: url.optional(),
    demoUrl: url.optional(),
  })
  .strict();
const graduateFields = {
  headline: optional(),
  bio: optional(3000),
  education: list,
  skills: list,
  certificates: z.array(attachment).max(20),
  portfolioProjects: z.array(project).max(20),
  interests: list,
  preferredIndustries: list,
  location: optional(100),
  availability: optional(100),
  workMode: z.enum(['remote', 'onsite', 'hybrid', '']),
  github: url,
  linkedin: url,
  visibility: z.boolean(),
};
export const startupMember = async (userId, startupId) => {
  const membership = await StartupMembership.findOne({ userId, startupId, status: 'active' });
  if (!membership) fail(403, 'You do not manage this startup.');
  return membership;
};
export const ownedStartupIds = async (userId) =>
  StartupMembership.find({ userId, status: 'active' }).distinct('startupId');
export const visible = {
  visibility: true,
  verificationStatus: 'verified',
  ...(process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE === 'true'
    ? {}
    : { sample: { $ne: true } }),
};
export const active = () => ({ status: 'published', deadline: { $gt: new Date() } });
export const publicStartupIds = () => Startup.find(visible).distinct('_id');
export const startupRoutes = Router();
startupRoutes.get('/', async (req, res) => {
  const options = query(req, {
    industry: optional().optional(),
    stage: optional().optional(),
    skills: optional().optional(),
    active: z.enum(['true', 'false']).optional(),
  });
  const filter = { ...visible };
  if (options.q)
    filter.$or = ['name', 'industry', 'location', 'description'].map((field) => ({
      [field]: new RegExp(escape(options.q), 'i'),
    }));
  for (const [key, value] of [
    ['industry', options.industry],
    ['startupStage', options.stage],
    ['requiredSkills', options.skills],
  ]) {
    if (value) filter[key] = new RegExp('^' + escape(value) + '$', 'i');
  }
  if (options.active === 'true')
    filter._id = { $in: await Opportunity.find(active()).distinct('startupId') };
  const result = await page(Startup, filter, options);
  const counts = await Opportunity.aggregate([
    { $match: { ...active(), startupId: { $in: result.items.map((item) => item._id) } } },
    { $group: { _id: '$startupId', count: { $sum: 1 } } },
  ]);
  const byStartup = new Map(counts.map(({ _id, count }) => [String(_id), count]));
  result.items.forEach((item) => {
    item.activeOpportunities = byStartup.get(String(item._id)) || 0;
  });
  send(res, result);
});
startupRoutes.get('/mine', ...role('startup'), async (req, res) =>
  send(res, await Startup.find({ _id: { $in: await ownedStartupIds(req.user._id) } })),
);
startupRoutes.get('/activity', ...role('startup'), async (req, res) => {
  const startupId = { $in: await ownedStartupIds(req.user._id) };
  const opportunityIds = await Opportunity.find({ startupId }).distinct('_id');
  const opportunityId = { $in: opportunityIds };
  const [projects, challenges, applications, submissions, connections, completed] =
    await Promise.all([
      Opportunity.countDocuments({ startupId, ...active(), type: 'project' }),
      Opportunity.countDocuments({ startupId, ...active(), type: 'challenge' }),
      Application.countDocuments({ opportunityId }),
      ChallengeSubmission.countDocuments({ challengeId: opportunityId }),
      Connection.countDocuments({ startupId, status: 'accepted' }),
      Application.countDocuments({ opportunityId, status: 'completed' }),
    ]);
  send(res, { projects, challenges, applications, submissions, connections, completed });
});
startupRoutes.post('/', ...role('startup'), verified, async (req, res) => {
  const input = body(req, startupFields);
  const prefix =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'startup';
  const startup = await Startup.create({ ...input, slug: prefix + '-' + randomUUID().slice(0, 8) });
  try {
    await StartupMembership.create({
      userId: req.user._id,
      startupId: startup._id,
      membershipRole: 'owner',
      status: 'active',
    });
  } catch (error) {
    await Startup.deleteOne({ _id: startup._id });
    throw error;
  }
  send(res, startup, 201);
});
startupRoutes.get('/saved', ...role('graduate'), async (req, res) => {
  const follows = await StartupFollow.find({ graduateId: req.user._id }).populate({
    path: 'startupId',
    match: visible,
  });
  send(res, follows.map((entry) => entry.startupId).filter(Boolean));
});
startupRoutes.get('/:id', async (req, res) => {
  const key = required(140).parse(req.params.id);
  const match = oid.safeParse(key).success ? { _id: key } : { slug: key };
  send(res, exists(await Startup.findOne({ ...visible, ...match })));
});
startupRoutes.patch('/:id', ...role('startup'), verified, async (req, res) => {
  const id = param(req);
  await startupMember(req.user._id, id);
  const input = z.object(startupFields).partial().strict().parse(req.body);
  send(res, exists(await Startup.findByIdAndUpdate(id, { $set: input }, { new: true })));
});
startupRoutes.get('/:id/opportunities', async (req, res) => {
  const id = param(req);
  exists(await Startup.findOne({ _id: id, ...visible }));
  send(res, await page(Opportunity, { startupId: id, ...active() }, query(req), 'title'));
});
startupRoutes.post('/:id/follow', ...role('graduate'), async (req, res) => {
  const startupId = param(req);
  exists(await Startup.findOne({ _id: startupId, ...visible }));
  const key = { startupId, graduateId: req.user._id };
  await StartupFollow.updateOne(key, { $setOnInsert: key }, { upsert: true });
  send(res, null);
});
startupRoutes.delete('/:id/follow', ...role('graduate'), async (req, res) => {
  await StartupFollow.deleteOne({ startupId: param(req), graduateId: req.user._id });
  send(res, null);
});
export const graduateRoutes = Router();
graduateRoutes.get('/me', ...role('graduate'), async (req, res) => {
  const profile = (await GraduateProfile.findOne({ userId: req.user._id }).lean()) || {};
  const fields = [
    'headline',
    'bio',
    'education',
    'skills',
    'portfolioProjects',
    'interests',
    'location',
    'availability',
  ];
  send(res, {
    ...profile,
    profileCompletion: Math.round(
      (100 * fields.filter((key) => profile[key]?.length).length) / fields.length,
    ),
  });
});
graduateRoutes.patch('/me', ...role('graduate'), async (req, res) => {
  const input = z
    .object({ ...graduateFields, avatar: url, fullName: required(100) })
    .partial()
    .strict()
    .parse(req.body);
  const { avatar, fullName, ...profile } = input;
  await validateAttachments(req.user._id, 'certificate', profile.certificates);
  const user = {};
  if (avatar !== undefined) user.avatar = avatar;
  if (fullName !== undefined) user.fullName = fullName;
  if (Object.keys(user).length) await User.updateOne({ _id: req.user._id }, { $set: user });
  send(
    res,
    await GraduateProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: profile },
      { upsert: true, new: true },
    ),
  );
});
graduateRoutes.post('/me/projects', ...role('graduate'), async (req, res) => {
  const input = project.parse(req.body);
  send(
    res,
    (await GraduateProfile.findOneAndUpdate(
      { userId: req.user._id, 'portfolioProjects.19': { $exists: false } },
      { $push: { portfolioProjects: input } },
      { new: true },
    )) || fail(409, 'Create a profile first or remove an existing project.'),
    201,
  );
});
graduateRoutes.patch('/me/projects/:id', ...role('graduate'), async (req, res) => {
  const input = project.partial().parse(req.body);
  const fields = Object.fromEntries(
    Object.entries(input).map(([key, value]) => ['portfolioProjects.$.' + key, value]),
  );
  send(
    res,
    exists(
      await GraduateProfile.findOneAndUpdate(
        { userId: req.user._id, 'portfolioProjects._id': param(req) },
        { $set: fields },
        { new: true },
      ),
    ),
  );
});
graduateRoutes.delete('/me/projects/:id', ...role('graduate'), async (req, res) => {
  await GraduateProfile.updateOne(
    { userId: req.user._id },
    { $pull: { portfolioProjects: { _id: param(req) } } },
  );
  send(res, null);
});
export const publicTalent = async () =>
  User.find({
    role: 'graduate',
    status: 'active',
    emailVerified: true,
    ...(process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE === 'true'
      ? {}
      : { sample: { $ne: true } }),
  }).distinct('_id');
const talentFilter = async () => ({ visibility: true, userId: { $in: await publicTalent() } });
export function safeTalent(record) {
  const { certificates, ...data } = record;
  return data;
}
graduateRoutes.get('/', ...role('startup', 'admin'), async (req, res) => {
  const options = query(req, {
    availability: optional().optional(),
    skills: optional().optional(),
    location: optional().optional(),
    study: optional().optional(),
  });
  const filter = await talentFilter();
  if (options.q)
    filter.$or = [
      'headline',
      'skills',
      'interests',
      'education',
      'location',
      'portfolioProjects.description',
    ].map((field) => ({ [field]: new RegExp(escape(options.q), 'i') }));
  for (const [key, value] of [
    ['skills', options.skills],
    ['availability', options.availability],
    ['location', options.location],
    ['education', options.study],
  ]) {
    if (value) filter[key] = new RegExp(escape(value), 'i');
  }
  const result = await page(GraduateProfile, filter, options, 'headline');
  await GraduateProfile.populate(result.items, { path: 'userId', select: 'fullName avatar' });
  result.items = result.items.map(safeTalent);
  send(res, result);
});
graduateRoutes.get('/:id', ...role('startup', 'admin'), async (req, res) => {
  const userId = param(req);
  const filter = await talentFilter();
  if (!filter.userId.$in.some((id) => String(id) === userId)) fail(404, 'Graduate not found.');
  send(
    res,
    safeTalent(
      exists(
        await GraduateProfile.findOne({ userId, visibility: true })
          .populate('userId', 'fullName avatar')
          .lean(),
      ),
    ),
  );
});
