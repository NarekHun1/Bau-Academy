FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# временная переменная только для build
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"

RUN DATABASE_URL=$DATABASE_URL npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npm run seed:lessons && node dist/main"]