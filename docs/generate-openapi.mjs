import { readFile, writeFile } from 'node:fs/promises';
const routes = {
  'auth.js': { authRoutes: 'auth' },
  'discovery.js': { startupRoutes: 'startups', graduateRoutes: 'graduates' },
  'opportunities.js': {
    opportunities: 'opportunities',
    applications: 'applications',
    submissions: 'submissions',
  },
  'matching.js': { matches: 'matches' },
  'community.js': {
    connections: 'connections',
    conversations: 'conversations',
    notifications: 'notifications',
    reports: 'reports',
  },
  'admin.js': { admin: 'admin' },
  'app.js': { api: '' },
  'files.js': { files: 'files' },
};
const fields = {
  'POST /auth/register': 'fullName email password confirmPassword role',
  'POST /auth/login': 'email password',
  'POST /auth/verify-email': 'token',
  'POST /auth/forgot-password': 'email',
  'POST /auth/reset-password': 'token password',
  'POST /auth/change-password': 'currentPassword password',
  'PATCH /graduates/me':
    'fullName avatar headline bio education skills certificates interests preferredIndustries location availability workMode github linkedin visibility',
  'POST /graduates/me/projects': 'title description technologies screenshots repositoryUrl demoUrl',
  'POST /startups':
    'name description industry location website logo banner founders startupStage requiredSkills preferredSkills visibility',
  'POST /opportunities':
    'startupId type title description category requiredSkills mandatorySkills preferredSkills deliverables workMode location duration compensation deadline capacity instructions evaluationCriteria terms availability status',
  'POST /opportunities/{id}/apply': 'motivation skills portfolioReferences availability',
  'POST /opportunities/{id}/submissions': 'content repositoryUrl demoUrl attachments',
  'PATCH /applications/{id}/status': 'status',
  'PATCH /submissions/{id}/review': 'score feedback reviewStatus',
  'POST /connections': 'startupId graduateId message',
  'PATCH /connections/{id}': 'status',
  'POST /conversations/{id}/messages': 'body',
  'PATCH /conversations/{id}/read': 'through',
  'PATCH /notifications/preferences': 'mutedNotifications',
  'POST /reports': 'reportedEntityType reportedEntityId reason description',
  'PATCH /admin/users/{id}/status': 'status',
  'PATCH /admin/startups/{id}/verification': 'verificationStatus',
  'PATCH /admin/opportunities/{id}/status': 'status',
  'PATCH /admin/reports/{id}': 'status hide',
  'POST /admin/categories': 'name',
};
fields['PATCH /startups/{id}'] = fields['POST /startups'];
fields['PATCH /graduates/me/projects/{id}'] = fields['POST /graduates/me/projects'];
fields['PATCH /opportunities/{id}'] = fields['POST /opportunities'].replace('startupId type ', '');
const query = {
  '/startups': 'q industry stage skills active page sort',
  '/graduates': 'q availability skills location study page sort',
  '/opportunities': 'q type workMode skill page sort',
  '/conversations': 'q',
  '/conversations/{id}/messages': 'before',
};
const lists = new Set(
  'education skills certificates interests preferredIndustries technologies screenshots founders requiredSkills mandatorySkills preferredSkills deliverables evaluationCriteria portfolioReferences attachments mutedNotifications'.split(
    ' ',
  ),
);
const booleans = new Set(['visibility', 'hide']);
const numbers = new Set(['score', 'capacity', 'page']);
const type = (name) =>
  lists.has(name)
    ? { type: 'array', items: { type: 'string' } }
    : {
        type: booleans.has(name) ? 'boolean' : numbers.has(name) ? 'number' : 'string',
        ...(name === 'deadline' ? { format: 'date-time' } : {}),
      };
const json = (schema) => ({ 'application/json': { schema } });
const doc = {
  openapi: '3.1.0',
  info: {
    title: 'STARTLINK API',
    version: '1.0.0',
    description:
      'Versioned JSON endpoints. Collaboration writes require verified email. Resource access is checked on the server.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'startlink_refresh' },
    },
  },
  paths: {},
};
const definitions =
  /^(\w+)\.(get|post|patch|delete)\(\s*'([^']+)'([\s\S]*?)(?=async\s*\(|\(\s*req\b)/gm;
for (const [file, routers] of Object.entries(routes)) {
  const source = await readFile(new URL('../server/src/' + file, import.meta.url), 'utf8');
  for (const [, router, method, route, line] of source.matchAll(definitions)) {
    if (!(router in routers)) continue;
    const group = routers[router];
    const path = ((group ? '/' + group : '') + (route === '/' ? '' : route)).replace(
      /:(\w+)/g,
      '{$1}',
    );
    const key = method.toUpperCase() + ' ' + path;
    const cookie = path === '/auth/refresh' || path === '/auth/logout';
    const bearer =
      ['admin', 'conversations', 'notifications'].includes(group) ||
      /\.\.\.role\(|\bauth\b/.test(line);
    const role = line
      .match(/role\(([^)]+)\)/)?.[1]
      .replaceAll("'", '')
      .replaceAll(',', ', ');
    const csrf = cookie || /\bcsrf\b/.test(line);
    const parameters = [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    if (csrf)
      parameters.push({
        name: 'X-Startlink',
        in: 'header',
        required: true,
        schema: { type: 'string', const: '1' },
        description: 'Send from the configured client origin.',
      });
    if (method === 'get') {
      const paginated =
        line.includes('page(') ||
        /\/(mine|applications|submissions|opportunities|notifications)$/.test(path);
      for (const name of (query[path] || (paginated ? 'page sort' : '')).split(' ').filter(Boolean))
        parameters.push({ name, in: 'query', schema: type(name) });
    }
    const operation = {
      tags: [group || 'service'],
      summary: key,
      description: role
        ? 'Requires role: ' + role
        : group === 'admin'
          ? 'Requires an administrator account.'
          : undefined,
      security: cookie ? [{ refreshCookie: [] }] : bearer ? [{ bearerAuth: [] }] : [],
      parameters: parameters.length ? parameters : undefined,
      responses: {
        default: {
          description: 'Error',
          content: json({
            type: 'object',
            required: ['error'],
            properties: {
              error: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string' },
                  fields: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          }),
        },
      },
    };
    const code =
      method === 'post' && /\/auth\/(register|forgot-password|resend-verification)$/.test(path)
        ? 202
        : method === 'post' &&
            !['auth', 'notifications'].includes(group) &&
            !path.endsWith('/follow')
          ? 201
          : 200;
    operation.responses[code] = {
      description: 'Success',
      content: json({ type: 'object', required: ['data'], properties: { data: {} } }),
    };
    if (fields[key])
      operation.requestBody = {
        required: true,
        content: json({
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(fields[key].split(' ').map((name) => [name, type(name)])),
        }),
      };
    if (path === '/files/{id}')
      operation.responses[200] = {
        description: 'Authorized attachment',
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      };
    if (['/uploads/image', '/files/{purpose}'].includes(path))
      operation.requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      };
    (doc.paths[path] ||= {})[method] = operation;
  }
}
await writeFile(new URL('./openapi.json', import.meta.url), JSON.stringify(doc, null, 2) + '\n');
