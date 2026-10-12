FROM node:26-alpine AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm install -g npm@12 && npm ci
COPY app/ ./
RUN npm run build

FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
