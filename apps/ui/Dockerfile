# Interface Toolso Emailing (build statique CRA 4) servie par nginx.
# Étape 1 : build sur Node 22 (CRA 4 / webpack 4 exigent --openssl-legacy-provider, déjà dans le script "build").
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true \
    CYPRESS_INSTALL_BINARY=0
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Étape 2 : nginx minimal. La stack de déploiement (deploy/) monte sa propre configuration
# par-dessus /etc/nginx/conf.d/default.conf (reverse proxy /access, /api/<uid>, /files/<uid>).
FROM nginx:1.27-alpine
COPY nginx.default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
