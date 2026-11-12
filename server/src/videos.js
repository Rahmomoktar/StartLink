import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromFile } from 'file-type';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { auth, verified } from './auth.js';
import { body, env, exists, fail, production, same, send } from './core.js';
import { publicTalent, visible } from './discovery.js';
import { GraduateProfile, Report, Startup, StartupMembership, User, Video } from './models.js';

export const videos = Router();
const maxSize = 32 * 1024 * 1024;
const limits = { promo: 300, startup: 180, graduate: 120 };
const formats = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
const localRoot = resolve(env.VIDEO_DEV_DIR || '../.startlink-media');
const ffmpeg = env.VIDEO_DEV_FFMPEG;
const local = !production && !!ffmpeg;
const run = promisify(execFile);
const cloudOptions = { resource_type: 'video', type: 'authenticated' };
const posterTransform = { format: 'jpg', width: 960, crop: 'limit', start_offset: 'auto' };
const parseUpload = multer({
  dest: tmpdir(),
  limits: { fileSize: maxSize, files: 1, fields: 1 },
}).single('file');

function slot(req) {
  const { kind, subject } = req.params;
  if (
    !Object.hasOwn(limits, kind) ||
    (kind === 'promo' ? subject !== 'official' : !/^[a-f\d]{24}$/i.test(subject))
  )
    fail(404, 'Video section not found.');
  return { kind, subject };
}
async function canManage({ kind, subject }, user) {
  if (!user?.emailVerified) return false;
  if (kind === 'promo') return user.role === 'admin';
  if (kind === 'graduate')
    return (
      user.role === 'graduate' &&
      same(user._id, subject) &&
      !!(await GraduateProfile.exists({ userId: subject }))
    );
  return (
    user.role === 'startup' &&
    !!(await StartupMembership.exists({
      startupId: subject,
      userId: user._id,
      status: 'active',
      membershipRole: { $in: ['owner', 'admin'] },
    }))
  );
}
async function canWatch(video, user) {
  if (user?.role === 'admin' && user.emailVerified) return true;
  if (video.hidden) return false;
  if (await canManage(video, user)) return true;
  if (video.visibility !== 'public') return false;
  if (video.kind === 'promo') return true;
  if (video.kind === 'startup') return !!(await Startup.exists({ _id: video.subject, ...visible }));
  if (!['startup', 'admin'].includes(user?.role)) return false;
  const eligible = await publicTalent();
  return (
    eligible.some((id) => same(id, video.subject)) &&
    !!(await GraduateProfile.exists({ userId: video.subject, visibility: true }))
  );
}
const noCache = (res) => res.set('Cache-Control', 'private, no-store');
function summary(video, user) {
  const token = jwt.sign(
    { video: String(video._id), asset: video.assetKey, viewer: user ? String(user._id) : null },
    env.JWT_SECRET,
    { algorithm: 'HS256', audience: 'startlink-media', expiresIn: '30m' },
  );
  const path = '/videos/play/' + token;
  return {
    id: video._id,
    version: video.assetKey,
    duration: video.duration,
    visibility: video.visibility,
    hidden: video.hidden,
    url: path + '/video',
    thumbnail: path + '/poster',
  };
}
export const reviewVideo = async (report, user) => {
  const item = await Video.findOne({ _id: report.reportedEntityId, assetKey: report.videoVersion });
  return item
    ? { name: 'Reported introduction video', video: summary(item, user) }
    : { missing: true };
};

