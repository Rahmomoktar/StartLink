import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { ZodError } from 'zod';
import { auth, authRoutes, verified } from './auth.js';
import { graduateRoutes, startupRoutes } from './discovery.js';
import { applications, opportunities, submissions } from './opportunities.js';
import { matches } from './matching.js';
import { connections, conversations, notifications, reports } from './community.js';
import { admin } from './admin.js';
import { files } from './files.js';
import { env, fail, origin, production, send } from './core.js';

export const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(
  helmet(),
  cors({ origin, credentials: true, exposedHeaders: ['X-Startlink-Filename'] }),
  express.json({ limit: '128kb' }),
  cookieParser(),
);
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 240,
    message: { error: { message: 'Too many requests. Try again shortly.' } },
  }),
);
const api = express.Router();
app.use('/api/v1', api);
api.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  send(res, { status: ready ? 'ok' : 'database unavailable' }, ready ? 200 : 503);
});
for (const [path, router] of Object.entries({
  auth: authRoutes,
  startups: startupRoutes,
  graduates: graduateRoutes,
  opportunities,
  applications,
  submissions,
  matches,
  connections,
  conversations,
  notifications,
  reports,
  admin,
  files,
}))
  api.use('/' + path, router);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0 },
});
api.post('/uploads/image', auth, verified, upload.single('file'), async (req, res) => {
  if (!env.CLOUDINARY_URL) fail(503, 'Media storage is unavailable.');
  if (!req.file) fail(422, 'Select an image.');
  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type?.mime))
    fail(415, 'Choose a JPEG, PNG or WebP image.');
  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'startlink', resource_type: 'image' }, (error, value) =>
        error ? reject(error) : resolve(value),
      )
      .end(req.file.buffer);
  });
  send(res, { url: result.secure_url }, 201);
});
app.use((req, res) => res.status(404).json({ error: { message: 'Endpoint not found.' } }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError)
    return res
      .status(422)
      .json({
        error: {
          message: 'Check the submitted values.',
          fields: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
  if (error.code === 11000)
    return res.status(409).json({ error: { message: 'This record already exists.' } });
  if (error instanceof multer.MulterError)
    return res.status(422).json({ error: { message: 'Choose one image up to 4 MB.' } });
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(production ? 'API request failed: ' + error.name : error);
  return res
    .status(status)
    .json({ error: { message: status === 500 ? 'Something went wrong.' : error.message } });
});
