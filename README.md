# STARTLINK

A MERN platform for discovering startup teams, showcasing graduate work, and collaborating through projects and challenges. The homepage follows the supplied navy-and-gold reference. The two dark calls to action use white text and gold emphasis.

## Run locally

Use Node.js 24 LTS. From the project root:

```sh
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). On first run, the dev command generates an ignored `.env` with a unique signing secret and starts MongoDB 8 on port 27018. The first run may download MongoDB if a local binary is unavailable. Development records persist in `.startlink-data`. The Vite proxy routes API and WebSocket traffic to port 4000.

To use your own MongoDB, set `MONGODB_DEV_MANAGED=false` and configure `MONGODB_URI` in `.env`. For local verification, use the link printed in the API terminal when `DEV_MAIL_LOG=true`, or configure SMTP. Keep dev mail logging off in shared environments.

To start the entire local stack with Docker, use the generated `.env` or copy `.env.example` to `.env` and set `JWT_SECRET` to a random string of at least 32 characters. Run `docker compose up --build`. The web container serves the SPA and proxies requests to Express. The MongoDB volume persists data across restarts.

### Demo and administrator accounts

Set `DEMO_MODE=true` and `SEED_DEMO_PASSWORD` to enable explicit demo seeding. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` to provision an administrator. Run `npm run seed` locally or `docker compose exec api npm run seed` in Compose. Seed commands leave existing passwords untouched. Keep development and production databases separate.

Demo logins use `graduate@example.test` and `startup1@example.test` through `startup3@example.test` with your configured demo password. Sample startups are labeled. The public catalog excludes them when demo mode is disabled and in production.

## Project structure

- `client/src` contains React routes, role layouts, forms, directories, dashboards, messaging, and the responsive Tailwind theme.
- `server/src` contains the Express entry point, Mongoose models, security middleware, and domain route modules.
- `server/tests` contains isolated MongoDB and matching tests.
- `client/tests` contains browser and automated accessibility checks.
- [OpenAPI](docs/openapi.json) lists the versioned endpoints. Regenerate it with `node docs/generate-openapi.mjs` after changes.

MongoDB stores users, graduate profiles, startups, memberships, opportunities, applications, challenge submissions, connections, conversations, messages, notifications, follows, reports, refresh sessions, action tokens, audit logs, and categories, and private attachments. The API creates indexes before accepting requests.

## Configuration

| Variable | Use |
| --- | --- |
| `MONGODB_URI` | MongoDB URI with least-privilege credentials in production |
| `MONGODB_DEV_MANAGED` | Start a persistent, loopback-only MongoDB with the local dev command |
| `JWT_SECRET` | Unique signing secret of at least 32 characters |
| `CLIENT_ORIGIN` | Exact browser origin, such as `https://app.example.com` |
| `PORT`, `NODE_ENV` | API listener and runtime mode |
| `SMTP_URL`, `MAIL_FROM` | Transactional email transport and verified sender |
| `CLOUDINARY_URL` | Server-only credential for image uploads and authenticated video storage |
| `COOKIE_SAME_SITE` | Defaults to `lax`. Use `none` only for cross-site HTTPS deployments |
| `TRUST_PROXY` | Set to `1` when the API is behind one trusted reverse proxy |
| `VITE_API_ORIGIN` | API origin at client build time for split hosting. Leave empty for same-origin routing |
| `DEV_MAIL_LOG`, `DEMO_MODE` | Opt-in development email links and sample catalog |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD` | Credentials supplied only when seeding |

## Profile and promotional videos

Manage the homepage video in Admin > Platform Overview. Founders and graduates manage introductions in their profile workspaces after verifying their accounts. MP4 and WebM files up to 32 MB are accepted. The duration limits are 5 minutes for the promo, 3 minutes for founders, and 2 minutes for graduates. Thumbnails are generated automatically. Startup videos follow startup visibility and verification. Graduate videos are visible to authorized startup and admin accounts when the graduate has enabled profile and video visibility.

For local development without Cloudinary, set `VIDEO_DEV_FFMPEG` to the absolute path of an installed FFmpeg executable and restart the dev stack. Files are kept outside MongoDB in `.startlink-media`. Production uses `CLOUDINARY_URL`.

## Verification

```sh
npm run lint
npm run build
npm test
npm run test:e2e
```

API tests use MongoDB Memory Server, which may download a MongoDB binary on first run. Set `TEST_MONGODB_URI` to use a separate test MongoDB. The test suite creates and drops its own test database. Playwright can use a locally installed Chromium browser via `PLAYWRIGHT_CHANNEL=chrome`, or install its bundled Chromium with `npx playwright install chromium`.

## Deployment

Deploy the Node server behind HTTPS with MongoDB Atlas or another managed MongoDB. Set the server variables above and use `npm run start -w server`. Configure the load balancer to check `/api/v1/health` and support WebSocket upgrades.

Build the SPA with `npm run build`, publish `client/dist`, and rewrite client routes to `index.html`. Prefer same-site subdomains or a same-origin proxy for session cookies. For a separate origin, configure `VITE_API_ORIGIN` and `CLIENT_ORIGIN` explicitly. Cross-site cookies depend on browser policy.

Enable MongoDB backups, regularly test restore, and ship application errors and administrator audit events to your logging environment. The current Socket.IO and rate-limiter configuration targets a single API instance. Add shared infrastructure for rooms and rate limiting before scaling horizontally. The included policy pages are starter copy for operator review.

## Current limits

Public profile images use Cloudinary. Uploaded certificates and challenge files are stored in MongoDB with a 4 MB file limit and authenticated downloads. Certificate downloads are restricted to the owner, and challenge file downloads are restricted to the submitter and authorized startup reviewers. Startup membership is modeled and enforced, with owner creation through onboarding. Member invitations are outside the current UI. Set an optional capacity before publication to limit project acceptances or challenge submissions. Matching scores up to 500 recent records per category before applying eligibility filters. Opportunity alerts are sent to followers when a startup publishes. Multi-instance Socket.IO delivery is pending.
