FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Vite env vars are baked in at build time, not read at container runtime --
# pass this as a build arg (see docker-compose.yml) rather than an env var.
ARG VITE_API_URL=http://localhost:8000
ARG VITE_MONITOR_REFRESH_SECONDS=30
ENV VITE_API_URL=$VITE_API_URL \
    VITE_MONITOR_REFRESH_SECONDS=$VITE_MONITOR_REFRESH_SECONDS

RUN npm run build

FROM nginx:alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
