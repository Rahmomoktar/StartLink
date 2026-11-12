import { z } from 'zod';
import { Notification, User } from './models.js';

export const env = process.env;
export const origin = env.CLIENT_ORIGIN || 'http://localhost:5173';
export const production = env.NODE_ENV === 'production';
export const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const required = (max = 140) => z.string().trim().min(1).max(max);
export const optional = (max = 140) => z.string().trim().max(max);
export const meetsMandatorySkills = (profile, target) =>
  (target.mandatorySkills || []).every((skill) =>
    profile?.skills?.some(
      (candidate) => candidate.trim().toLowerCase() === skill.trim().toLowerCase(),
    ),
  );
export const list = z.array(required(100)).max(40);
export const url = z.url({ protocol: /^https?$/ }).or(z.literal(''));
export const privateReference = z.string().regex(/^asset:[a-f\d]{24}$/i);
export const attachment = url.or(privateReference);
export const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record ID');
export const parse = (schema, value) => schema.parse(value);
export const body = (req, fields) => parse(z.object(fields).strict(), req.body);
export const param = (req, name = 'id') => parse(oid, req.params[name]);
export const send = (res, data, status = 200) => res.status(status).json({ data });
export const exists = (record) => record || fail(404, 'Record not found.');
export const same = (a, b) => String(a) === String(b);
export const escape = (value) => value.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&');
export const query = (req, fields = {}) =>
  parse(
    z.object({
      q: optional(100).default(''),
      page: z.coerce.number().int().min(1).max(5000).default(1),
      sort: z.enum(['recent', 'name']).default('recent'),
      ...fields,
    }),
    req.query,
  );
export const page = async (Model, filter, options, name = 'name') => {
  const limit = 12;
  const [items, total] = await Promise.all([
    Model.find(filter)
      .sort(options.sort === 'name' ? { [name]: 1, _id: 1 } : { createdAt: -1, _id: -1 })
      .skip((options.page - 1) * limit)
      .limit(limit)
      .lean(),
    Model.countDocuments(filter),
  ]);
  return { items, total, page: options.page, pages: Math.ceil(total / limit) };
};
export const notify = async (req, recipientId, type, title, body, relatedEntityId) => {
  const user = await User.findById(recipientId).select('mutedNotifications');
  if (!user || user.mutedNotifications.includes(type)) return;
  const notification = await Notification.create({
    recipientId,
    type,
    title,
    body,
    relatedEntityId,
  });
  req.app
    .get('io')
    ?.to('user:' + recipientId)
    .emit('notification', notification);
};
