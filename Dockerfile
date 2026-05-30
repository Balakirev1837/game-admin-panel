FROM node:18-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && \
    node -e "require('express'); require('cors'); require('dockerode'); require('srcds-rcon')" && \
    echo "All modules verified"
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
