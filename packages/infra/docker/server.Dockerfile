FROM node:20-bullseye

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json packages/server/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/client/package.json packages/client/package.json
COPY packages/infra/package.json packages/infra/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @bitby/schemas build
RUN pnpm --filter @bitby/server build

EXPOSE 3001

CMD ["pnpm", "--filter", "@bitby/server", "start"]
