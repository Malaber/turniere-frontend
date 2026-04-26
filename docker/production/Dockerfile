### STAGE 1: Dependencies ###
FROM node:16-alpine as deps
WORKDIR /srv
COPY package.json yarn.lock /srv/
RUN yarn install --frozen-lockfile --production=true

### STAGE 2: Build ###
FROM deps as build
ARG TURNIERE_FRONTEND_VERSION=development
ENV NEXT_PUBLIC_TURNIERE_FRONTEND_VERSION=$TURNIERE_FRONTEND_VERSION
COPY js /srv/js
COPY pages /srv/pages
COPY public /srv/public
COPY next.config.js server.js /srv/
RUN yarn build
RUN yarn cache clean

### STAGE 3: Productive Container ###
FROM node:16-alpine
WORKDIR /srv
ENV NODE_ENV=production
ARG TURNIERE_FRONTEND_VERSION=development
ENV TURNIERE_FRONTEND_VERSION=$TURNIERE_FRONTEND_VERSION
COPY --from=deps /srv/node_modules /srv/node_modules
COPY --from=build /srv/.next /srv/.next
COPY --from=build /srv/public /srv/public
COPY --from=build /srv/package.json /srv/package.json
COPY --from=build /srv/yarn.lock /srv/yarn.lock
COPY --from=build /srv/next.config.js /srv/next.config.js
COPY --from=build /srv/server.js /srv/server.js
EXPOSE 80
ENV TURNIERE_API_URL=https://api.turnie.re
CMD yarn start
