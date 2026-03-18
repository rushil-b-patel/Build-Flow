FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY request/package*.json ./request/

RUN npm install --prefix request

COPY packages ./packages

COPY request ./request

WORKDIR /usr/src/app/request

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/request/src/index.js"]
