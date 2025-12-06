# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Etapa 2: Producción
FROM node:18-alpine

WORKDIR /app

# Instalar wget para healthchecks
RUN apk add --no-cache wget

# Copiar node_modules desde la etapa de construcción
COPY --from=builder /app/node_modules ./node_modules

# Copiar código fuente
COPY . .

# Crear usuario no privilegiado
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Exponer puerto
EXPOSE 4000

# Variable de entorno
ENV NODE_ENV=production

# Comando de inicio
CMD ["node", "src/server.js"]
