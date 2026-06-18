FROM node:20-alpine

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./

RUN npm ci

COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node src ./src

EXPOSE 3333

CMD ["npm", "run", "dev"]
