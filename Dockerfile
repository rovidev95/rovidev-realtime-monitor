FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev && npm install tsx
COPY tsconfig.json ./
COPY src ./src
COPY public ./public

EXPOSE 8080
CMD ["npx", "tsx", "src/server.ts"]
