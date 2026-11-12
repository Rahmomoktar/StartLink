import { Router } from 'express';
import { z } from 'zod';
import {
  Application,
  ChallengeSubmission,
  GraduateProfile,
  Opportunity,
  Startup,
  StartupFollow,
  User,
} from './models.js';
import { role, verified } from './auth.js';
import {
  attachment,
  body,
  escape,
  exists,
  fail,
  list,
  meetsMandatorySkills,
  notify,
  oid,
  optional,
  page,
  param,
  query,
  required,
  same,
  send,
  url,
} from './core.js';
import { validateAttachments } from './files.js';
import { active, ownedStartupIds, publicStartupIds, startupMember, visible } from './discovery.js';

const fields = {
  type: z.enum(['project', 'challenge']),
  title: required(),
  description: required(6000),
  instructions: optional(6000).optional(),
  category: optional().optional(),
  requiredSkills: list.optional(),
  mandatorySkills: list.optional(),
  preferredSkills: list.optional(),
  deliverables: list.optional(),
  workMode: z.enum(['remote', 'onsite', 'hybrid']),
  location: optional(120).optional(),
  duration: optional(120).optional(),
  compensation: optional(250).optional(),
  deadline: z.iso.datetime().transform((value) => new Date(value)),
  capacity: z.number().int().min(1).max(500).optional(),
  evaluationCriteria: list.optional(),
  terms: required(5000),
  availability: optional(100).optional(),
  status: z.enum(['draft', 'published', 'closed']).optional(),
};
async function publication(startupId, data) {
  if (data.status !== 'published') return;
  if (!(await Startup.exists({ _id: startupId, ...visible })))
    fail(403, 'A public, verified startup is required to publish.');
  if (data.deadline <= new Date()) fail(422, 'Choose a future deadline.');
  if (data.type === 'challenge' && (!data.instructions || !data.evaluationCriteria?.length))
    fail(422, 'Challenges require instructions and evaluation criteria.');
}
async function owned(req) {
  const record = exists(await Opportunity.findById(param(req)));
  await startupMember(req.user._id, record.startupId);
  return record;
}
async function open(req, type) {
  const record = exists(
    await Opportunity.findOne({
      _id: param(req),
      ...active(),
      type,
      startupId: { $in: await publicStartupIds() },
    }),
  );
  if (
    record.mandatorySkills.length &&
    !meetsMandatorySkills(await GraduateProfile.findOne({ userId: req.user._id }), record)
  ) {
    fail(403, 'Add the mandatory skills to your profile before applying.');
  }
  return record;
}
async function announce(req, record) {
  const followers = await StartupFollow.find({ startupId: record.startupId }).distinct(
    'graduateId',
  );
  await Promise.allSettled(
    followers.map((id) =>
      notify(
        req,
        id,
        'opportunity',
        'New opportunity from a startup you follow',
        record.title,
        record._id,
      ),
    ),
  );
}

