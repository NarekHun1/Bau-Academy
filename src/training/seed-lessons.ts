import 'dotenv/config';
import { PrismaClient, LessonItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
    console.log('🚀 seed-lessons started');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    const lessons = [
        { slug: 'capcut-pro', title: '🎬 CapCut Pro (Օնլայն դասընթաց)' },
        { slug: 'canva-pro', title: '🎨 Canva Pro (Օնլայն դասընթաց)' },
    ];

    const chapters = [
        { order: 1, slug: 'lesson-1', title: 'Դաս 1' },
        { order: 2, slug: 'lesson-2', title: 'Դաս 2' },
        { order: 3, slug: 'lesson-3', title: 'Դաս 3' },
        { order: 4, slug: 'lesson-4', title: 'Դաս 4' },
        { order: 5, slug: 'lesson-5', title: 'Դաս 5' },
    ];

    await prisma.$transaction(async (tx) => {

        // ---------- LESSONS ----------
        for (const lesson of lessons) {
            await tx.lesson.upsert({
                where: { slug: lesson.slug },
                update: { title: lesson.title },
                create: lesson,
            });
        }

        const capcut = await tx.lesson.findUnique({
            where: { slug: 'capcut-pro' },
        });

        const canva = await tx.lesson.findUnique({
            where: { slug: 'canva-pro' },
        });

        if (!capcut) throw new Error('capcut-pro not found');
        if (!canva) throw new Error('canva-pro not found');

        // ---------- CHAPTERS ----------
        for (const ch of chapters) {

            await tx.lessonChapter.upsert({
                where: {
                    lessonId_slug_chapter: {
                        lessonId: capcut.id,
                        slug: ch.slug,
                    },
                },
                update: {
                    title: ch.title,
                    order: ch.order,
                },
                create: {
                    lessonId: capcut.id,
                    slug: ch.slug,
                    title: ch.title,
                    order: ch.order,
                },
            });

            await tx.lessonChapter.upsert({
                where: {
                    lessonId_slug_chapter: {
                        lessonId: canva.id,
                        slug: ch.slug,
                    },
                },
                update: {
                    title: ch.title,
                    order: ch.order,
                },
                create: {
                    lessonId: canva.id,
                    slug: ch.slug,
                    title: ch.title,
                    order: ch.order,
                },
            });

        }

        // ---------- CAPCUT LESSON 1 ----------
        const capcutCh1 = await tx.lessonChapter.findUnique({
            where: {
                lessonId_slug_chapter: {
                    lessonId: capcut.id,
                    slug: 'lesson-1',
                },
            },
        });

        if (!capcutCh1) throw new Error('CapCut lesson-1 not found');

        await tx.lessonItem.deleteMany({
            where: { chapterId: capcutCh1.id },
        });

        await tx.lessonItem.createMany({
            data: [
                {
                    chapterId: capcutCh1.id,
                    order: 1,
                    type: LessonItemType.TEXT,
                    text: `CapCut Pro

Ողջույն։ Այս դասընթացում կսովորենք CapCut-ի հիմնական հնարավորությունները։`,
                },
                {
                    chapterId: capcutCh1.id,
                    order: 2,
                    type: LessonItemType.TEXT,
                    text: `Դաս 1

🖇️ Ռիլլի ֆորմատ

Instagram / TikTok / Facebook ռիլլերի համար ֆորմատը պետք է լինի 9:16։`,
                },
            ],
        });

        // ---------- CAPCUT LESSON 2 ----------
        const capcutCh2 = await tx.lessonChapter.findUnique({
            where: {
                lessonId_slug_chapter: {
                    lessonId: capcut.id,
                    slug: 'lesson-2',
                },
            },
        });

        if (!capcutCh2) throw new Error('CapCut lesson-2 not found');

        await tx.lessonItem.deleteMany({
            where: { chapterId: capcutCh2.id },
        });

        await tx.lessonItem.createMany({
            data: [
                {
                    chapterId: capcutCh2.id,
                    order: 1,
                    type: LessonItemType.TEXT,
                    text: `🎬 CapCut Pro — Դաս 2

Այս դասում կսովորենք ինչպես ավելացնել տեքստ վիդեոյի վրա։`,
                },
                {
                    chapterId: capcutCh2.id,
                    order: 2,
                    type: LessonItemType.TEXT,
                    text: `💬 Հարցերի դեպքում կարող եք գրել Telegram չատում

https://t.me/+NV_geZ5wfxw3NWUy`,
                },
            ],
        });

        // ---------- CANVA LESSON 1 ----------
        const canvaCh1 = await tx.lessonChapter.findUnique({
            where: {
                lessonId_slug_chapter: {
                    lessonId: canva.id,
                    slug: 'lesson-1',
                },
            },
        });

        if (!canvaCh1) throw new Error('Canva lesson-1 not found');

        await tx.lessonItem.deleteMany({
            where: { chapterId: canvaCh1.id },
        });

        await tx.lessonItem.createMany({
            data: [
                {
                    chapterId: canvaCh1.id,
                    order: 1,
                    type: LessonItemType.TEXT,
                    text: `🎨 Canva Pro — Դաս 1

Բարի գալուստ Canva Pro դասընթաց։`,
                },
                {
                    chapterId: canvaCh1.id,
                    order: 2,
                    type: LessonItemType.TEXT,
                    text: `💬 Հարցերի դեպքում կարող եք գրել Telegram չատում

https://t.me/+NV_geZ5wfxw3NWUy`,
                },
            ],
        });

    });

    console.log('✅ Seed done');

}

seed()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });