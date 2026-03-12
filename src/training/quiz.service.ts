import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuizService {
    constructor(private readonly prisma: PrismaService) {}

    async getQuizForChapter(chapterId: number) {
        return this.prisma.lessonQuiz.findFirst({
            where: {
                chapterId,
                isActive: true,
            },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: {
                        options: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });
    }

    async startQuiz(userId: number, quizId: number) {
        const quiz = await this.prisma.lessonQuiz.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: {
                        options: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });

        if (!quiz) {
            throw new BadRequestException('Quiz not found');
        }

        const attempt = await this.prisma.quizAttempt.create({
            data: {
                userId,
                quizId,
                total: quiz.questions.length,
            },
        });

        return {
            attempt,
            question: quiz.questions[0] ?? null,
            total: quiz.questions.length,
            index: 1,
        };
    }

    async answerQuestion(
        attemptId: number,
        questionId: number,
        selectedOption: number,
    ) {
        const attempt = await this.prisma.quizAttempt.findUnique({
            where: { id: attemptId },
            include: {
                quiz: {
                    include: {
                        questions: {
                            orderBy: { order: 'asc' },
                            include: {
                                options: {
                                    orderBy: { order: 'asc' },
                                },
                            },
                        },
                    },
                },
                answers: true,
                user: true,
            },
        });

        if (!attempt) {
            throw new BadRequestException('Attempt not found');
        }

        if (attempt.finishedAt) {
            throw new BadRequestException('Quiz already finished');
        }

        const question = attempt.quiz.questions.find((q) => q.id === questionId);
        if (!question) {
            throw new BadRequestException('Question not found');
        }

        const isCorrect = question.correctOption === selectedOption;

        await this.prisma.quizAnswer.upsert({
            where: {
                attemptId_questionId: {
                    attemptId,
                    questionId,
                },
            },
            update: {
                selectedOption,
                isCorrect,
            },
            create: {
                attemptId,
                questionId,
                selectedOption,
                isCorrect,
            },
        });

        const updatedAttempt = await this.prisma.quizAttempt.findUnique({
            where: { id: attemptId },
            include: {
                quiz: {
                    include: {
                        questions: {
                            orderBy: { order: 'asc' },
                            include: {
                                options: {
                                    orderBy: { order: 'asc' },
                                },
                            },
                        },
                    },
                },
                answers: true,
                user: true,
            },
        });

        if (!updatedAttempt) {
            throw new BadRequestException('Attempt not found after update');
        }

        const answeredIds = new Set(updatedAttempt.answers.map((a) => a.questionId));
        const nextQuestion = updatedAttempt.quiz.questions.find(
            (q) => !answeredIds.has(q.id),
        );

        if (nextQuestion) {
            const index =
                updatedAttempt.quiz.questions.findIndex((q) => q.id === nextQuestion.id) + 1;

            return {
                finished: false,
                question: nextQuestion,
                index,
                total: updatedAttempt.quiz.questions.length,
            };
        }

        const score = updatedAttempt.answers.filter((a) => a.isCorrect).length;

        const result = await this.prisma.quizAttempt.update({
            where: { id: attemptId },
            data: {
                score,
                finishedAt: new Date(),
            },
            include: {
                user: true,
                quiz: true,
            },
        });

        return {
            finished: true,
            result,
        };
    }
}