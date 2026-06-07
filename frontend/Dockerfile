FROM node:20

WORKDIR /usr/src/app/frontend

COPY frontend/package*.json ./

RUN npm install

COPY packages ../packages

COPY frontend ./

EXPOSE 5173

# --host binds 0.0.0.0 so the dev server is reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
