import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, StartupMembership } from '../src/models.js';
import { origin } from '../src/core.js';

let mongo, app;
const password = 'integration-only-phrase';
const account = (role) => ({
  fullName: 'Test ' + role,
  email: role + '@example.test',
  password,
  confirmPassword: password,
  role,
});
const access = (token) => ({ Authorization: 'Bearer ' + token });
const browser = { Origin: origin, 'X-Startlink': '1' };
const api = '/api/v1';
let graduate,
  startup,
  admin,
  secondStartup,
  secondGraduate,
  company,
  project,
  challenge,
  application,
  connection,
  conversation;
const auth = (path, payload) =>
  request(app)
    .post(api + '/auth/' + path)
    .set(browser)
    .send(payload || {});
async function login(email) {
  const result = await auth('login', { email, password }).expect(200);
  return {
    token: result.body.data.accessToken,
    cookie: result.headers['set-cookie'][0].split(';')[0],
    user: result.body.data.user,
  };
}
const call = (method, path, person, data) =>
  request(app)
    [method](api + path)
    .set(person ? access(person.token) : {})
    .send(data);
beforeAll(async () => {
  process.env.JWT_SECRET = 'integration-secret-for-startlink-testing-only';
  mongo = process.env.TEST_MONGODB_URI ? null : await MongoMemoryServer.create();
  await mongoose.connect(process.env.TEST_MONGODB_URI || mongo.getUri(), {
    dbName: 'startlink_test_' + Date.now(),
  });
  await Promise.all(Object.values(mongoose.models).map((Model) => Model.init()));
  ({ app } = await import('../src/app.js'));
}, 180000);
afterAll(async () => {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongo?.stop();
});
describe.sequential('STARTLINK platform', () => {
  test('registers graduate and startup accounts and denies public administrator registration', async () => {
    for (const role of ['graduate', 'startup']) await auth('register', account(role)).expect(202);
    await auth('register', account('admin')).expect(422);
    await auth('login', { email: account('graduate').email, password: 'bad-password' }).expect(401);
    const passwordHash = await argon2.hash(password);
    await User.updateMany({}, { $set: { emailVerified: true } });
    await User.create({
      fullName: 'Test Admin',
      email: 'admin@example.test',
      role: 'admin',
      emailVerified: true,
      passwordHash,
    });
    await User.create({
      fullName: 'Second startup',
      email: 'second@example.test',
      role: 'startup',
      emailVerified: true,
      passwordHash,
    });
    await User.create({
      fullName: 'Second graduate',
      email: 'second-graduate@example.test',
      role: 'graduate',
      emailVerified: true,
      passwordHash,
    });
    graduate = await login(account('graduate').email);
    startup = await login(account('startup').email);
    admin = await login('admin@example.test');
    secondStartup = await login('second@example.test');
    secondGraduate = await login('second-graduate@example.test');
    await call('get', '/admin/dashboard', graduate).expect(403);
    await call('get', '/auth/me', null).expect(401);
  });
  test('rotates the refresh cookie and invalidates a replayed family', async () => {
    const session = await login(account('graduate').email);
    await request(app)
      .post(api + '/auth/refresh')
      .set('Cookie', session.cookie)
      .expect(403);
    const renewed = await auth('refresh').set('Cookie', session.cookie).expect(200);
    expect(renewed.headers['set-cookie'][0]).not.toContain(session.cookie);
    await auth('refresh').set('Cookie', session.cookie).expect(401);
    await call('get', '/auth/me', { token: renewed.body.data.accessToken }).expect(401);
  });
  test('saves profile and verifies startup membership and publication permissions', async () => {
    await call('patch', '/graduates/me', graduate, {
      skills: ['JavaScript'],
      visibility: true,
      headline: 'Developer',
    }).expect(200);
    const created = await call('post', '/startups', startup, {
      name: 'Test Company',
      description: 'Makes tools',
      industry: 'Technology',
      location: 'Nairobi',
      requiredSkills: ['React', 'JavaScript'],
    }).expect(201);
    company = created.body.data;
    expect(
      await StartupMembership.countDocuments({ startupId: company._id, userId: startup.user._id }),
    ).toBe(1);
    await call('patch', '/startups/' + company._id, secondStartup, { name: 'Impersonated' }).expect(
      403,
    );
    const payload = {
      startupId: company._id,
      title: 'Build a form',
      description: 'Develop an accessible form',
      requiredSkills: ['React', 'JavaScript'],
      workMode: 'remote',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      terms: 'Paid project. Authors retain rights.',
      status: 'published',
    };
    await call('post', '/opportunities', startup, { ...payload, type: 'project' }).expect(403);
    await call('patch', '/admin/startups/' + company._id + '/verification', admin, {
      verificationStatus: 'verified',
    }).expect(200);
    project = (
      await call('post', '/opportunities', startup, { ...payload, type: 'project' }).expect(201)
    ).body.data;
    challenge = (
      await call('post', '/opportunities', startup, {
        ...payload,
        type: 'challenge',
        title: 'Review a form',
        capacity: 1,
        instructions: 'Review an example in 30 minutes.',
        evaluationCriteria: ['Accessibility'],
      }).expect(201)
    ).body.data;
    await call('patch', '/opportunities/' + project._id, secondStartup, {
      title: 'Hijacked',
    }).expect(403);
  });
  test('tracks project applications and private challenge reviews', async () => {
    const data = { motivation: 'I enjoy building forms.', availability: 'Part time' };
    const path = '/opportunities/' + project._id + '/apply';
    application = (await call('post', path, graduate, data).expect(201)).body.data;
    await call('post', path, graduate, data).expect(409);
    await call('patch', '/applications/' + application._id + '/status', secondStartup, {
      status: 'accepted',
    }).expect(403);
    await call('patch', '/applications/' + application._id + '/status', startup, {
      status: 'accepted',
    }).expect(200);
    const upload = await request(app)
      .post(api + '/files/submission')
      .set(access(graduate.token))
      .attach('file', Buffer.from('%PDF-1.7\n%%EOF\n'), 'solution.pdf')
      .expect(201);
    const reference = upload.body.data.reference;
    const filePath = '/files/' + reference.slice(6);
    await call('get', filePath, startup).expect(404);
    const submission = (
      await call('post', '/opportunities/' + challenge._id + '/submissions', graduate, {
        content: 'I checked keyboard order.',
        attachments: [reference],
      }).expect(201)
    ).body.data;
    await call('get', filePath, startup).expect(200).expect('Content-Type', /pdf/);
    await call('get', filePath, secondStartup).expect(404);
    await call('post', '/opportunities/' + challenge._id + '/submissions', secondGraduate, {
      content: 'Another submission.',
    }).expect(409);
    await call('get', '/opportunities/' + challenge._id + '/submissions', secondStartup).expect(
      403,
    );
    await call('patch', '/submissions/' + submission._id + '/review', startup, {
      score: 90,
      feedback: 'Clear notes.',
      reviewStatus: 'selected',
    }).expect(200);
    const result = await call('get', '/submissions', graduate).expect(200);
    expect(result.body.data.items[0].score).toBe(90);
  });
  test('refreshes matching results after profile edits', async () => {
    const first = await call('get', '/matches/startups', graduate).expect(200);
    expect(first.body.data[0].missingSkills).toEqual(['React']);
    await call('patch', '/graduates/me', graduate, { skills: ['React', 'JavaScript'] }).expect(200);
    const latest = await call('get', '/matches/startups', graduate).expect(200);
    expect(latest.body.data[0].score).toBeGreaterThan(first.body.data[0].score);
  });
  test('requires an accepted connection and enforces conversation ownership', async () => {
    connection = (
      await call('post', '/connections', graduate, { startupId: company._id }).expect(201)
    ).body.data;
    expect((await call('get', '/conversations', graduate).expect(200)).body.data).toEqual([]);
    await call('patch', '/connections/' + connection._id, graduate, { status: 'accepted' }).expect(
      403,
    );
    await call('patch', '/connections/' + connection._id, startup, { status: 'accepted' }).expect(
      200,
    );
    conversation = (await call('get', '/conversations', graduate).expect(200)).body.data[0];
    const path = '/conversations/' + conversation._id + '/messages';
    await call('post', path, secondStartup, { body: 'Unauthorized' }).expect(404);
    const message = (await call('post', path, graduate, { body: 'Hello!' }).expect(201)).body.data;
    await call('patch', '/conversations/' + conversation._id + '/read', startup, {
      through: message._id,
    }).expect(200);
    expect((await call('get', path, graduate).expect(200)).body.data.items[0].readBy).toContain(
      startup.user._id,
    );
    await call('patch', '/connections/' + connection._id, startup, { status: 'blocked' }).expect(
      200,
    );
    await call('post', path, graduate, { body: 'Blocked' }).expect(403);
  });
  test('records admin actions and revokes suspended user sessions', async () => {
    await call('patch', '/admin/users/' + graduate.user._id + '/status', admin, {
      status: 'suspended',
    }).expect(200);
    await call('get', '/auth/me', graduate).expect(401);
    const result = await call('get', '/admin/audit-logs', admin).expect(200);
    expect(result.body.data.items.map((row) => row.action)).toContain('user.status');
  });
});
