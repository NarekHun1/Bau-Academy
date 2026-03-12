import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrainingAccessService } from './training-access.service';
import { TrainingSeedService } from './training.seed.service';
import { QuizService } from './quiz.service';
import { CertificateService } from './certificate.service';

@Module({
    imports: [PrismaModule],
    providers: [
        TrainingAccessService,
        TrainingSeedService,
        QuizService,
        CertificateService,
    ],
    exports: [
        TrainingAccessService,
        QuizService,
        CertificateService,
    ],
})
export class TrainingModule {}