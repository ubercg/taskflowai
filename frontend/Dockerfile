# Debian slim (glibc): evita fallos de Rollup/Vite con @rollup/*-musl en Alpine
# (dependencias opcionales de npm + volumen node_modules).
FROM node:20-bookworm-slim
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 3000
