import { Router } from 'express';
import { z } from 'zod';
import {
  AuditLog,
  Category,
  Connection,
  Message,
  Opportunity,
  RefreshSession,
  Report,
  Startup,
  StartupMembership,
  User,
  Video,
} from './models.js';
import { role, verified } from './auth.js';
import { body, exists, notify, oid, page, param, query, required, send } from './core.js';
import { active } from './discovery.js';
import { reviewVideo } from './videos.js';

export const admin = Router();
admin.use(...role('admin'), verified);
const audit = (req, action, entityType, entityId, metadata) =>
  AuditLog.create({ actorId: req.user._id, action, entityType, entityId, metadata });
admin.get('/dashboard', async (req, res) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 29);
  const previousStart = new Date(start);
  previousStart.setUTCDate(previousStart.getUTCDate() - 30);
  const metrics = [
    ['Graduates', User, { role: 'graduate' }],
    ['Startups', Startup, {}],
    ['Verified startups', Startup, { verificationStatus: 'verified' }],
    ['Active projects', Opportunity, { ...active(), type: 'project' }],
    ['Accepted connections', Connection, { status: 'accepted' }],
    ['Pending reports', Report, { status: 'pending' }],
  ];
  const startupFields = 'name slug industry logo sample founders verificationStatus createdAt';
  const [counts, growth, pendingVerifications, verificationRequests, recentStartups, series] =
    await Promise.all([
      Promise.all(
        metrics.map(async ([name, Model, filter]) => [name, await Model.countDocuments(filter)]),
      ),
      Promise.all(
        metrics.slice(0, 5).map(async ([name, Model, filter]) => {
          const [period] = await Model.aggregate([
            { $match: { ...filter, createdAt: { $gte: previousStart } } },
            {
              $group: {
                _id: null,
                current: { $sum: { $cond: [{ $gte: ['$createdAt', start] }, 1, 0] } },
                previous: { $sum: { $cond: [{ $lt: ['$createdAt', start] }, 1, 0] } },
              },
            },
          ]);
          return [
            name,
            period?.previous ? Math.round((period.current / period.previous - 1) * 100) : null,
          ];
        }),
      ),
      Startup.countDocuments({ verificationStatus: 'pending' }),
      Startup.find({ verificationStatus: { $in: ['pending', 'verified', 'rejected'] } })
        .select(startupFields)
        .sort({ createdAt: -1, _id: -1 })
        .limit(3)
        .lean(),
      Startup.find({}).select(startupFields).sort({ createdAt: -1, _id: -1 }).limit(3).lean(),
      Promise.all(
        [User, Startup, Opportunity, Connection].map((Model) =>
          Model.aggregate([
            { $match: { createdAt: { $gte: start } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                total: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ]),
        ),
      ),
    ]);
  send(res, {
    counts: Object.fromEntries(counts),
    growth: Object.fromEntries(growth),
    series,
    activityThrough: today.toISOString().slice(0, 10),
    pendingVerifications,
    verificationRequests,
    recentStartups,
  });
});
admin.get('/users', async (req, res) => send(res, await page(User, {}, query(req), 'fullName')));
admin.get('/startups', async (req, res) => {
  const options = query(req, { startup: oid.optional() });
  send(res, await page(Startup, options.startup ? { _id: options.startup } : {}, options));
});
admin.get('/startups/pending', async (req, res) =>
  send(res, await page(Startup, { verificationStatus: 'pending' }, query(req))),
);
admin.get('/opportunities', async (req, res) =>
  send(res, await page(Opportunity, {}, query(req), 'title')),
);
admin.get('/reports', async (req, res) => send(res, await page(Report, {}, query(req))));
admin.get('/audit-logs', async (req, res) => send(res, await page(AuditLog, {}, query(req))));
admin.get('/categories', async (req, res) => send(res, await page(Category, {}, query(req))));
admin.post('/categories', async (req, res) => {
  const item = await Category.create(body(req, { name: required(80) }));
  await audit(req, 'category.create', 'category', item._id);
  send(res, item, 201);
});
admin.delete('/categories/:id', async (req, res) => {
  const item = exists(await Category.findByIdAndDelete(param(req)));
  await audit(req, 'category.delete', 'category', item._id);
  send(res, null);
});
admin.patch('/users/:id/status', async (req, res) => {
  const { status } = body(req, { status: z.enum(['active', 'suspended']) });
  const item = exists(
    await User.findOneAndUpdate(
      { _id: param(req), role: { $ne: 'admin' } },
      { $set: { status }, $inc: { version: 1 } },
      { new: true },
    ),
  );
  await RefreshSession.updateMany({ userId: item._id }, { $set: { revokedAt: new Date() } });
  req.app
    .get('io')
    ?.in('user:' + item._id)
    .disconnectSockets(true);
  await audit(req, 'user.status', 'user', item._id, { status });
  send(res, item);
});
admin.patch('/startups/:id/verification', async (req, res) => {
  const { verificationStatus } = body(req, {
    verificationStatus: z.enum(['verified', 'rejected', 'pending']),
  });
  const item = exists(
    await Startup.findByIdAndUpdate(param(req), { $set: { verificationStatus } }, { new: true }),
  );
  await audit(req, 'startup.verification', 'startup', item._id, { verificationStatus });
  const members = await StartupMembership.find({ startupId: item._id, status: 'active' }).distinct(
    'userId',
  );
  await Promise.all(
    members.map((id) =>
      notify(
        req,
        id,
        'verification',
        'Startup verification updated',
        item.name + ' is ' + verificationStatus + '.',
        item._id,
      ),
    ),
  );
  send(res, item);
});
admin.patch('/opportunities/:id/status', async (req, res) => {
  const { status } = body(req, { status: z.enum(['hidden', 'closed', 'draft']) });
  const item = exists(
    await Opportunity.findByIdAndUpdate(param(req), { $set: { status } }, { new: true }),
  );
  await audit(req, 'opportunity.status', 'opportunity', item._id, { status });
  send(res, item);
});
const reportModels = { startup: Startup, opportunity: Opportunity, message: Message };
admin.get('/reports/:id/content', async (req, res) => {
  const report = exists(await Report.findById(param(req)));
  if (report.reportedEntityType === 'video') return send(res, await reviewVideo(report, req.user));
  const content = await reportModels[report.reportedEntityType]
    .findById(report.reportedEntityId)
    .select('name title description body hiddenAt status visibility')
    .lean();
  send(res, content || { missing: true });
});
admin.patch('/reports/:id', async (req, res) => {
  const { status, hide } = body(req, {
    status: z.enum(['resolved', 'dismissed']),
    hide: z.boolean().optional(),
  });
  if (hide && status === 'resolved') {
    const report = exists(await Report.findById(param(req)));
    const update = {
      startup: { visibility: false },
      opportunity: { status: 'hidden' },
      message: { hiddenAt: new Date() },
    }[report.reportedEntityType];
    if (report.reportedEntityType === 'video') {
      await Video.updateOne(
        { _id: report.reportedEntityId, assetKey: report.videoVersion },
        { hidden: true },
      );
    } else {
      await reportModels[report.reportedEntityType].updateOne(
        { _id: report.reportedEntityId },
        { $set: update },
      );
    }
    await audit(req, 'content.hide', report.reportedEntityType, report.reportedEntityId);
  }
  const item = exists(
    await Report.findByIdAndUpdate(
      param(req),
      { $set: { status, reviewedBy: req.user._id } },
      { new: true },
    ),
  );
  await audit(req, 'report.review', 'report', item._id, { status });
  send(res, item);
});
