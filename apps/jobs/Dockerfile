# Monorepo root must be the build context:
#   docker compose -f docker-compose.jobs.yml build fotocorp-jobs
#
# Sharp: bookworm + libvips runtime libs for reliable native prebuilds.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libvips42 \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && corepack prepare pnpm@10.33.1 --activate

WORKDIR /app

# Workspace install (lockfile + filter keeps the image focused on @fotocorp/jobs).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches
COPY apps/jobs/package.json apps/jobs/package.json

RUN pnpm install --frozen-lockfile --filter @fotocorp/jobs...

COPY apps/jobs apps/jobs

RUN chown -R node:node /app

USER node

ENV NODE_ENV=production

# No HTTP port: outbound-only worker (Neon, R2, future queues).
# Override for smoke/dry-run: see docker-compose.jobs.yml and runbook.
CMD ["pnpm", "--dir", "apps/jobs", "run", "publish:worker"]
