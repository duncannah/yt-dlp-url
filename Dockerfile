FROM node:21-alpine as build

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm \
	&& pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

FROM node:21-alpine as dependencies

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm \
	# node-linker is set to hoisted to not have symlinks
	&& pnpm config set node-linker hoisted \
	&& pnpm install --frozen-lockfile --prod

FROM node:21-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# Get python3 (needed for yt-dlp)
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python

COPY --from=build /usr/src/app/package.json /usr/src/app/
COPY --from=build /usr/src/app/build /usr/src/app
COPY --from=dependencies /usr/src/app/node_modules /usr/src/app/node_modules

EXPOSE 8080
CMD [ "node", "./app.js" ]