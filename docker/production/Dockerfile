### STAGE 1: Build ###
FROM node:16-alpine as build
WORKDIR /srv
COPY js /srv/js
COPY pages /srv/pages
COPY public /srv/public
COPY next.config.js package.json server.js yarn.lock /srv/
RUN yarn install
RUN yarn build
RUN yarn cache clean

### STAGE 2: Productive Container ###
FROM alpine
WORKDIR /srv
COPY --from=build /srv /srv
RUN apk --no-cache add yarn && rm -rf /var/cache/apk/*
EXPOSE 80
ENV TURNIERE_API_URL=https://api.turnie.re
CMD yarn start