async function claimCapacity(Model, filter, capacity, write) {
  if (!capacity) return write();
  const occupants = await Model.find(filter).select('capacitySlot').lean();
  const occupied = new Set(occupants.map((row) => row.capacitySlot).filter(Boolean));
  let unnumbered = occupants.length - occupied.size;
  // Reserve room for records accepted before capacity slots were introduced.
  for (let slot = 1; slot <= capacity; slot++) {
    if (occupied.has(slot)) continue;
    if (unnumbered > 0) {
      unnumbered--;
      continue;
    }
    try {
      return await write(slot);
    } catch (error) {
      if (error.code !== 11000 || !error.keyPattern?.capacitySlot) throw error;
    }
  }
  fail(409, 'This opportunity has reached its capacity.');
}
export const opportunities = Router();
opportunities.get('/', async (req, res) => {
  const options = query(req, {
    type: z.enum(['project', 'challenge']).optional(),
    skill: optional().optional(),
    workMode: z.enum(['remote', 'onsite', 'hybrid']).optional(),
  });
  const filter = { ...active(), startupId: { $in: await publicStartupIds() } };
  if (options.type) filter.type = options.type;
  if (options.workMode) filter.workMode = options.workMode;
  if (options.skill) filter.requiredSkills = new RegExp(escape(options.skill), 'i');
  if (options.q)
    filter.$or = ['title', 'description', 'requiredSkills'].map((field) => ({
      [field]: new RegExp(escape(options.q), 'i'),
    }));
  const result = await page(Opportunity, filter, options, 'title');
  await Opportunity.populate(result.items, { path: 'startupId', select: 'name slug' });
  send(res, result);
});
opportunities.get('/mine', ...role('startup'), async (req, res) =>
  send(
    res,
    await page(
      Opportunity,
      { startupId: { $in: await ownedStartupIds(req.user._id) } },
      query(req),
      'title',
    ),
  ),
);
opportunities.get('/manage/:id', ...role('startup'), async (req, res) =>
  send(res, await owned(req)),
);
opportunities.get('/:id', async (req, res) =>
  send(
    res,
    exists(
      await Opportunity.findOne({
        _id: param(req),
        ...active(),
        startupId: { $in: await publicStartupIds() },
      }).populate('startupId', 'name slug'),
    ),
  ),
);
opportunities.post('/', ...role('startup'), verified, async (req, res) => {
  const input = body(req, { startupId: oid, ...fields });
  await startupMember(req.user._id, input.startupId);
  await publication(input.startupId, input);
  const record = await Opportunity.create({
    ...input,
    createdBy: req.user._id,
    publishedAt: input.status === 'published' ? new Date() : undefined,
  });
  if (record.status === 'published')
    announce(req, record).catch(() => console.error('Opportunity notification failed.'));
  send(res, record, 201);
});
opportunities.patch('/:id', ...role('startup'), verified, async (req, res) => {
  const record = await owned(req);
  if (record.status === 'hidden') fail(403, 'This opportunity is hidden by moderation.');
  const { type, ...editable } = fields;
  const input = z.object(editable).partial().strict().parse(req.body);
  if (
    (record.publishedAt || record.status === 'published') &&
    input.capacity !== undefined &&
    input.capacity !== record.capacity
  ) {
    fail(409, 'Capacity is fixed after publication.');
  }
  await publication(record.startupId, { ...record.toObject(), ...input });
  const published = record.status !== 'published' && input.status === 'published';
  const updated = await Opportunity.findOneAndUpdate(
    { _id: record._id, status: record.status, updatedAt: record.updatedAt },
    {
      $set: { ...input, ...(published && !record.publishedAt ? { publishedAt: new Date() } : {}) },
    },
    { new: true },
  );
  if (!updated) fail(409, 'This opportunity changed. Reload it before saving.');
  if (published)
    announce(req, updated).catch(() => console.error('Opportunity notification failed.'));
  send(res, updated);
});
opportunities.delete('/:id', ...role('startup'), async (req, res) => {
  const record = await owned(req);
  if (record.status === 'hidden') fail(403, 'This opportunity is hidden by moderation.');
  record.status = 'closed';
  await record.save();
  send(res, null);
});
opportunities.post('/:id/apply', ...role('graduate'), verified, async (req, res) => {
  const record = await open(req, 'project');
  const input = body(req, {
    motivation: required(4000),
    skills: list.optional(),
    portfolioReferences: z.array(url).max(10).optional(),
    availability: required(100),
  });
  const application = await Application.create({
    ...input,
    opportunityId: record._id,
    graduateId: req.user._id,
  });
  await notify(
    req,
    record.createdBy,
    'application',
    'New project application',
    record.title,
    application._id,
  );
  send(res, application, 201);
});
opportunities.post('/:id/submissions', ...role('graduate'), verified, async (req, res) => {
  const record = await open(req, 'challenge');
  const input = body(req, {
    content: required(6000),
    repositoryUrl: url.optional(),
    demoUrl: url.optional(),
    attachments: z.array(attachment).max(5).optional(),
  });
  await validateAttachments(req.user._id, 'submission', input.attachments);
  const key = { challengeId: record._id };
  const submission = await claimCapacity(
    ChallengeSubmission,
    key,
    record.capacity,
    (capacitySlot) =>
      ChallengeSubmission.create({ ...input, ...key, capacitySlot, graduateId: req.user._id }),
  );
  await notify(
    req,
    record.createdBy,
    'submission',
    'New challenge submission',
    record.title,
    submission._id,
  );
  send(res, submission, 201);
});
async function includeApplicants(result) {
  const ids = result.items.map((row) => row.graduateId);
  const users = await User.find({ _id: { $in: ids } }).select('fullName');
  const names = new Map(users.map((user) => [String(user._id), user.fullName]));
  result.items.forEach((row) => {
    row.applicant = names.get(String(row.graduateId));
  });
  return result;
}
opportunities.get('/:id/applications', ...role('startup'), async (req, res) => {
  const record = await owned(req);
  send(
    res,
    await includeApplicants(await page(Application, { opportunityId: record._id }, query(req))),
  );
});
opportunities.get('/:id/submissions', ...role('startup'), async (req, res) => {
  const record = await owned(req);
  send(
    res,
    await includeApplicants(
      await page(ChallengeSubmission, { challengeId: record._id }, query(req)),
    ),
  );
});
export const applications = Router();
applications.get('/', ...role('graduate', 'startup'), async (req, res) => {
  const filter =
    req.user.role === 'graduate'
      ? { graduateId: req.user._id }
      : {
          opportunityId: {
            $in: await Opportunity.find({
              startupId: { $in: await ownedStartupIds(req.user._id) },
            }).distinct('_id'),
          },
        };
  const result = await page(Application, filter, query(req));
  await Application.populate(result.items, { path: 'opportunityId', select: 'title type' });
  send(res, req.user.role === 'startup' ? await includeApplicants(result) : result);
});
applications.patch('/:id/status', ...role('graduate', 'startup'), verified, async (req, res) => {
  const record = exists(await Application.findById(param(req)));
  const { status } = body(req, {
    status: z.enum([
      'under_review',
      'shortlisted',
      'accepted',
      'rejected',
      'withdrawn',
      'completed',
    ]),
  });
  const opportunity = exists(await Opportunity.findById(record.opportunityId));
  if (req.user.role === 'graduate') {
    if (!same(record.graduateId, req.user._id) || status !== 'withdrawn')
      fail(403, 'You can only withdraw your own application.');
  } else {
    await startupMember(req.user._id, opportunity.startupId);
    if (status === 'withdrawn') fail(403, 'Only applicants can withdraw.');
  }
  const review = (capacitySlot) =>
    Application.findOneAndUpdate(
      {
        _id: record._id,
        status: {
          $in: status === 'completed' ? ['accepted'] : ['submitted', 'under_review', 'shortlisted'],
        },
      },
      {
        $set: {
          status,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          ...(capacitySlot ? { capacitySlot } : {}),
        },
      },
      { new: true },
    );
  const updated =
    status === 'accepted'
      ? await claimCapacity(
          Application,
          { opportunityId: opportunity._id, status: { $in: ['accepted', 'completed'] } },
          opportunity.capacity,
          review,
        )
      : await review();
  if (!updated) fail(409, 'This application is already finalized.');
  await notify(
    req,
    status === 'withdrawn' ? opportunity.createdBy : record.graduateId,
    'application',
    'Application updated',
    opportunity.title,
    record._id,
  );
  send(res, updated);
});
export const submissions = Router();
submissions.get('/', ...role('graduate'), async (req, res) => {
  const result = await page(ChallengeSubmission, { graduateId: req.user._id }, query(req));
  await ChallengeSubmission.populate(result.items, { path: 'challengeId', select: 'title' });
  send(res, result);
});
submissions.patch('/:id/review', ...role('startup'), verified, async (req, res) => {
  const record = exists(await ChallengeSubmission.findById(param(req)));
  const opportunity = exists(await Opportunity.findById(record.challengeId));
  await startupMember(req.user._id, opportunity.startupId);
  const input = body(req, {
    score: z.number().min(0).max(100),
    feedback: required(4000),
    reviewStatus: z.enum(['reviewed', 'selected', 'declined']),
  });
  record.set({ ...input, reviewedBy: req.user._id });
  await record.save();
  await notify(
    req,
    record.graduateId,
    'submission',
    'Challenge reviewed',
    opportunity.title,
    record._id,
  );
  send(res, record);
});
