# syntax=docker/dockerfile:1.7

ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

### STAGE 1: Dependencies ###
FROM node:16-alpine AS deps

WORKDIR /srv

COPY package.json yarn.lock /srv/

RUN yarn install --frozen-lockfile --production=true


### STAGE 2: Build ###
FROM deps AS build

ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

ENV NEXT_PUBLIC_TURNIERE_FRONTEND_VERSION=${base_commit}

COPY js /srv/js
COPY pages /srv/pages
COPY public /srv/public
COPY next.config.js server.js /srv/

RUN yarn build
RUN yarn cache clean


### STAGE 3: Productive Container ###
FROM node:16-alpine

WORKDIR /srv

ARG base_commit=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

ENV NODE_ENV=production \
    TURNIERE_FRONTEND_VERSION=${base_commit} \
    TURNIERE_API_URL=https://api.turnie.re

COPY --from=deps /srv/node_modules /srv/node_modules
COPY --from=build /srv/.next /srv/.next
COPY --from=build /srv/public /srv/public
COPY --from=build /srv/package.json /srv/package.json
COPY --from=build /srv/yarn.lock /srv/yarn.lock
COPY --from=build /srv/next.config.js /srv/next.config.js
COPY --from=build /srv/server.js /srv/server.js

EXPOSE 80

CMD ["yarn", "start"]
