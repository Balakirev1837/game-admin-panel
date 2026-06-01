FROM node:22-slim AS base
WORKDIR /app
RUN addgroup --system nodegroup && adduser --system --ingroup nodegroup nodeuser
COPY package.json node_modules ./
COPY . .
USER nodeuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => { process.exit(r.ok ? 0 : 1) }).catch(() => process.exit(1))"
CMD ["node", "src/index.js"]
