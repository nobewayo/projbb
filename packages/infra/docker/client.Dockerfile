FROM node:20-bullseye AS build

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable

ARG VITE_BITBY_WS_URL
ARG VITE_BITBY_HTTP_URL
ENV VITE_BITBY_WS_URL=$VITE_BITBY_WS_URL
ENV VITE_BITBY_HTTP_URL=$VITE_BITBY_HTTP_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/client/package.json packages/client/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/infra/package.json packages/infra/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @bitby/schemas build
RUN pnpm --filter @bitby/client build

FROM nginx:1.27-alpine

COPY packages/infra/docker/nginx.client.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/client/dist /usr/share/nginx/html

EXPOSE 80
