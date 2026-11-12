import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { role, auth, verified } from './auth.js';
import { ChallengeSubmission, Opportunity, PrivateFile, StartupMembership } from './models.js';
import { exists, fail, param, send, same } from './core.js';

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0 },
});
const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
export const files = Router();
files.post('/:purpose', ...role('graduate'), verified, receive.single('file'), async (req, res) => {
  const purpose = z.enum(['certificate', 'submission']).parse(req.params.purpose);
  if (!req.file) fail(422, 'Select a file.');
  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!allowed.has(type?.mime)) fail(415, 'Choose a PDF, JPEG, PNG or WebP file.');
  if ((await PrivateFile.countDocuments({ ownerId: req.user._id })) >= 100)
    fail(409, 'You have reached the attachment storage limit.');
  const filename =
    req.file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(-100) || 'attachment.' + type.ext;
  const record = await PrivateFile.create({
    ownerId: req.user._id,
    purpose,
    filename,
    contentType: type.mime,
    data: req.file.buffer,
  });
  send(res, { reference: 'asset:' + record._id, filename }, 201);
});
export async function validateAttachments(ownerId, purpose, items = []) {
  const ids = [
    ...new Set(items.filter((value) => value.startsWith('asset:')).map((value) => value.slice(6))),
  ];
  if (
    ids.length &&
    (await PrivateFile.countDocuments({ _id: { $in: ids }, ownerId, purpose })) !== ids.length
  )
    fail(422, 'An attachment is unavailable.');
}
async function reviewer(user, record) {
  if (record.purpose !== 'submission' || user.role !== 'startup') return false;
  const companies = await StartupMembership.find({ userId: user._id, status: 'active' }).distinct(
    'startupId',
  );
  const challenges = await Opportunity.find({
    startupId: { $in: companies },
    type: 'challenge',
  }).distinct('_id');
  return ChallengeSubmission.exists({
    challengeId: { $in: challenges },
    graduateId: record.ownerId,
    attachments: 'asset:' + record._id,
  });
}
files.get('/:id', auth, async (req, res) => {
  const record = exists(await PrivateFile.findById(param(req)));
  if (!same(record.ownerId, req.user._id) && !(await reviewer(req.user, record)))
    fail(404, 'File not found.');
  const file = exists(await PrivateFile.findById(record._id).select('+data'));
  res.set({ 'Cache-Control': 'private, no-store', 'X-Startlink-Filename': record.filename });
  res.attachment(record.filename).type(record.contentType).send(file.data);
});
