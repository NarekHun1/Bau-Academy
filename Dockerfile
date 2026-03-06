FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
RUN DATABASE_URL=$DATABASE_URL npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "echo 'Running prisma generate...' && npx prisma generate && echo 'Running prisma db push...' && npx prisma db push --accept-data-loss && echo 'Running seed...' && npm run seed:lessons && echo 'Starting app...' && node dist/main"]