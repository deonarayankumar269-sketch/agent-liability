FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --include=dev
COPY client .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json server/
RUN npm install --omit=dev --omit=optional --prefix server
COPY server server
COPY --from=client /app/client/dist client/dist
EXPOSE 4000
CMD ["node", "server/src/app.js"]
