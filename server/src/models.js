import mongoose from 'mongoose';
const { Schema } = mongoose;
const id = Schema.Types.ObjectId;
const model = (name, fields, indexes = []) => {
  const schema = new Schema(fields, { timestamps: true });
  for (const [keys, options] of indexes) schema.index(keys, options);
  return mongoose.model(name, schema);
};
const unique = (keys) => [keys, { unique: true }];
export const User = model('User', {
  fullName: String,
  email: { type: String, unique: true },
  passwordHash: { type: String, select: false },
  role: { type: String, enum: ['graduate', 'startup', 'admin'] },
  emailVerified: Boolean,
  status: { type: String, default: 'active' },
  avatar: String,
  version: { type: Number, default: 0 },
  mutedNotifications: [String],
});
export const GraduateProfile = model(
  'GraduateProfile',
  {
    userId: { type: id, unique: true, ref: 'User' },
    headline: String,
    bio: String,
    education: [String],
    skills: [String],
    certificates: [String],
    portfolioProjects: [
      {
        title: String,
        description: String,
        technologies: [String],
        screenshots: [String],
        repositoryUrl: String,
        demoUrl: String,
      },
    ],
    interests: [String],
    preferredIndustries: [String],
    location: String,
    availability: String,
    workMode: String,
    github: String,
    linkedin: String,
    visibility: { type: Boolean, default: false },
  },
  [[{ visibility: 1, skills: 1 }]],
);
export const Startup = model('Startup', {
  name: String,
  slug: { type: String, unique: true },
  description: String,
  industry: { type: String, index: true },
  location: String,
  website: String,
  logo: String,
  banner: String,
  founders: [String],
  startupStage: String,
  requiredSkills: [String],
  preferredSkills: [String],
  verificationStatus: { type: String, default: 'pending', index: true },
  visibility: { type: Boolean, default: true },
  sample: Boolean,
});
export const StartupMembership = model(
  'StartupMembership',
  {
    userId: id,
    startupId: id,
    membershipRole: String,
    status: String,
    invitedBy: id,
  },
  [unique({ userId: 1, startupId: 1 })],
);
export const Opportunity = model(
  'Opportunity',
  {
    startupId: { type: id, ref: 'Startup', index: true },
    createdBy: id,
    type: String,
    title: String,
    description: String,
    category: String,
    instructions: String,
    requiredSkills: [String],
    mandatorySkills: [String],
    preferredSkills: [String],
    deliverables: [String],
    workMode: String,
    location: String,
    duration: String,
    compensation: String,
    deadline: Date,
    capacity: Number,
    publishedAt: Date,
    evaluationCriteria: [String],
    terms: String,
    availability: String,
    status: { type: String, default: 'draft' },
  },
  [[{ status: 1, type: 1, deadline: 1 }]],
);
export const Application = model(
  'Application',
  {
    opportunityId: { type: id, ref: 'Opportunity' },
    graduateId: id,
    motivation: String,
    skills: [String],
    portfolioReferences: [String],
    availability: String,
    status: { type: String, default: 'submitted' },
    reviewedBy: id,
    reviewedAt: Date,
    capacitySlot: Number,
  },
  [
    unique({ opportunityId: 1, graduateId: 1 }),
    [
      { opportunityId: 1, capacitySlot: 1 },
      { unique: true, partialFilterExpression: { capacitySlot: { $exists: true } } },
    ],
  ],
);
export const ChallengeSubmission = model(
  'ChallengeSubmission',
  {
    challengeId: { type: id, ref: 'Opportunity' },
    graduateId: id,
    content: String,
    repositoryUrl: String,
    demoUrl: String,
    attachments: [String],
    score: Number,
    feedback: String,
    reviewedBy: id,
    reviewStatus: { type: String, default: 'submitted' },
    capacitySlot: Number,
  },
  [
    unique({ challengeId: 1, graduateId: 1 }),
    [
      { challengeId: 1, capacitySlot: 1 },
      { unique: true, partialFilterExpression: { capacitySlot: { $exists: true } } },
    ],
  ],
);
export const Connection = model(
  'Connection',
  {
    graduateId: id,
    startupId: id,
    startupUserId: id,
    requestedBy: id,
    recipientUserId: id,
    message: String,
    status: String,
    respondedAt: Date,
    blockedBy: id,
  },
  [unique({ graduateId: 1, startupId: 1 }), [{ startupUserId: 1, status: 1 }]],
);
export const Conversation = model(
  'Conversation',
  {
    participants: [{ type: id, ref: 'User' }],
    connectionId: { type: id, unique: true },
    lastMessageAt: Date,
  },
  [[{ participants: 1, lastMessageAt: -1 }]],
);
export const Message = model(
  'Message',
  {
    conversationId: id,
    senderId: id,
    body: String,
    readBy: [id],
    hiddenAt: Date,
  },
  [[{ conversationId: 1, _id: -1 }]],
);
export const Notification = model(
  'Notification',
  {
    recipientId: id,
    type: String,
    title: String,
    body: String,
    relatedEntityId: id,
    readAt: Date,
  },
  [[{ recipientId: 1, readAt: 1, createdAt: -1 }]],
);
export const StartupFollow = model(
  'StartupFollow',
  { graduateId: id, startupId: { type: id, ref: 'Startup' } },
  [unique({ graduateId: 1, startupId: 1 })],
);
export const Report = model('Report', {
  reporterId: id,
  reportedEntityType: String,
  reportedEntityId: id,
  reason: String,
  description: String,
  status: { type: String, default: 'pending' },
  reviewedBy: id,
});
export const RefreshSession = model(
  'RefreshSession',
  {
    userId: id,
    tokenHash: { type: String, unique: true },
    familyId: { type: String, unique: true },
    usedTokenHashes: [String],
    expiresAt: { type: Date, expires: 0 },
    revokedAt: Date,
  },
  [[{ usedTokenHashes: 1 }]],
);
export const ActionToken = model('ActionToken', {
  userId: id,
  type: String,
  tokenHash: { type: String, unique: true },
  expiresAt: { type: Date, expires: 0 },
});
export const AuditLog = model('AuditLog', {
  actorId: id,
  action: String,
  entityType: String,
  entityId: id,
  metadata: Schema.Types.Mixed,
});
export const Category = model('Category', { name: { type: String, unique: true } });
export const PrivateFile = model('PrivateFile', {
  ownerId: { type: id, index: true },
  purpose: { type: String, enum: ['certificate', 'submission'] },
  filename: String,
  contentType: String,
  data: { type: Buffer, select: false },
});
