import 'dotenv/config';
import { PrismaClient, LessonItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
    const lessons = [
        { slug: 'capcut-pro', title: '🎬 CapCut Pro (Օնլայն դասընթաց)' },
        { slug: 'canva-pro', title: '🎨 Canva Pro (Օնլայն դասընթաց)' },
    ];

    const chapters = [
        { order: 1, slug: 'lesson-1', title: 'Դաս 1 ' },
        { order: 2, slug: 'lesson-2', title: 'Դաս 2 ' },
        { order: 3, slug: 'lesson-3', title: 'Դաս 3 ' },
        { order: 4, slug: 'lesson-4', title: 'Դաս 4 ' },
        { order: 5, slug: 'lesson-5', title: 'Դաս 5 ' },
    ];

    await prisma.$transaction(async (tx) => {
        // 1) Lessons
        for (const l of lessons) {
            await tx.lesson.upsert({
                where: { slug: l.slug },
                update: { title: l.title },
                create: l,
            });
        }

        const capcut = await tx.lesson.findUnique({ where: { slug: 'capcut-pro' } });
        if (!capcut) throw new Error('capcut-pro not found');

        const canva = await tx.lesson.findUnique({ where: { slug: 'canva-pro' } });
        if (!canva) throw new Error('canva-pro not found');

        // 2) Chapters for both lessons
        for (const ch of chapters) {
            await tx.lessonChapter.upsert({
                where: { lessonId_slug_chapter: { lessonId: capcut.id, slug: ch.slug } },
                update: { title: ch.title, order: ch.order },
                create: { lessonId: capcut.id, slug: ch.slug, title: ch.title, order: ch.order },
            });
            await tx.lessonChapter.upsert({
                where: { lessonId_slug_chapter: { lessonId: canva.id, slug: ch.slug } },
                update: { title: ch.title, order: ch.order },
                create: { lessonId: canva.id, slug: ch.slug, title: ch.title, order: ch.order },
            });
        }

        // ─────────────────────────────────────────────
        // CapCut — lesson-1 (твой блок)
        // ─────────────────────────────────────────────
        const capcutCh1 = await tx.lessonChapter.findUnique({
            where: { lessonId_slug_chapter: { lessonId: capcut.id, slug: 'lesson-1' } },
        });
        if (!capcutCh1) throw new Error('CapCut lesson-1 not found');

        await tx.lessonItem.deleteMany({ where: { chapterId: capcutCh1.id } });

        await tx.lessonItem.createMany({
            data: [
                {
                    chapterId: capcutCh1.id,
                    order: 1,
                    type: LessonItemType.TEXT,
                    text: `CapCut Pro

Ողջույն բոլորին։ Սիրով տեղեկացնում եմ, որ սկսում ենք CapCut Pro օնլայն դասընթացը, որի ընթացքում կսովորենք CapCut-ի գաղտնիքները և կստանանք հետաքրքիր ռիլլեր։

Ինչպես ակտիվացնել Pro տարբերակը.
1) Սեղմում ենք “Pro” կոճակի վրա
2) Այնուհետև՝ “Գնել”
3) Եվ ընտրում ենք մեզ հարմար տարբերակը`,
                },
                {
                    chapterId: capcutCh1.id,
                    order: 2,
                    type: LessonItemType.PHOTO,
                    fileId: 'AgACAgIAAxkBAAPIaZRZwOiVa73hg1BhTARRpTxBdp4AAqMTaxv2LalIBKKsfwrtOogBAAMCAAN5AAM6BA'.trim(),
                    text: 'CapCut Pro-ի ինտերֆեյսի օրինակ',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 3,
                    type: LessonItemType.PHOTO,
                    fileId: 'AgACAgIAAxkBAAP0aZR6I68Ko78i01ro1uYgm4y7kLEAAi0Vaxv2LalI3fHbVl0JyXsBAAMCAAN5AAM6BA'.trim(),
                    text: 'Որտե՞ղ է գտնվում “Pro” կոճակը',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 4,
                    type: LessonItemType.PHOTO,
                    fileId: 'AgACAgIAAxkBAAP2aZR6SM4khK1J8Q-RyoyGR9ZuYfwAAi4Vaxv2LalIGxBS4bLeFEIBAAMCAAN5AAM6BA'.trim(),
                    text: 'Սակագնի/պլանի ընտրություն',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 5,
                    type: LessonItemType.TEXT,
                    text: `Դաս 1
🖇️ Ռիլլի ֆորմատ

Եթե ռիլլը Instagram-ի, Facebook-ի կամ TikTok-ի համար է, ապա պետք է ուշադիր լինել ֆորմատին՝ 9:16։
Վերբեռնում ենք մեր ցանկացած վիդեոն, այնուհետև ընտրում ենք “Կողմերի հարաբերակցություն” (соотношения сторон)։`,
                },
                {
                    chapterId: capcutCh1.id,
                    order: 6,
                    type: LessonItemType.PHOTO,
                    fileId: 'AgACAgIAAxkBAAIBEGmUfSFTWV0qAAHH_8DofJ8NFcG9yAACWxVrG_YtqUjinkH_JO67JgEAAwIAA3kAAzoE'.trim(),
                    text: 'Օրինակ',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 7,
                    type: LessonItemType.PHOTO,
                    fileId: 'AgACAgIAAxkBAAIBEmmUfXHhpJr2QSDN5xk5U3dfpwVQAAJcFWsb9i2pSFofAfFCzQ45AQADAgADeQADOgQ'.trim(),
                    text: 'Օրինակ',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 8,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAIBLGmUgBt7T91zwF5uV40HBIPlOwcKAAJXkQAC9i2pSI24LTZD83s7OgQ'.trim(),
                    text: 'Վիդեո հրահանգ՝ 9:16 ֆորմատի համար',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 9,
                    type: LessonItemType.TEXT,
                    text: `🖇️ Ինչպես ավելացնել անցումներ (պերեխոդ)։
Վիդեոյից վիդեո անցման համար սեղմում ենք երկու վիդեոների մեջտեղում և ընտրում մեր ցանկալի անցումը։`,
                },
                {
                    chapterId: capcutCh1.id,
                    order: 10,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAIBYWmUg-FX2wh5ZrE8aAu-UgcEbV7wAAKlkQAC9i2pSFzBjxFsIAHZOgQ'.trim(),
                    text: 'Անցում (պերեխոդ)',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 11,
                    type: LessonItemType.TEXT,
                    text: `🖇️ Ինչպես ստանալ գեղեցիկ սկիզբ և ավարտ ռիլլի համար`,
                },
                {
                    chapterId: capcutCh1.id,
                    order: 12,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAIBY2mUhQABjCZ0e5RVNwnIFioCoblDTAACrpEAAvYtqUgH7LDX1rfPLDoE'.trim(),
                    text: 'Սկիզբ',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 13,
                    type: LessonItemType.TEXT,
                    text: `🖇️ Ինչպես արագացնել և դանդաղեցնել վիդեոն։
Սեղմում ենք վիդեոյի վրա, այնուհետև ընտրում ենք “Արագություն” (скорость)։`,
                },
                {
                    chapterId: capcutCh1.id,
                    order: 14,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAIBZWmUhZiPILYCqKa721DVkJrjvsQMAAK7kQAC9i2pSPs4Unn78hAyOgQ'.trim(),
                    text: 'Արագություն',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 15,
                    type: LessonItemType.TEXT,
                    text: `🖇️ Ինչպես ավելացնել երգ կամ ձայնային էֆֆեկտ։
Կարևոր է, որ երգը կամ ձայնային էֆֆեկտը լինեն արդարացված և համապատասխանեն հոլովակին։
Երգը ցանկալի է լինի թրենդային՝ որպեսզի ապահովի ձեր պատրաստած ռիլլի դիտելիությունը։`,
                },
                {
                    chapterId: capcutCh1.id,
                    order: 16,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAIBZ2mUhhWUVsz6kqM3UDl4Gco-sczHAALFkQAC9i2pSJPCnxBqAAHdUToE'.trim(),
                    text: 'Էֆֆեկտ',
                },
                {
                    chapterId: capcutCh1.id,
                    order: 17,
                    type: LessonItemType.TEXT,
                    text: `🖇🖇️ Առաջադրանք
Նկարել հոլովակ՝ մի քանի կադրից բաղկացած, գեղեցիկ անցումներով և երաժշտությամբ։`,
                },
                {
                    chapterId: capcutCh1.id,
                    order: 18,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAIBaWmUhp9A7jXvfDfWKty7WhSBQIslAALNkQAC9i2pSEWSDpEI4dB_OgQ'.trim(),
                    text: 'Վերջնական արդյունք',
                },
            ],
        });

        // ─────────────────────────────────────────────
        // CapCut — lesson-2 (твой блок со ссылкой)
        // ─────────────────────────────────────────────
        const capcutCh2 = await tx.lessonChapter.findUnique({
            where: { lessonId_slug_chapter: { lessonId: capcut.id, slug: 'lesson-2' } },
        });
        if (!capcutCh2) throw new Error('CapCut lesson-2 not found');

        await tx.lessonItem.deleteMany({ where: { chapterId: capcutCh2.id } });

        await tx.lessonItem.createMany({
            data: [
                {
                    chapterId: capcutCh2.id,
                    order: 1,
                    type: LessonItemType.TEXT,
                    text: `🎬 CapCut Pro — Դաս 2

Այս դասի ընթացքում ինչպես ավելացնել տեքստ վիդեոի վրա և մի քանի ֆունկցիաներ ևս։ 
🖇️ Ինչպես ավելացնել տեքստ։`,
                },
                {
                    chapterId: capcutCh2.id,
                    order: 2,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAICummoBx3DhlUzzrJPraAe-AQ5Q242AAJ-mwACxM1BSZhtH8mwdkXDOgQ'.trim(),
                    text: 'Ինչպես ավելացնել տեքստ',
                },
                {
                    chapterId: capcutCh2.id,
                    order: 3,
                    type: LessonItemType.TEXT,
                    text: `🎬 անիմացիա ֆունկցիան

🖇️ Ինչպես տեքստը ավելի հետաքրքիր դարձնել օգտագործելով անիմացիա ֆունկցիան`,
                },
                {
                    chapterId: capcutCh2.id,
                    order: 4,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAICvGmoCMsaZUqVryuPVST9LgRRxO_AAAKgmwACxM1BSR_46Ywd446VOgQ'.trim(),
                    text: '🎬 անիմացիա ֆունկցիան',
                },
                {
                    chapterId: capcutCh2.id,
                    order: 5,
                    type: LessonItemType.TEXT,
                    text: `🎬 Ինչպես տեքստին գույն տալ

🖇️ Ինչպես տեքստին գույն տալ`,
                },
                {
                    chapterId: capcutCh2.id,
                    order: 6,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAICvmmoCZlihOYejfcxytwmSytQ_7WUAAK6mwACxM1BSb0Qz2vthGnxOgQ'.trim(),
                    text: 'Ինչպես տեքստին գույն տալ',
                },
                {
                    chapterId: capcutCh2.id,
                    order: 7,
                    type: LessonItemType.TEXT,
                    text: `🎬 Ինչպես ավելացնել ձայնային էֆֆեկտ

🖇 Ինչպես ավելացնել ձայնային էֆֆեկտ, ներքևում հղումն է՝ ձայնային էֆֆեկտներ գտնելու համար։

🔗 https://www.instagram.com/reel/C-p9u_kMTRQ/?igsh=MWtkbGx1bGx6MjJ5cQ==`,
                },
                {
                    chapterId: capcutCh2.id,
                    order: 8,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAICwGmoCki0Kx_5_WSWIEGgiTi2IiaZAALSmwACxM1BSb41R8oSgR_2OgQ'.trim(),
                    text: 'Ձայնային էֆֆեկտ',
                },
                {
                    chapterId: capcutCh2.id,
                    order: 9,
                    type: LessonItemType.TEXT,
                    text: `🎬 ️Ինչպես ավելացնել հայկական  շրիֆտ

🖇️Ինչպես ավելացնել հայկական  շրիֆտ`,
                },
                {
                    chapterId: capcutCh2.id,
                    order: 10,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAIDSWmpdVwYpmTMOr3ecRWalnxLtPCRAALblAACxM1RSVQR_hy_3VvzOgQ'.trim(),
                    text: 'հայկական  շրիֆտ',
                },
                {
                    chapterId: capcutCh2.id,
                    order: 11,
                    type: LessonItemType.TEXT,
                    text: `💬 Հարցերի դեպքում կարող եք գրել մեր Telegram չատում։

🔗 https://t.me/+NV_geZ5wfxw3NWUy`,
                },
            ],
        });

        // ─────────────────────────────────────────────
        // Canva — lesson-1 (поправил trim)
        // ─────────────────────────────────────────────
        const canvaCh1 = await tx.lessonChapter.findUnique({
            where: { lessonId_slug_chapter: { lessonId: canva.id, slug: 'lesson-1' } },
        });
        if (!canvaCh1) throw new Error('Canva lesson-1 not found');

        await tx.lessonItem.deleteMany({ where: { chapterId: canvaCh1.id } });
        await tx.lessonItem.createMany({
            data: [
                {
                    chapterId: canvaCh1.id,
                    order: 1,
                    type: LessonItemType.TEXT,
                    text: '🎨 Canva Pro — Դաս 1\n\nԲարի գալուստ։ Ստորև՝ դասերի ցանկը, վիդեոն և առաջադրանքներ։',
                },
                {
                    chapterId: canvaCh1.id,
                    order: 2,
                    type: LessonItemType.BUTTONS,
                    text: 'Ընտրեք դասը 👇',
                },
                {
                    chapterId: canvaCh1.id,
                    order: 3,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAICbmmVq0tmiFhpxwtVDnRIqLUy2n8OAAJ_jAAC9i2xSMFXpRSNROCBOgQ'.trim(),
                    text: 'Վիդեո հրահանգ',
                },
                {
                    chapterId: canvaCh1.id,
                    order: 4,
                    type: LessonItemType.TEXT,
                    text: `💬 Հարցերի դեպքում կարող եք գրել մեր Telegram չատում։

🔗 https://t.me/+NV_geZ5wfxw3NWUy`,
                },
            ],
        });
        // ─────────────────────────────────────────────
// Canva — lesson-2
// ─────────────────────────────────────────────
        const canvaCh2 = await tx.lessonChapter.findUnique({
            where: { lessonId_slug_chapter: { lessonId: canva.id, slug: 'lesson-2' } },
        });
        if (!canvaCh2) throw new Error('Canva lesson-2 not found');

        await tx.lessonItem.deleteMany({ where: { chapterId: canvaCh2.id } });

        await tx.lessonItem.createMany({
            data: [
                {
                    chapterId: canvaCh2.id,
                    order: 1,
                    type: LessonItemType.TEXT,
                    text: `🎨 Canva Pro — Դաս 2`,
                },
                {
                    chapterId: canvaCh2.id,
                    order: 2,
                    type: LessonItemType.BUTTONS,
                    text: 'Գործիքակազմ',
                },
                {
                    chapterId: canvaCh2.id,
                    order: 3,
                    type: LessonItemType.VIDEO,
                    fileId: 'BAACAgIAAxkBAAIDqGmpfocbgKO4F-I6vKIPQAQZ88cVAAJWlQACxM1RSXVt3QlpcxsUOgQ'.trim(),
                    text: 'Գործիքակազմ',
                },
                {
                    chapterId: canvaCh2.id,
                    order: 4,
                    type: LessonItemType.TEXT,
                    text: `💬 Հարցերի դեպքում կարող եք գրել մեր Telegram չատում։

🔗 https://t.me/+NV_geZ5wfxw3NWUy`,
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