# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24-alpine
ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

### STAGE 1: Dependencies ###
FROM node:${NODE_VERSION} AS deps

WORKDIR /srv

RUN corepack enable

COPY package.json yarn.lock /srv/

RUN yarn install --frozen-lockfile


### STAGE 2: Build ###
FROM node:${NODE_VERSION} AS build

WORKDIR /srv

RUN corepack enable

ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

ENV NEXT_PUBLIC_TURNIERE_FRONTEND_VERSION=${base_commit} \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /srv/node_modules ./node_modules
COPY . .

RUN yarn build


### STAGE 3: Productive Container ###
FROM node:${NODE_VERSION} AS runtime

WORKDIR /srv

ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TURNIERE_FRONTEND_VERSION=${base_commit} \
    TURNIERE_API_URL=https://api.turnie.re \
    PORT=80 \
    HOSTNAME=0.0.0.0

USER node

COPY --chown=node:node --from=build /srv/.next/standalone ./
COPY --chown=node:node --from=build /srv/.next/static ./.next/static
COPY --chown=node:node --from=build /srv/public ./public
COPY --chown=node:node --from=build /srv/server.js ./server.js

EXPOSE 80

CMD ["node", "server.js"]
