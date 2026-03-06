import 'dotenv/config';
import { PrismaClient, LessonItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const lessonSlug = 'capcut-pro';

    // куда добавляем: 1-й урок внутри курса
    const chapterSlug = 'lesson-1';

    const fileId =
        'BAACAgIAAxkBAAPQaZRbH9E5Oy7ciGZXzBE1GH-hVPgAAh6PAAL2LalIytOEVQ_Wzrw6BA';

    const lesson = await prisma.lesson.findUnique({ where: { slug: lessonSlug } });
    if (!lesson) throw new Error(`Lesson not found: ${lessonSlug}`);

    // ищем главу внутри курса
    const chapter = await prisma.lessonChapter.findUnique({
        where: {
            lessonId_slug_chapter: { lessonId: lesson.id, slug: chapterSlug },
        },
    });

    if (!chapter) {
        throw new Error(
            `Chapter not found: ${lessonSlug} / ${chapterSlug}. Сначала заseed'и chapters.`,
        );
    }

    // создаём item
    const created = await prisma.lessonItem.create({
        data: {
            chapterId: chapter.id,          // ✅ ВАЖНО: chapterId вместо lessonId
            order: 50,
            type: LessonItemType.VIDEO,
            fileId,
            text: '🎥 Видео урока',
        },
    });

    console.log('✅ Created LessonItem:', created.id, 'chapterId=', chapter.id);
}

main()
    .catch((e) => {
        console.error('ERROR:', e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
