FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig*.json ./
COPY nest-cli.json ./

ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm run seed:lessons && node dist/main"]