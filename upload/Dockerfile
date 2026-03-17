FROM node:20

WORKDIR /usr/src/app

COPY upload/package*.json ./upload/

WORKDIR /usr/src/app/upload

RUN npm ci

WORKDIR /usr/src/app

COPY shared ./shared
COPY upload ./upload

WORKDIR /usr/src/app/upload

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/upload/src/index.js"]
