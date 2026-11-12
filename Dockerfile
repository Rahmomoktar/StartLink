FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm install --no-audit --no-fund

FROM deps AS frontend
COPY client client/
RUN npm run build
FROM nginx:alpine AS web
COPY --from=frontend /app/client/dist /usr/share/nginx/html
COPY docs/nginx.conf /etc/nginx/conf.d/default.conf

FROM deps AS backend
COPY server server/
USER node
EXPOSE 4000
CMD ["npm","run","start","-w","server"]
