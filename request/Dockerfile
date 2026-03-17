FROM node:20

WORKDIR /usr/src/app

COPY request/package*.json ./request/

WORKDIR /usr/src/app/request

RUN npm ci

WORKDIR /usr/src/app

COPY shared ./shared
COPY request ./request

WORKDIR /usr/src/app/request

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/request/src/index.js"]
