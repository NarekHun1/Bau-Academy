import { Module } from '@nestjs/common';
import { TrainingSeedService } from './training.seed.service';
import { QuizService } from './quiz.service';

@Module({
    providers: [TrainingSeedService, QuizService],
    exports: [QuizService],
})
export class TrainingModule {}