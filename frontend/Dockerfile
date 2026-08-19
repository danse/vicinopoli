FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ .
COPY openapi/ ../openapi/
RUN npm run gen:types

ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ARG VITE_COMMIT_HASH
ENV VITE_COMMIT_HASH=$VITE_COMMIT_HASH
ARG VITE_SUPPORT_EMAIL=info@vicinopoli.it
ENV VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL
ARG VITE_PUBLIC_BASE_URL=http://localhost:8080
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL
ARG VITE_GTAG_ID=
ENV VITE_GTAG_ID=$VITE_GTAG_ID
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
