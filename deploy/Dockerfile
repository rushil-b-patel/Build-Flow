FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY deploy/package*.json ./deploy/

RUN npm install --prefix deploy

COPY packages ./packages

COPY deploy ./deploy

WORKDIR /usr/src/app/deploy

#executes during image build
RUN npm run build

#executes when container starts
CMD ["node", "dist/deploy/src/index.js"]
