import { Module } from '@nestjs/common';
import { TelegramUpdate } from './telegram.update';
import { TrainingModule } from '../training/training.module';

@Module({
    imports: [TrainingModule],
    providers: [TelegramUpdate],
})
export class TelegramModule {}