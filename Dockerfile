# Etapa 1: Build de la app Angular
FROM node:22.20 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build --prod

# Etapa 2: Servir archivos estáticos con Nginx
FROM nginx:stable-alpine

# Copia el build de Angular al directorio de Nginx
COPY --from=build /app/dist/lcda/browser/. /usr/share/nginx/html/

# Copia la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]