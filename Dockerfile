FROM node:18-slim
WORKDIR /app
COPY package.json node_modules ./
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
