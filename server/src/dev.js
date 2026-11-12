import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const configuration = new URL('.env', root);
if (!existsSync(configuration)) {
  const settings = [
    'NODE_ENV=development',
    'PORT=4000',
    'CLIENT_ORIGIN=http://localhost:5173',
    'MONGODB_DEV_MANAGED=true',
    'MONGODB_URI=mongodb://127.0.0.1:27018/startlink',
    'DEV_MAIL_LOG=true',
    'DEV_AUTO_VERIFY_EMAIL=true',
    'JWT_SECRET=' + randomBytes(48).toString('hex'),
    '',
  ];
  try {
    await writeFile(configuration, settings.join('\n'), { flag: 'wx' });
    console.info('Created a local STARTLINK configuration.');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
process.loadEnvFile(fileURLToPath(configuration));
if (process.env.NODE_ENV === 'production') throw new Error('Use npm run start for production.');

const manageMongo = process.env.MONGODB_DEV_MANAGED === 'true' || !process.env.MONGODB_URI;
let mongo;
if (manageMongo) {
  const dbPath = fileURLToPath(new URL('.startlink-data/', root));
  await mkdir(dbPath, { recursive: true });
  const platformBinary = process.platform === 'win32' ? 'mongod.exe' : 'mongod';
  const cachedBinary = fileURLToPath(new URL('.mongo-cache/' + platformBinary, root));
  const systemBinary =
    process.env.MONGOMS_SYSTEM_BINARY || (existsSync(cachedBinary) ? cachedBinary : undefined);
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  console.info('Starting local MongoDB with persistent development storage.');
  mongo = await MongoMemoryServer.create({
    binary: { version: '8.0.12', systemBinary },
    instance: {
      dbPath,
      storageEngine: 'wiredTiger',
      ip: '127.0.0.1',
      port: 27018,
      portGeneration: false,
    },
  });
  process.env.MONGODB_URI = mongo.getUri('startlink');
}
try {
  await import('./server.js');
} catch (error) {
  await mongo?.stop({ doCleanup: false });
  throw error;
}
if (mongo) {
  const stop = () =>
    mongo.stop({ doCleanup: false }).catch((error) => console.error(error.message));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
