FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Provide placeholder values at build time so module-level VertexAI init succeeds.
# Real values are injected at runtime via Cloud Run secrets/env vars.
ARG GOOGLE_CLOUD_PROJECT=mvanemmerik-ai
ARG VERTEX_AI_LOCATION=us-east1
ENV GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}
ENV VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION}

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3080
ENV PORT=3080

CMD ["node", "server.js"]
