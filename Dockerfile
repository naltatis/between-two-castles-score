FROM node:26-alpine AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm install -g npm@12 && npm ci
COPY app/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
