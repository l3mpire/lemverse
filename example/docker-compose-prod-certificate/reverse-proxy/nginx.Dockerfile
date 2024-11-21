FROM nginx:latest
RUN rm /etc/nginx/conf.d/default.conf
COPY reverse-proxy/config/nginx.conf /etc/nginx/conf.d/default.conf
