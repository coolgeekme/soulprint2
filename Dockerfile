# syntax=docker/dockerfile:1

# soulprintengine.ai — production image
#
# Mirrors the runtime the app actually expects: a long-lived Node server (in-process
# intervals, /tmp scratch space for video/PDF work, long SSE chat streams). This is why the
# app cannot run on a serverless platform.
#
# The base image is Debian-slim rather than Alpine deliberately: `sharp` ships prebuilt
# binaries against glibc, and Alpine would mean rebuilding libvips into the image.
#
# Yarn, not npm: package.json pins packageManager yarn@1.22.22 and the repo carries
# yarn.lock. Using npm here would resolve a dependency tree that production has never run.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --production=false

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are INLINED into the client bundle at build time — they are not read at
# runtime. Building without them produces an image that boots fine and ships a broken frontend
# (Firebase init fails in the browser, reCAPTCHA silently disabled), which is indistinguishable
# from a backend bug until someone tries to sign in.
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN yarn build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Non-root. The app writes to /tmp only, which is world-writable already.
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs app

COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:nodejs /app/.next/standalone ./
COPY --from=builder --chown=app:nodejs /app/.next/static ./.next/static

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
