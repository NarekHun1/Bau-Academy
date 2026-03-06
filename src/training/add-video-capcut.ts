import 'dotenv/config';
import { PrismaClient, LessonItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const slug = 'capcut-pro';
    const fileId =
        'BAACAgIAAxkBAAPQaZRbH9E5Oy7ciGZXzBE1GH-hVPgAAh6PAAL2LalIytOEVQ_Wzrw6BA';

    const lesson = await prisma.lesson.findUnique({ where: { slug } });
    if (!lesson) throw new Error(`Lesson not found: ${slug}`);

    const created = await prisma.lessonItem.create({
        data: {
            lessonId: lesson.id,          // ✅ вот так правильно
            order: 50,                    // ✅ поставь после текста/фото
            type: LessonItemType.VIDEO,   // ✅ enum
            fileId,
            text: '🎥 Видео урока',
        },
    });

    console.log('✅ Created LessonItem:', created.id);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
