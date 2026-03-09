# NormaBot — Backend proxy per Railway
FROM node:18-alpine

WORKDIR /app

# Copia solo i file necessari al server
COPY package.json ./
COPY server.js ./

# Installa solo le dipendenze del server (express, cors, node-fetch, dotenv)
RUN npm install express cors node-fetch dotenv

EXPOSE 3001

CMD ["node", "server.js"]
