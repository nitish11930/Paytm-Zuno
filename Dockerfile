FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY scripts ./scripts
COPY tests ./tests
RUN npm run check && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/data && chown -R node:node /app
COPY deploy/docker-entrypoint.sh /usr/local/bin/munim-entrypoint
RUN chmod 755 /usr/local/bin/munim-entrypoint
ENTRYPOINT ["munim-entrypoint"]
EXPOSE 10000
CMD ["node", "server/index.js"]
