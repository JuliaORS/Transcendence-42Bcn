# Usa una imagen ligera de Nginx como base
FROM nginx:alpine

# Crea el directorio donde se almacenarán los archivos estáticos
RUN mkdir -p /usr/share/nginx/html/static

# Instala wget para descargar Bootstrap
RUN apk add --no-cache wget

# Descarga Bootstrap CSS y JS y colócalos en el directorio estático
# RUN wget https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css -O /usr/share/nginx/html/static/bootstrap.min.css && \
#     wget https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js -O /usr/share/nginx/html/static/bootstrap.bundle.min.js

# Copia los archivos estáticos al directorio correcto
COPY ./static /usr/share/nginx/html/static

# Copia la configuración personalizada de Nginx
COPY ./conf/nginx.conf /etc/nginx/nginx.conf

# Expone el puerto 8443 para tráfico HTTPS
EXPOSE 8443

# Usa el comando por defecto de Nginx para mantenerlo en ejecución
CMD ["nginx", "-g", "daemon off;"]
