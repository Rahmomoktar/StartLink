import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { app } from './app.js';
import { authenticate } from './auth.js';
import { env, origin, production } from './core.js';

if (!env.MONGODB_URI || !env.JWT_SECRET || env.JWT_SECRET.length < 32)
  throw new Error('Configure MONGODB_URI and a JWT_SECRET of at least 32 characters.');
if (production && (!origin.startsWith('https://') || !env.SMTP_URL || !env.MAIL_FROM))
  throw new Error('Production requires an HTTPS client origin and SMTP configuration.');
await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
await Promise.all(Object.values(mongoose.models).map((Model) => Model.init()));
const server = createServer(app);
const io = new Server(server, {
  cors: { origin },
  allowRequest: (req, callback) =>
    callback(null, !req.headers.origin || req.headers.origin === origin),
  maxHttpBufferSize: 4096,
});
app.set('io', io);
io.use(async (socket, next) => {
  try {
    const { user, familyId } = await authenticate(socket.handshake.auth.token);
    socket.data.userId = String(user._id);
    socket.data.familyId = familyId;
    next();
  } catch {
    next(new Error('Sign in to receive updates.'));
  }
});
io.on('connection', (socket) => {
  socket.join(['user:' + socket.data.userId, 'session:' + socket.data.familyId]);
  const timer = setInterval(async () => {
    try {
      await authenticate(socket.handshake.auth.token);
    } catch {
      socket.disconnect(true);
    }
  }, 15000);
  socket.on('disconnect', () => clearInterval(timer));
});
server.listen(Number(env.PORT || 4000), () =>
  console.info('STARTLINK API listening on port ' + (env.PORT || 4000)),
);
async function stop() {
  await io.close();
  await mongoose.disconnect();
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
