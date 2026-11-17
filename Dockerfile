# One image for the whole app: the Node server serves both the API and the built frontend.
# Two stages, so the final image has the server, its production dependencies and the built
# frontend files, but not the frontend's build tools.

# Stage 1: build the frontend into static files (frontend/dist).
FROM node:26-alpine AS frontend
WORKDIR /app/frontend
# Dependencies first: this layer is reused from cache until package-lock.json changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: the image that runs.
FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev --prefix server

COPY server/src ./server/src
# The server applies these migrations on startup.
COPY db/migrations ./db/migrations
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV PORT=3000
ENV STATIC_DIR=/app/frontend/dist

# Run as the unprivileged user that the Node image provides, not as root.
USER node
EXPOSE 3000

# Docker marks the container unhealthy if the server cannot reach the database.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

CMD ["node", "server/src/index.js"]
