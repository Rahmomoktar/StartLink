import { Router } from 'express';
import { z } from 'zod';
import {
  Connection,
  Conversation,
  Message,
  Notification,
  Report,
  Startup,
  StartupMembership,
  User,
  GraduateProfile,
  Opportunity,
} from './models.js';
import { auth, role, verified } from './auth.js';
import {
  body,
  exists,
  fail,
  list,
  notify,
  oid,
  optional,
  param,
  query,
  required,
  same,
  send,
} from './core.js';
import { startupMember, visible } from './discovery.js';

export const connections = Router();
connections.get('/', ...role('graduate', 'startup'), async (req, res) => {
  const id = req.user._id;
  const rows = await Connection.find({ $or: [{ graduateId: id }, { startupUserId: id }] })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  const otherIds = rows.map((row) =>
    same(row.graduateId, id) ? row.startupUserId : row.graduateId,
  );
  const people = await User.find({ _id: { $in: otherIds } }).select('fullName');
  const names = new Map(people.map((user) => [String(user._id), user.fullName]));
  send(
    res,
    rows.map((row, index) => ({ ...row, otherName: names.get(String(otherIds[index])) })),
  );
});
connections.post('/', ...role('graduate', 'startup'), verified, async (req, res) => {
  const input = body(req, {
    startupId: oid,
    graduateId: oid.optional(),
    message: optional(1000).optional(),
  });
  exists(await Startup.findOne({ _id: input.startupId, ...visible }));
  let graduateId, startupUserId, recipientUserId;
  if (req.user.role === 'graduate') {
    graduateId = req.user._id;
    const members = await StartupMembership.find({ startupId: input.startupId, status: 'active' })
      .sort({ createdAt: 1 })
      .distinct('userId');
    const recipient = exists(
      await User.findOne({
        _id: { $in: members },
        role: 'startup',
        status: 'active',
        emailVerified: true,
      }),
    );
    startupUserId = recipient._id;
    recipientUserId = startupUserId;
  } else {
    await startupMember(req.user._id, input.startupId);
    const person = exists(
      await User.findOne({
        _id: input.graduateId,
        role: 'graduate',
        status: 'active',
        emailVerified: true,
      }),
    );
    exists(await GraduateProfile.findOne({ userId: person._id, visibility: true }));
    graduateId = person._id;
    startupUserId = req.user._id;
    recipientUserId = graduateId;
  }
  const key = { graduateId, startupId: input.startupId };
  const values = {
    startupUserId,
    recipientUserId,
    requestedBy: req.user._id,
    message: input.message || '',
    status: 'pending',
  };
  const row =
    (await Connection.findOneAndUpdate(
      { ...key, startupUserId, status: { $in: ['declined', 'cancelled', 'removed'] } },
      { $set: values, $unset: { respondedAt: 1 } },
      { new: true },
    )) || (await Connection.create({ ...key, ...values }));
  await notify(
    req,
    recipientUserId,
    'connection',
    'New connection request',
    req.user.fullName + ' would like to connect.',
    row._id,
  );
  send(res, row, 201);
});
const ownConnection = (req) =>
  Connection.findOne({
    _id: param(req),
    $or: [{ graduateId: req.user._id }, { startupUserId: req.user._id }],
  });
