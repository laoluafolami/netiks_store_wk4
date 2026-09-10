FROM node:20-alpine

WORKDIR /app

COPY package.json /app/package.json
COPY apps/web/package.json /app/apps/web/package.json
COPY packages/shared-types/package.json /app/packages/shared-types/package.json

RUN npm install

COPY apps/web /app/apps/web
COPY packages/shared-types /app/packages/shared-types

WORKDIR /app/apps/web

CMD ["npm", "run", "dev"]
# Updated September 1, 2024 - v1.0.1
