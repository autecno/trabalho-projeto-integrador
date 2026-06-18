FROM node:20-alpine

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./

RUN npm ci

COPY --chown=node:node next.config.ts postcss.config.mjs tsconfig.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts

EXPOSE 3000

CMD ["npm", "run", "dev"]
