import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { ActionToken, User } from '../../server/src/models.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri();
const env = {
  ...process.env,
  MONGODB_URI: uri,
  JWT_SECRET: 'isolated-playwright-signing-secret',
  NODE_ENV: 'development',
  CLIENT_ORIGIN: 'http://localhost:4173',
  PORT: '4400',
  STARTLINK_DEV_API_PORT: '4400',
  SMTP_URL: '',
  DEMO_MODE: 'false',
  SEED_ADMIN_EMAIL: 'admin@example.test',
  SEED_ADMIN_PASSWORD: 'playwright-test-passphrase',
};
function start(file, args = []) {
  return spawn(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit', env });
}
const seed = start('server/src/seed.js');
const seedExit = await new Promise((resolve) => seed.once('exit', resolve));
if (seedExit !== 0) {
  await mongo.stop();
  throw new Error('Unable to seed the test administrator.');
}
const api = start('server/src/server.js');
const client = start('node_modules/vite/bin/vite.js', [
  'client',
  '--config',
  'client/vite.config.js',
  '--port',
  '4173',
  '--strictPort',
]);
await mongoose.connect(uri);
const timer = setInterval(async () => {
  try {
    const accounts = await User.find({ email: /^browser-.*@example\.test$/, emailVerified: false });
    for (const account of accounts) {
      const token = createHash('sha256').update(account.email).digest('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await ActionToken.updateOne(
        { tokenHash },
        {
          $setOnInsert: {
            tokenHash,
            type: 'verify',
            userId: account._id,
            expiresAt: new Date(Date.now() + 600000),
          },
        },
        { upsert: true },
      );
    }
  } catch (error) {
    console.error('Test verification fixture failed.', error.message);
  }
}, 250);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  api.kill();
  client.kill();
  await mongoose.disconnect();
  await mongo.stop();
  process.exitCode = code;
}
api.once('exit', (code) => stop(code ?? 1));
client.once('exit', (code) => stop(code ?? 1));
process.once('SIGTERM', () => stop());
process.once('SIGINT', () => stop());
