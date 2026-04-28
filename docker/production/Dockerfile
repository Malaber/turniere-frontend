# syntax=docker/dockerfile:1.7

ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

### STAGE 1: Dependencies ###
FROM node:24-alpine AS deps

WORKDIR /srv

COPY package.json yarn.lock /srv/

RUN yarn install --frozen-lockfile --production=true


### STAGE 2: Build ###
FROM deps AS build

ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

ENV NEXT_PUBLIC_TURNIERE_FRONTEND_VERSION=${base_commit}

COPY . /srv/

RUN yarn build && yarn cache clean


### STAGE 3: Productive Container ###
FROM node:24-alpine

WORKDIR /srv

ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

ENV NODE_ENV=production \
    TURNIERE_FRONTEND_VERSION=${base_commit} \
    TURNIERE_API_URL=https://api.turnie.re

COPY --from=deps /srv/node_modules ./node_modules
COPY --from=build /srv/.next ./.next
COPY --from=build /srv/public ./public
COPY --from=build /srv/package.json /srv/yarn.lock /srv/next.config.js /srv/server.js ./

EXPOSE 80

CMD ["yarn", "start"]
