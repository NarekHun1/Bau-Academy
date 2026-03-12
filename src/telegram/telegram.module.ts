import { Module } from '@nestjs/common';
import { TelegramUpdate } from './telegram.update';
import { TrainingModule } from '../training/training.module';
import {PrismaService} from "../prisma/prisma.service";

@Module({
    imports: [TrainingModule],
    providers: [TelegramUpdate,PrismaService],
})
export class TelegramModule {}