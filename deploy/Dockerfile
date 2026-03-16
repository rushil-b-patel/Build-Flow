FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# executes during image build
RUN npm run build

# executes when we run the container
CMD ["node", "dist/index.js"]
