import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';

import { PrismaModule } from './prisma/prisma.module';
import { TelegramUpdate } from './telegram/telegram.update';
import { TrainingAccessService } from './training/training-access.service';
import {TrainingSeedService} from "./training/training.seed.service";

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),

        PrismaModule,

        TelegrafModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                token: config.get<string>('BOT_TOKEN')!,
            }),
        }),
    ],
    providers: [TelegramUpdate],
})
export class AppModule {}
