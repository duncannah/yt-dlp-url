FROM node:17-alpine as base

WORKDIR /usr/src/app

# Get python3 (needed for yt-dlp)
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python

# Get pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

RUN pnpm prune --prod
RUN pnpm store prune

FROM base as production

EXPOSE 8080
CMD [ "node", "./build/app.js" ]