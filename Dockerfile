FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "echo 'Running prisma db push...' && npx prisma db push && echo 'Running seed...' && npm run seed:lessons && echo 'Starting app...' && node dist/main.js"]