async function removeAsset(video) {
  try {
    if (video.provider === 'local') {
      await Promise.all([
        rm(resolve(localRoot, video.assetKey + '.' + video.format), { force: true }),
        rm(resolve(localRoot, video.assetKey + '.jpg'), { force: true }),
      ]);
    } else {
      await cloudinary.uploader.destroy(video.assetKey, { ...cloudOptions, invalidate: true });
    }
  } catch {
    console.error('Unable to remove an obsolete video asset.');
  }
}
async function storeVideo(file, format, kind) {
  const record = {
    assetKey: randomUUID(),
    format,
    provider: env.CLOUDINARY_URL ? 'cloudinary' : 'local',
  };
  try {
    if (record.provider === 'cloudinary') {
      const uploaded = await cloudinary.uploader.upload(file.path, {
        ...cloudOptions,
        public_id: 'startlink/videos/' + record.assetKey,
        overwrite: false,
        eager: [posterTransform],
      });
      record.assetKey = uploaded.public_id;
      record.storageUrl = uploaded.secure_url;
      record.duration = uploaded.duration;
      if (!uploaded.width || !uploaded.height || uploaded.format !== format)
        fail(422, 'The file must contain a supported video track.');
    } else {
      await mkdir(localRoot, { recursive: true });
      const poster = resolve(localRoot, record.assetKey + '.jpg');
      let stderr;
      try {
        ({ stderr } = await run(
          ffmpeg,
          [
            '-nostdin',
            '-hide_banner',
            '-i',
            file.path,
            '-map',
            '0:v:0',
            '-frames:v',
            '1',
            '-vf',
            'scale=960:-2',
            '-y',
            poster,
          ],
          { timeout: 20000, windowsHide: true },
        ));
      } catch {
        fail(422, 'The file must contain a readable video track.');
      }
      const match = stderr.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/);
      if (match)
        record.duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      if (record.duration > 0 && record.duration <= limits[kind])
        await copyFile(file.path, resolve(localRoot, record.assetKey + '.' + format));
    }
    if (!Number.isFinite(record.duration) || record.duration <= 0 || record.duration > limits[kind])
      fail(422, 'Choose a video up to ' + limits[kind] + ' seconds.');
    return record;
  } catch (error) {
    await removeAsset(record);
    if (!error.status) fail(502, 'Video storage could not process this file.');
    throw error;
  }
}
function receive(req, res, next) {
  parseUpload(req, res, (error) => {
    if (!error) return next();
    next(Object.assign(new Error('Choose one MP4 or WebM video up to 32 MB.'), { status: 422 }));
  });
}
async function manage(req, res, next) {
  req.videoSlot = slot(req);
  if (!(await canManage(req.videoSlot, req.user))) fail(403, 'You do not manage this video.');
  next();
}
videos.get('/play/:token/:part', async (req, res, next) => {
  let claims;
  try {
    claims = jwt.verify(req.params.token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'startlink-media',
    });
  } catch {
    fail(403, 'This video link expired.');
  }
  const video = exists(await Video.findOne({ _id: claims.video, assetKey: claims.asset }));
  const viewer = claims.viewer
    ? await User.findOne({ _id: claims.viewer, status: 'active' })
    : null;
  if (!(await canWatch(video, viewer))) fail(404, 'Video not found.');
  const poster = req.params.part === 'poster';
  if (!poster && req.params.part !== 'video') fail(404, 'Video not found.');
  noCache(res);
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  if (video.provider === 'local') {
    return res.sendFile(
      resolve(localRoot, video.assetKey + '.' + (poster ? 'jpg' : video.format)),
      { cacheControl: false, dotfiles: 'allow' },
      (error) => {
        if (error) next(error);
      },
    );
  }
  if (poster) {
    return res.redirect(
      cloudinary.url(video.assetKey, {
        ...cloudOptions,
        ...posterTransform,
        secure: true,
        sign_url: true,
      }),
    );
  }
  return res.redirect(
    cloudinary.utils.private_download_url(video.assetKey, video.format, {
      ...cloudOptions,
      expires_at: Math.floor(Date.now() / 1000) + 120,
    }),
  );
});
videos.get('/:kind/:subject', async (req, res) => {
  const target = slot(req);
  let viewer;
  if (req.get('authorization'))
    await auth(req, res, () => {
      viewer = req.user;
    });
  const video = await Video.findOne(target);
  noCache(res);
  send(res, video && (await canWatch(video, viewer)) ? summary(video, viewer) : null);
});
videos.get('/:kind/:subject/manage', auth, verified, manage, async (req, res) => {
  const video = await Video.findOne(req.videoSlot);
  noCache(res);
  send(res, {
    video: video ? summary(video, req.user) : null,
    available: local || !!env.CLOUDINARY_URL,
  });
});
videos.put(
  '/:kind/:subject',
  auth,
  verified,
  manage,
  rateLimit({ windowMs: 60000, limit: 6 }),
  (req, res, next) => {
    if (!local && !env.CLOUDINARY_URL) fail(503, 'Video storage is unavailable.');
    next();
  },
  receive,
  async (req, res) => {
    const { file, videoSlot: target } = req;
    try {
      if (!file) fail(422, 'Select a video file.');
      const { visibility } = body(req, { visibility: z.enum(['public', 'restricted']) });
      const type = await fileTypeFromFile(file.path).catch(() => undefined);
      const format = formats[type?.mime];
      if (!format) fail(415, 'Choose an MP4 or WebM video.');
      const previous = await Video.findOne(target);
      const asset = await storeVideo(file, format, target.kind);
      let video;
      try {
        const values = {
          ...asset,
          visibility: target.kind === 'promo' ? 'public' : visibility,
          hidden: false,
        };
        video = previous
          ? await Video.findOneAndUpdate(
              { _id: previous._id, assetKey: previous.assetKey },
              values,
              { new: true },
            )
          : await Video.create({ ...target, ...values });
        if (!video) fail(409, 'The video changed. Try again.');
      } catch (error) {
        await removeAsset(asset);
        throw error;
      }
      if (previous) await removeAsset(previous);
      send(res, summary(video, req.user), 201);
    } finally {
      if (file) await rm(file.path, { force: true }).catch(() => {});
    }
  },
);
videos.patch('/:kind/:subject', auth, verified, manage, async (req, res) => {
  const { visibility } = body(req, { visibility: z.enum(['public', 'restricted']) });
  if (req.videoSlot.kind === 'promo') fail(422, 'The promotional video is public.');
  const video = exists(await Video.findOneAndUpdate(req.videoSlot, { visibility }, { new: true }));
  send(res, summary(video, req.user));
});
videos.delete('/:kind/:subject', auth, verified, manage, async (req, res) => {
  const video = await Video.findOneAndDelete(req.videoSlot);
  if (video) await removeAsset(video);
  send(res, null);
});
videos.post('/:kind/:subject/report', auth, verified, async (req, res) => {
  const { reason, version } = body(req, {
    reason: z.string().trim().min(3).max(140),
    version: z.string().min(1),
  });
  const video = exists(await Video.findOne(slot(req)));
  if (video.assetKey !== version || !(await canWatch(video, req.user)) || video.hidden)
    fail(404, 'Video not found.');
  const target = {
    reportedEntityType: 'video',
    reportedEntityId: video._id,
    videoVersion: video.assetKey,
    reporterId: req.user._id,
    status: 'pending',
  };
  const report = await Report.findOneAndUpdate(
    target,
    { $setOnInsert: { ...target, reason } },
    { upsert: true, new: true },
  );
  send(res, { id: report._id }, 201);
});
