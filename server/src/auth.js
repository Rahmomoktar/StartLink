import { Router } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { ActionToken, RefreshSession, User } from './models.js';
import { body, env, fail, origin, production, required, send } from './core.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('hex');
const cookie = {
  httpOnly: true,
  secure: production,
  sameSite: production && env.COOKIE_SAME_SITE === 'none' ? 'none' : 'lax',
  path: '/api/v1/auth',
};
const cookieName = 'startlink_refresh';
const ttl = 14 * 24 * 60 * 60 * 1000;
const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z.string().min(12).max(128);
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: { message: 'Too many attempts. Try again later.' } },
});
const profile = ({ _id, fullName, email, role, emailVerified, avatar, mutedNotifications }) => ({
  _id,
  fullName,
  email,
  role,
  emailVerified,
  avatar,
  mutedNotifications,
});
const sign = (user, familyId) =>
  jwt.sign({ version: user.version, sid: familyId }, env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: '10m',
    algorithm: 'HS256',
    audience: 'startlink',
  });
export async function authenticate(token) {
  let claims;
  try {
    claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], audience: 'startlink' });
  } catch {
    fail(401, 'Please sign in.');
  }
  const [user, session] = await Promise.all([
    User.findOne({ _id: claims.sub, status: 'active', version: claims.version }),
    RefreshSession.exists({
      userId: claims.sub,
      familyId: claims.sid,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }),
  ]);
  if (!user || !session) fail(401, 'Please sign in.');
  return { user, familyId: claims.sid };
}
export const auth = async (req, res, next) => {
  const { user } = await authenticate(req.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]);
  req.user = user;
  next();
};
export const role = (...roles) => [
  auth,
  (req, res, next) => {
    if (!roles.includes(req.user.role)) fail(403, 'This action is unavailable for your account.');
    next();
  },
];
export const verified = (req, res, next) => {
  if (!req.user.emailVerified) fail(403, 'Verify your email to continue.');
  next();
};
const csrf = (req, res, next) => {
  if (req.get('origin') !== origin || req.get('x-startlink') !== '1')
    fail(403, 'Untrusted request origin.');
  next();
};
async function session(res, user, familyId = randomUUID(), expiresAt = new Date(Date.now() + ttl)) {
  const token = random();
  await RefreshSession.create({ userId: user._id, tokenHash: hash(token), familyId, expiresAt });
  res.cookie(cookieName, token, { ...cookie, expires: expiresAt });
  send(res, { user: profile(user), accessToken: sign(user, familyId) });
}
async function mail(user, type) {
  const token = random();
  await ActionToken.create({
    userId: user._id,
    type,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + 3600000),
  });
  const link = new URL(type === 'verify' ? '/verify-email' : '/reset-password', origin);
  link.searchParams.set('token', token);
  if (env.SMTP_URL && env.MAIL_FROM) {
    await nodemailer
      .createTransport(env.SMTP_URL)
      .sendMail({
        to: user.email,
        from: env.MAIL_FROM,
        subject:
          type === 'verify' ? 'Verify your STARTLINK email' : 'Reset your STARTLINK password',
        text: link.href,
      });
  } else if (!production && env.DEV_MAIL_LOG === 'true')
    console.info('[development email]', link.href);
}
function dispatch(user, type) {
  mail(user, type).catch(() => console.error('Account email delivery failed.'));
}
async function consume(token, type) {
  const record = await ActionToken.findOneAndDelete({
    tokenHash: hash(token),
    type,
    expiresAt: { $gt: new Date() },
  });
  if (!record) fail(400, 'This link is invalid or has expired.');
  return record.userId;
}
async function updatePassword(userId, value) {
  await User.updateOne(
    { _id: userId },
    { $set: { passwordHash: await argon2.hash(value) }, $inc: { version: 1 } },
  );
  await Promise.all([
    RefreshSession.updateMany({ userId }, { $set: { revokedAt: new Date() } }),
    ActionToken.deleteMany({ userId, type: 'reset' }),
  ]);
}
export const authRoutes = Router();
authRoutes.use(
  ['/register', '/login', '/forgot-password', '/reset-password', '/resend-verification'],
  limit,
);
authRoutes.post('/register', csrf, async (req, res) => {
  const input = body(req, {
    fullName: required(100),
    email,
    password,
    confirmPassword: password,
    role: z.enum(['graduate', 'startup']),
  });
  if (input.password !== input.confirmPassword) fail(422, 'Passwords must match.');
  const passwordHash = await argon2.hash(input.password);
  try {
    const user = await User.create({
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      passwordHash,
      emailVerified: false,
    });
    dispatch(user, 'verify');
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  send(res, { message: 'Check your email for a verification link. You can now sign in.' }, 202);
});
authRoutes.post('/login', csrf, async (req, res) => {
  const input = body(req, { email, password: z.string().min(1).max(128) });
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const dummy = await dummyPassword;
  const valid = await argon2.verify(user?.passwordHash || dummy, input.password);
  if (!user || !valid || user.status !== 'active') fail(401, 'Invalid email or password.');
  await session(res, user);
});
const dummyPassword = argon2.hash(random());
authRoutes.post('/refresh', csrf, async (req, res) => {
  const token = req.cookies[cookieName];
  if (typeof token !== 'string') fail(401, 'Please sign in.');
  const tokenHash = hash(token);
  const replacement = random();
  const current = await RefreshSession.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    {
      $set: { tokenHash: hash(replacement) },
      $push: { usedTokenHashes: { $each: [tokenHash], $slice: -3000 } },
    },
    { new: true },
  );
  if (!current) {
    await RefreshSession.updateOne(
      { usedTokenHashes: tokenHash },
      { $set: { revokedAt: new Date() } },
    );
    fail(401, 'Please sign in again.');
  }
  const user = await User.findOne({ _id: current.userId, status: 'active' });
  if (!user) fail(401, 'Please sign in.');
  res.cookie(cookieName, replacement, { ...cookie, expires: current.expiresAt });
  send(res, { user: profile(user), accessToken: sign(user, current.familyId) });
});
authRoutes.post('/logout', csrf, async (req, res) => {
  const token = req.cookies[cookieName];
  if (typeof token === 'string') {
    const found = await RefreshSession.findOne({
      $or: [{ tokenHash: hash(token) }, { usedTokenHashes: hash(token) }],
    });
    if (found) {
      await RefreshSession.updateOne(
        { familyId: found.familyId },
        { $set: { revokedAt: new Date() } },
      );
      req.app
        .get('io')
        ?.in('session:' + found.familyId)
        .disconnectSockets(true);
    }
  }
  res.clearCookie(cookieName, cookie);
  send(res, null);
});
authRoutes.get('/me', auth, (req, res) => send(res, profile(req.user)));
authRoutes.post('/resend-verification', auth, (req, res) => {
  if (!req.user.emailVerified) dispatch(req.user, 'verify');
  send(res, { message: 'If verification is pending, check your email.' }, 202);
});
authRoutes.post('/verify-email', async (req, res) => {
  const { token } = body(req, { token: required(64) });
  await User.updateOne({ _id: await consume(token, 'verify') }, { $set: { emailVerified: true } });
  send(res, { message: 'Email verified. You can now use collaboration features.' });
});
authRoutes.post('/forgot-password', async (req, res) => {
  const input = body(req, { email });
  User.findOne({ email: input.email, status: 'active' })
    .then((user) => {
      if (user) dispatch(user, 'reset');
    })
    .catch(() => console.error('Password reset lookup failed.'));
  send(res, { message: 'If an account exists, you will receive a password reset link.' }, 202);
});
authRoutes.post('/reset-password', async (req, res) => {
  const input = body(req, { token: required(64), password });
  await updatePassword(await consume(input.token, 'reset'), input.password);
  send(res, { message: 'Password updated. Sign in with your new password.' });
});
authRoutes.post('/change-password', auth, async (req, res) => {
  const input = body(req, { currentPassword: required(128), password });
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await argon2.verify(user.passwordHash, input.currentPassword)))
    fail(400, 'Current password is incorrect.');
  await updatePassword(user._id, input.password);
  req.app
    .get('io')
    ?.in('user:' + user._id)
    .disconnectSockets(true);
  res.clearCookie(cookieName, cookie);
  send(res, { message: 'Password updated. Sign in again.' });
});