connections.patch('/:id', ...role('graduate', 'startup'), verified, async (req, res) => {
  const { status } = body(req, {
    status: z.enum(['accepted', 'declined', 'cancelled', 'blocked']),
  });
  const record = exists(await ownConnection(req));
  const actor = req.user._id;
  if (record.status === 'blocked') fail(409, 'This connection is blocked.');
  if (
    status !== 'blocked' &&
    (record.status !== 'pending' ||
      !same(status === 'cancelled' ? record.requestedBy : record.recipientUserId, actor))
  ) {
    fail(403, 'You cannot change this connection.');
  }
  const values = { status, respondedAt: new Date() };
  if (status === 'blocked') values.blockedBy = actor;
  const row = await Connection.findOneAndUpdate(
    { _id: record._id, status: record.status },
    { $set: values },
    { new: true },
  );
  if (!row) fail(409, 'The connection changed. Try again.');
  if (status === 'accepted') {
    await ensureConversation(row);
    await notify(
      req,
      row.requestedBy,
      'connection',
      'Connection accepted',
      req.user.fullName + ' accepted your request.',
      row._id,
    );
  }
  send(res, row);
});
connections.delete('/:id', ...role('graduate', 'startup'), async (req, res) => {
  const record = exists(await ownConnection(req));
  const result = await Connection.updateOne(
    { _id: record._id, status: 'accepted' },
    { $set: { status: 'removed' } },
  );
  if (!result.modifiedCount) fail(409, 'Only an accepted connection can be removed.');
  send(res, null);
});
async function ensureConversation(row) {
  await Conversation.updateOne(
    { connectionId: row._id },
    {
      $setOnInsert: { connectionId: row._id, lastMessageAt: new Date() },
      $set: { participants: [row.graduateId, row.startupUserId] },
    },
    { upsert: true },
  );
}
async function conversation(req) {
  const row = exists(await Conversation.findOne({ _id: param(req), participants: req.user._id }));
  const relationship = await Connection.findOne({ _id: row.connectionId, status: 'accepted' });
  if (
    !relationship ||
    !row.participants.some((id) => same(id, relationship.startupUserId)) ||
    !row.participants.some((id) => same(id, relationship.graduateId))
  )
    fail(403, 'This conversation is unavailable.');
  const recipient = row.participants.find((id) => !same(id, req.user._id));
  if (!(await User.exists({ _id: recipient, status: 'active' })))
    fail(403, 'This conversation is unavailable.');
  return { row, recipient };
}
export const conversations = Router();
conversations.use(auth);
conversations.get('/', async (req, res) => {
  const { q } = query(req);
  const relations = await Connection.find({
    status: 'accepted',
    $or: [{ graduateId: req.user._id }, { startupUserId: req.user._id }],
  }).limit(100);
  for (const relation of relations) {
    if (
      !(await Conversation.exists({
        connectionId: relation._id,
        participants: { $all: [relation.graduateId, relation.startupUserId] },
      }))
    )
      await ensureConversation(relation);
  }
  const rows = await Conversation.find({
    participants: req.user._id,
    connectionId: { $in: relations.map((row) => row._id) },
  })
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'fullName avatar status')
    .lean();
  const items = await Promise.all(
    rows.map(async (row) => {
      const other = row.participants.find((user) => !same(user._id, req.user._id));
      if (
        !other ||
        other.status !== 'active' ||
        !other.fullName.toLowerCase().includes(q.toLowerCase())
      )
        return null;
      const unread = await Message.countDocuments({
        conversationId: row._id,
        hiddenAt: null,
        senderId: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      });
      return {
        _id: row._id,
        other: { _id: other._id, fullName: other.fullName, avatar: other.avatar },
        lastMessageAt: row.lastMessageAt,
        unread,
      };
    }),
  );
  send(res, items.filter(Boolean));
});
conversations.get('/:id/messages', async (req, res) => {
  const { row } = await conversation(req);
  const { before } = query(req, { before: oid.optional() });
  const filter = { conversationId: row._id, hiddenAt: null };
  if (before) filter._id = { $lt: before };
  const messages = await Message.find(filter).sort({ _id: -1 }).limit(31).lean();
  const next = messages.length > 30 ? String(messages[29]._id) : null;
  send(res, { items: messages.slice(0, 30).reverse(), next });
});
conversations.post('/:id/messages', verified, async (req, res) => {
  const { row, recipient } = await conversation(req);
  const input = body(req, { body: required(2000) });
  const message = await Message.create({
    ...input,
    conversationId: row._id,
    senderId: req.user._id,
    readBy: [req.user._id],
  });
  await Conversation.updateOne({ _id: row._id }, { $max: { lastMessageAt: message.createdAt } });
  req.app
    .get('io')
    ?.to(['user:' + recipient, 'user:' + req.user._id])
    .emit('message', { conversationId: row._id });
  await notify(
    req,
    recipient,
    'message',
    'New message',
    'You have a new message from ' + req.user.fullName + '.',
    row._id,
  );
  send(res, message, 201);
});
conversations.patch('/:id/read', async (req, res) => {
  const { row, recipient } = await conversation(req);
  const { through } = body(req, { through: oid });
  const result = await Message.updateMany(
    {
      conversationId: row._id,
      _id: { $lte: through },
      senderId: { $ne: req.user._id },
      readBy: { $ne: req.user._id },
    },
    { $addToSet: { readBy: req.user._id } },
  );
  if (result.modifiedCount)
    req.app
      .get('io')
      ?.to('user:' + recipient)
      .emit('message', { conversationId: row._id });
  send(res, null);
});
export const notifications = Router();
notifications.use(auth);
notifications.get('/', async (req, res) => {
  const { page } = query(req);
  const key = { recipientId: req.user._id };
  const [items, unread, total] = await Promise.all([
    Notification.find(key)
      .sort({ createdAt: -1 })
      .skip((page - 1) * 20)
      .limit(20),
    Notification.countDocuments({ ...key, readAt: null }),
    Notification.countDocuments(key),
  ]);
  send(res, { items, unread, pages: Math.ceil(total / 20) });
});
notifications.patch('/read-all', async (req, res) => {
  await Notification.updateMany(
    { recipientId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  send(res, null);
});
notifications.patch('/preferences', async (req, res) => {
  const { mutedNotifications } = body(req, { mutedNotifications: list });
  await User.updateOne({ _id: req.user._id }, { $set: { mutedNotifications } });
  send(res, mutedNotifications);
});
notifications.patch('/:id/read', async (req, res) => {
  exists(
    await Notification.findOneAndUpdate(
      { _id: param(req), recipientId: req.user._id },
      { $set: { readAt: new Date() } },
    ),
  );
  send(res, null);
});
export const reports = Router();
reports.post('/', auth, verified, async (req, res) => {
  const input = body(req, {
    reportedEntityType: z.enum(['startup', 'opportunity', 'message']),
    reportedEntityId: oid,
    reason: required(100),
    description: optional(2000).optional(),
  });
  const key = { _id: input.reportedEntityId };
  if (input.reportedEntityType === 'startup') exists(await Startup.findOne({ ...key, ...visible }));
  if (input.reportedEntityType === 'opportunity')
    exists(await Opportunity.findOne({ ...key, status: 'published' }));
  if (input.reportedEntityType === 'message') {
    const message = exists(await Message.findOne(key));
    exists(await Conversation.findOne({ _id: message.conversationId, participants: req.user._id }));
  }
  send(res, await Report.create({ ...input, reporterId: req.user._id }), 201);
});
