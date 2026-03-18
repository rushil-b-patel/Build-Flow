FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY upload/package*.json ./upload/

RUN npm install --prefix upload

COPY packages ./packages

COPY upload ./upload

WORKDIR /usr/src/app/upload

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/upload/src/index.js"]
