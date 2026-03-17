FROM node:20

WORKDIR /usr/src/app

COPY deploy/package*.json ./deploy/

WORKDIR /usr/src/app/deploy

RUN npm ci

WORKDIR /usr/src/app

COPY shared ./shared
COPY deploy ./deploy

WORKDIR /usr/src/app/deploy

RUN npm run build

CMD ["node", "dist/deploy/src/index.js"]
