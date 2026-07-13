# Static web client served by nginx.
FROM nginx:1.27-alpine
COPY . /usr/share/nginx/html
# Single-page app: fall back to index.html for unknown paths.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
