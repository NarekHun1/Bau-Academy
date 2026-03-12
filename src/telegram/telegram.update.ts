// src/telegram/telegram.update.ts
import { Update, Start, Ctx, On, Action, Command, Hears } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { TrainingAccessService } from '../training/training-access.service';
import { QuizService } from '../training/quiz.service';
import { CertificateService } from '../training/certificate.service';
import { PrismaService } from '../prisma/prisma.service';


function getAdminIds(config: ConfigService): number[] {
    const raw = config.get<string>('ADMIN_IDS') || '';
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
}

function isAdmin(ctx: Context, adminIds: number[]) {
    const id = ctx.from?.id;
    return !!id && adminIds.includes(id);
}

function getCallbackData(ctx: Context): string | null {
    const cq: any = (ctx as any).callbackQuery;
    if (!cq) return null;
    if (typeof cq.data !== 'string') return null;
    return cq.data;
}

@Update()
export class TelegramUpdate {
    private readonly adminIds: number[];

    constructor(
        private readonly config: ConfigService,
        private readonly access: TrainingAccessService,
        private readonly quizService: QuizService,
        private readonly certificateService: CertificateService,
        private readonly prisma: PrismaService,
    ) {
        this.adminIds = getAdminIds(config);
    }

    // ───────────────────────── QUIZ START ─────────────────────────
    @Action(/^start_quiz_by_chapter:(\d+)$/)
    async startQuizByChapter(@Ctx() ctx: Context) {
        try {
            try {
                await ctx.answerCbQuery();
            } catch {}

            const data = getCallbackData(ctx);
            if (!data) return;

            const match = data.match(/^start_quiz_by_chapter:(\d+)$/);
            if (!match) return;

            const chapterId = Number(match[1]);

            const user = await this.access.findOrCreateUser(ctx);
            const quiz = await this.quizService.getQuizForChapter(chapterId);

            if (!quiz) {
                await ctx.reply('Այս դասի համար թեստ դեռ հասանելի չէ։');
                return;
            }

            const started = await this.quizService.startQuiz(user.id, quiz.id);

            if (!started.question) {
                await ctx.reply('Թեստում հարցեր չկան։');
                return;
            }

            const text = `📝 Թեստ\n\nՀարց ${started.index}/${started.total}\n\n${started.question.text}`;
            const replyMarkup = {
                inline_keyboard: started.question.options.map((opt) => [
                    {
                        text: opt.text,
                        callback_data: `quiz_answer:${started.attempt.id}:${started.question.id}:${opt.order}`,
                    },
                ]),
            };

            try {
                await ctx.editMessageText(text, { reply_markup: replyMarkup });
            } catch {
                await ctx.reply(text, { reply_markup: replyMarkup });
            }
        } catch (e) {
            console.error('startQuizByChapter error', e);
            await ctx.reply('Սխալ առաջացավ թեստը սկսելու ժամանակ։');
        }
    }

    // ───────────────────────── QUIZ ANSWER ─────────────────────────
    @Action(/^quiz_answer:(\d+):(\d+):(\d+)$/)
    async answerQuiz(@Ctx() ctx: Context) {
        try {
            try {
                await ctx.answerCbQuery();
            } catch {}

            const data = getCallbackData(ctx);
            if (!data) return;

            const match = data.match(/^quiz_answer:(\d+):(\d+):(\d+)$/);
            if (!match) return;

            const attemptId = Number(match[1]);
            const questionId = Number(match[2]);
            const selectedOption = Number(match[3]);

            const result = await this.quizService.answerQuestion(
                attemptId,
                questionId,
                selectedOption,
            );

            if (!result.finished) {

                await ctx.editMessageText(
                    `📝 Թեստ\n\nՀարց ${result.index}/${result.total}\n\n${result.question.text}`,
                    {
                        reply_markup: {
                            inline_keyboard: result.question.options.map((opt) => [
                                {
                                    text: opt.text,
                                    callback_data: `quiz_answer:${attemptId}:${result.question.id}:${opt.order}`,
                                },
                            ]),
                        },
                    },
                );
                return;
            }

            const score = result.result.score;
            const total = result.result.total;
            const percent = Math.round((score / total) * 100);

            let comment = 'Լավ արդյունք 👍';
            if (percent >= 90) comment = 'Գերազանց 🎉';
            else if (percent >= 70) comment = 'Շատ լավ ✅';
            else if (percent >= 50) comment = 'Լավ է, բայց արժե կրկնել նյութը 🙂';
            else comment = 'Խորհուրդ է տրվում նորից անցնել դասերը և կրկին փորձել։';

            const fullName = result.result.user.fullName?.trim();

            if (!fullName) {
                await ctx.reply(
                    '🎓 Սերտիֆիկատ ստանալու համար նախ գրեք Ձեր անունն ու ազգանունը։ Օրինակ՝ Արման Օգանեսյան',
                );
                return;
            }

            // Сначала обновляем сообщение с результатом теста
            await ctx.editMessageText(
                `✅ Թեստն ավարտված է\n\n📊 Ձեր արդյունքը՝ ${score}/${total}\n📈 ${percent}%\n💬 ${comment}`,
            );

            // Уведомление админам
            for (const adminId of this.adminIds) {
                try {
                    await ctx.telegram.sendMessage(
                        adminId,
                        `📘 Նոր թեստի արդյունք

👤 Օգտատեր՝ ${fullName}
🆔 Telegram ID: ${result.result.user.telegramId}
📝 Թեստ՝ ${result.result.quiz.title}
✅ Միավոր՝ ${score}/${total}
📈 Տոկոս՝ ${percent}%`,
                    );
                } catch (err) {
                    console.error('send admin quiz result error', err);
                }
            }

            // Если 80%+ — выдаем сертификат
            if (percent >= 80) {
                const certificateId = this.certificateService.generateCertificateId(
                    result.result.user.id,
                    result.result.quiz.id,
                );

                const pdf = await this.certificateService.generateCertificateBuffer({
                    fullName,
                    courseTitle: result.result.quiz.title,
                    percent,
                    issuedAt: new Date(),
                    certificateId,
                });

                await ctx.reply(
                    `🎓 Շնորհավորում ենք ${fullName}!\n\nԴուք հաջողությամբ անցել եք թեստը և ստացել եք սերտիֆիկատ։\n\n📈 Արդյունք՝ ${percent}%`,
                );

                await ctx.telegram.sendDocument(
                    ctx.chat!.id,
                    {
                        source: pdf,
                        filename: `certificate-${certificateId}.pdf`,
                    },
                    {
                        caption: `🎓 Ձեր սերտիֆիկատը\nID: ${certificateId}`,
                    },
                );
            }
            const lessonId = result.result.quiz.lessonId;

            await ctx.reply(
                '⭐ Գնահատեք Canva Pro դասընթացը',
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('⭐', `rate:1:${lessonId}`),
                        Markup.button.callback('⭐⭐', `rate:2:${lessonId}`),
                        Markup.button.callback('⭐⭐⭐', `rate:3:${lessonId}`),
                    ],
                    [
                        Markup.button.callback('⭐⭐⭐⭐', `rate:4:${lessonId}`),
                        Markup.button.callback('⭐⭐⭐⭐⭐', `rate:5:${lessonId}`),
                    ],
                ]),
            );
        } catch (e) {
            console.error('answerQuiz error', e);
            await ctx.reply('Սխալ առաջացավ պատասխանը մշակելիս։');
        }
    }
    @Action(/^rate:(\d+):(\d+)$/)
    async rateLesson(@Ctx() ctx: Context) {
        try {
            await ctx.answerCbQuery();
        } catch {}

        const data = getCallbackData(ctx);
        if (!data) return;

        const match = data.match(/^rate:(\d+):(\d+)$/);
        if (!match) return;

        const rating = Number(match[1]);
        const lessonId = Number(match[2]);

        if (rating < 1 || rating > 5) {
            await ctx.reply('Սխալ գնահատական');
            return;
        }

        const telegramId = ctx.from?.id?.toString();
        if (!telegramId) return;

        const user = await this.prisma.trainingUser.findUnique({
            where: { telegramId },
        });

        if (!user) {
            await ctx.reply('Օգտատերը չի գտնվել');
            return;
        }

        await this.prisma.lessonReview.upsert({
            where: {
                lessonId_userId: {
                    lessonId,
                    userId: user.id,
                },
            },
            update: { rating },
            create: {
                lessonId,
                userId: user.id,
                rating,
            },
        });

        await ctx.editMessageText(
            `✅ Շնորհակալություն գնահատականի համար\n\n⭐ Ձեր գնահատականը՝ ${rating}/5`,
        );
    }

    // ───────────────────────── START ─────────────────────────
    @Start()
    async start(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const telegramId = String(from.id);

        const user = await this.access.upsertUser({
            telegramId,
            username: from.username ?? null,
            firstName: from.first_name ?? null,
            lastName: (from as any).last_name ?? null,
        });

        const already = await this.access.hasAccess(telegramId);
        if (already) {
            const u = await this.access.getUserByTelegramId(telegramId);
            if (u && !u.fullName) {
                await ctx.reply('✅ Մուտքը կա։ Խնդրում եմ գրեք Ձեր անունն ու ազգանունը (օր․ Արման Օգանեսյան)');
                return;
            }

            await ctx.reply(
                '✅ Մուտքը արդեն բացված է։\n\nՍեղմեք՝ 📚 Իմ դասերը',
                Markup.keyboard([['📚 Իմ դասերը']]).resize(),
            );
            return;
        }

        const req = await this.access.createRequestIfNeeded(user.id);

        await ctx.reply(
            '⏳ Հայտը ուղարկվել է ադմինին։\nԵրբ Ձեզ տան կոդը՝ պարզապես ուղարկեք այն այստեղ՝ չատում։',
        );

        const info =
            `🆕 Մուտքի հայտ\n` +
            `ID: ${from.id}\n` +
            `Username: @${from.username || 'չկա'}\n` +
            `Անուն: ${from.first_name || ''} ${(from as any).last_name || ''}\n` +
            `RequestId: ${req.id}`;

        const kb = Markup.inlineKeyboard([
            Markup.button.callback('✅ Տալ կոդը', `REQ_APPROVE:${req.id}`),
            Markup.button.callback('❌ Մերժել', `REQ_REJECT:${req.id}`),
        ]);

        for (const adminId of this.adminIds) {
            try {
                await ctx.telegram.sendMessage(adminId, info, kb);
            } catch {}
        }
    }

    // ───────────────────────── ASSIGNMENTS (stub) ─────────────────────────
    @Action(/ASSIGNMENTS:(.+)/)
    async assignments(@Ctx() ctx: Context) {
        try {
            await ctx.answerCbQuery();
        } catch {}
        await ctx.reply('📋 Առաջադրանքները կհայտնվեն շուտով։');
    }

    // ───────────────────────── OPEN CHAPTER ─────────────────────────
    @Action(/OPEN_CHAPTER:(.+):(.+)/)
    async openChapter(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const telegramId = String(from.id);
        const data = getCallbackData(ctx);
        if (!data) return;

        const [, lessonSlug, chapterSlug] = data.split(':');
        if (!lessonSlug || !chapterSlug) return;

        try {
            await ctx.answerCbQuery('Բացում եմ դասը…');
        } catch {}

        await this.access.sendChapterContent(ctx, telegramId, lessonSlug, chapterSlug);
    }

    // ───────────────────────── LOCKED CHAPTER ─────────────────────────
    @Action(/LOCKED_CHAPTER:(.+):(.+)/)
    async lockedChapter(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const telegramId = String(from.id);
        const data = getCallbackData(ctx);
        if (!data) return;

        const [, lessonSlug, chapterSlug] = data.split(':');
        if (!lessonSlug || !chapterSlug) return;

        try {
            await ctx.answerCbQuery('Փակ է 🔒');
        } catch {}

        await this.access.replyLockedChapter(ctx, telegramId, lessonSlug, chapterSlug);
    }

    // ───────────────────────── OPEN LESSON ─────────────────────────
    @Action(/OPEN_LESSON:(.+)/)
    async openLesson(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const telegramId = String(from.id);
        const data = getCallbackData(ctx);
        if (!data) return;

        const lessonSlug = data.split(':')[1];
        if (!lessonSlug) return;

        try {
            await ctx.answerCbQuery('Բացում եմ…');
        } catch {}

        const res = await this.access.openLessonForUser(telegramId, lessonSlug);
        if (!res.ok) {
            try {
                await ctx.answerCbQuery(res.message || 'Մուտք չկա');
            } catch {}
            return;
        }

        const kb = await this.access.getLessonChaptersKeyboardForUser(telegramId, lessonSlug);
        await ctx.reply(res.text || '📚 Ընտրեք դասը՝', { ...kb, protect_content: true });
    }

    // ───────────────────────── APPROVE/REJECT MAIN ACCESS ─────────────────────────
    @Action(/REQ_APPROVE:(\d+)/)
    async approve(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;

        const data = getCallbackData(ctx);
        if (!data) return;

        const match = data.match(/REQ_APPROVE:(\d+)/);
        const requestId = Number(match?.[1]);
        if (!requestId) return;

        const { req, accessCode } = await this.access.approveRequest(requestId);

        if (!accessCode) {
            try {
                await ctx.answerCbQuery('Հայտը արդեն մշակված է');
            } catch {}
            return;
        }

        try {
            await ctx.answerCbQuery('Կոդը ստեղծվեց ու ուղարկվեց օգտատիրոջը');
        } catch {}

        const tgId = Number(req.user.telegramId);
        try {
            await ctx.telegram.sendMessage(
                tgId,
                `✅ Մուտքը հաստատված է։\nՁեր մեկանգամյա կոդը՝\n\n${accessCode.code}\n\nՈւղարկեք այս կոդը այստեղ՝ չատում։`,
            );
        } catch {}

        try {
            await ctx.editMessageText(
                `✅ Հաստատված է։\nՕգտատեր՝ @${req.user.username || 'չկա'} (${req.user.telegramId})\nԿոդ՝ ${accessCode.code}`,
            );
        } catch {}
    }

    @Action('noop')
    async noop(@Ctx() ctx: Context) {
        try {
            await ctx.answerCbQuery('');
        } catch {}
    }

    @Action(/REQ_REJECT:(\d+)/)
    async reject(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;

        const data = getCallbackData(ctx);
        if (!data) return;

        const match = data.match(/REQ_REJECT:(\d+)/);
        const requestId = Number(match?.[1]);
        if (!requestId) return;

        const { req, user } = await this.access.rejectRequest(requestId);

        try {
            await ctx.answerCbQuery('Հայտը մերժված է');
        } catch {}

        const tgId = Number(user.telegramId);
        try {
            await ctx.telegram.sendMessage(
                tgId,
                '❌ Մուտքը չի հաստատվել։ Եթե սա սխալ է՝ գրեք ադմինին։',
            );
        } catch {}

        try {
            await ctx.editMessageText(
                `❌ Մերժված է։\nՕգտատեր՝ @${user.username || 'չկա'} (${user.telegramId})\nRequestId: ${req.id}`,
            );
        } catch {}
    }

    // ───────────────────────── ADMIN MANUAL GRANT ─────────────────────────
    @Command('grant')
    async grant(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;

        const text = (ctx.message as any)?.text as string;
        const parts = text.split(' ').map((s) => s.trim()).filter(Boolean);

        const telegramId = parts[1];
        const slug = parts[2];

        if (!telegramId || !slug) {
            await ctx.reply(
                '❗ Ֆորմատը՝\n/grant <telegramId> <lesson-slug>\n\nՕրինակ՝\n/grant 123456789 canva-pro',
            );
            return;
        }

        const res = await this.access.grantLessonAccess(telegramId, slug);

        if (!res.ok) {
            await ctx.reply(`❌ ${res.message}`);
            return;
        }

        await ctx.reply(`✅ Մուտքը տրված է դասին՝ ${res.lessonTitle}`);

        try {
            await ctx.telegram.sendMessage(
                Number(telegramId),
                `🎉 Ձեզ բացվել է մուտք դասին՝ ${res.lessonTitle}\n\nՍեղմեք՝ 📚 Իմ դասերը`,
                Markup.keyboard([['📚 Իմ դասերը']]).resize(),
            );
        } catch {}
    }

    // ───────────────────────── MY LESSONS BUTTON ─────────────────────────
    @Hears('📚 Իմ դասերը')
    async myLessons(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const telegramId = String(from.id);

        const u = await this.access.getUserByTelegramId(telegramId);
        if (!u || !u.hasAccess) {
            await ctx.reply('❌ Դուք մուտք չունեք։ Սեղմեք /start');
            return;
        }

        if (!u.fullName) {
            await ctx.reply('Խնդրում եմ գրեք Ձեր անունն ու ազգանունը (օր․ Արման Օգանեսյան)');
            return;
        }

        const kb = await this.access.getMyLessonsKeyboard(telegramId);
        await ctx.reply('📚 Ձեր հասանելի դասերը՝', kb);
    }

    // ───────────────────────── REQUEST LESSON (USER) ─────────────────────────
    @Action(/LESSON_REQ:(.+)/)
    async requestLesson(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const telegramId = String(from.id);

        const u = await this.access.getUserByTelegramId(telegramId);
        if (!u || !u.hasAccess) {
            try {
                await ctx.answerCbQuery('Մուտք չկա։ Սեղմեք /start');
            } catch {}
            return;
        }

        if (!u.fullName) {
            try {
                await ctx.answerCbQuery('Նախ գրեք Ձեր անունն ու ազգանունը');
            } catch {}
            await ctx.reply('Խնդրում եմ գրեք Ձեր անունն ու ազգանունը (օր․ Արման Օգանեսյան)');
            return;
        }

        const data = getCallbackData(ctx);
        if (!data) return;
        const slug = data.split(':')[1];

        const result = await this.access.createLessonRequest(telegramId, slug);

        if (!result.ok) {
            try {
                await ctx.answerCbQuery(result.message || 'Սխալ');
            } catch {}
            return;
        }

        try {
            await ctx.answerCbQuery('Հայտը ուղարկվեց ադմինին ✅');
        } catch {}
        await ctx.reply('⏳ Հայտը ուղարկվել է ադմինին։ Սպասեք հաստատմանը։');

        const kb = Markup.inlineKeyboard([
            Markup.button.callback('✅ Հաստատել', `LESSON_APPROVE:${result.requestId}`),
            Markup.button.callback('❌ Մերժել', `LESSON_REJECT:${result.requestId}`),
        ]);

        const info =
            `🆕 Դասի հարցում\n` +
            `Օգտատեր՝ ${result.fullName}\n` +
            `Username: @${result.username || 'չկա'}\n` +
            `TG_ID: ${from.id}\n` +
            `Դաս՝ ${result.lessonTitle}\n` +
            `RequestId: ${result.requestId}`;

        for (const adminId of this.adminIds) {
            try {
                await ctx.telegram.sendMessage(adminId, info, kb);
            } catch {}
        }
    }

    // ───────────────────────── ADMIN APPROVE/REJECT LESSON ─────────────────────────
    @Action(/LESSON_APPROVE:(\d+)/)
    async lessonApprove(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;

        const data = getCallbackData(ctx);
        if (!data) return;

        const id = Number(data.split(':')[1]);
        if (!id) return;

        const res = await this.access.approveLessonRequest(id);

        try {
            await ctx.answerCbQuery('Հաստատված է ✅');
        } catch {}

        try {
            await ctx.telegram.sendMessage(
                Number(res.telegramId),
                `✅ Ձեզ բացվել է մուտք դասին՝ ${res.lessonTitle}\n\nՍեղմեք՝ 📚 Իմ դասերը`,
                Markup.keyboard([['📚 Իմ դասերը']]).resize(),
            );
        } catch {}

        try {
            await ctx.editMessageText(
                `✅ Հաստատված է՝ ${res.lessonTitle}\nՕգտատեր՝ ${res.fullName} (${res.telegramId})`,
            );
        } catch {}
    }

    @Action('MY_LESSONS_REFRESH')
    async refreshMyLessons(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;
        const telegramId = String(from.id);

        const kb = await this.access.getMyLessonsKeyboard(telegramId);
        try {
            await ctx.answerCbQuery();
        } catch {}
        await ctx.reply('📚 Ձեր հասանելի դասերը՝', kb);
    }

    @Action('LESSONS_MENU')
    async lessonsMenu(@Ctx() ctx: Context) {
        try {
            await ctx.answerCbQuery();
        } catch {}
        await ctx.reply(
            'Ընտրեք այն դասը, որի համար ցանկանում եք ստանալ մուտք՝',
            this.access.lessonsKeyboard(),
        );
    }

    @Action(/LESSON_REJECT:(\d+)/)
    async lessonReject(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;

        const data = getCallbackData(ctx);
        if (!data) return;

        const id = Number(data.split(':')[1]);
        if (!id) return;

        const res = await this.access.rejectLessonRequest(id);

        try {
            await ctx.answerCbQuery('Մերժված է ❌');
        } catch {}

        try {
            await ctx.telegram.sendMessage(
                Number(res.telegramId),
                `❌ «${res.lessonTitle}» դասին մուտքը չի հաստատվել։`,
            );
        } catch {}

        try {
            await ctx.editMessageText(
                `❌ Մերժված է՝ ${res.lessonTitle}\nՕգտատեր՝ ${res.fullName} (${res.telegramId})`,
            );
        } catch {}
    }

    // ───────────────────────── TEXT HANDLER ─────────────────────────
    @On('text')
    async onText(@Ctx() ctx: Context) {
        const from = ctx.from;
        const text = (ctx.message as any)?.text as string | undefined;
        if (!from || !text) return;

        const telegramId = String(from.id);
        const t = text.trim();

        const user = await this.access.getUserByTelegramId(telegramId);
        if (user?.hasAccess && !user.fullName) {
            if (t.split(' ').length < 2) {
                await ctx.reply('Խնդրում եմ գրեք անուն և ազգանուն (2 բառ)։ Օրինակ՝ Արման Օգանեսյան');
                return;
            }

            await this.access.setUserFullName(telegramId, t);

            await ctx.reply(
                '✅ Հիանալի է։ Հիմա ընտրեք, որ դասին եք ուզում ստանալ մուտք՝',
                this.access.lessonsKeyboard(),
            );
            return;
        }

        if (!(await this.access.hasAccess(telegramId))) {
            const res = await this.access.activateCodeForUser(telegramId, t);

            if (res.ok) {
                await ctx.reply('✅ Կոդը ընդունվեց։ Հիմա գրեք Ձեր անունն ու ազգանունը (օր․ Արման Օգանեսյան)');
                return;
            }

            const msg =
                res.reason === 'not_found'
                    ? '❌ Կոդը չի գտնվել։ Ստուգեք և ուղարկեք նորից։'
                    : res.reason === 'used'
                        ? '❌ Այս կոդը արդեն օգտագործված է։'
                        : res.reason === 'not_yours'
                            ? '❌ Սա Ձեր կոդը չէ (կապված է այլ օգտատիրոջ հետ)։'
                            : res.reason === 'expired'
                                ? '❌ Կոդը ժամկետանց է։ Խնդրեք նոր կոդ։'
                                : '❌ Չհաջողվեց ընդունել կոդը։';

            await ctx.reply(msg);
            return;
        }
    }

    // ───────────────────────── ADMIN: GET FILE_ID ─────────────────────────
    @Command('id')
    async idHelp(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;
        await ctx.reply(
            '✅ file_id ռեժիմ։\n' +
            'Ուղարկեք ինձ ՖՈՏՈ / ՎԻԴԵՈ / ՓԱՍՏԱԹՈՒՂԹ — ես կվերադարձնեմ file_id-ն։\n\n' +
            'Հետո այդ file_id-ն կդնեք ԲԴ-ի մեջ (LessonItem.fileId)։',
        );
    }

    @On('photo')
    async onAdminPhoto(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;

        const photos = (ctx.message as any)?.photo as Array<{ file_id: string }> | undefined;
        const fileId = photos?.[photos.length - 1]?.file_id;
        if (!fileId) return;

        const caption = (ctx.message as any)?.caption as string | undefined;
        await ctx.reply(`📸 PHOTO file_id:\n\n${fileId}` + (caption ? `\n\ncaption: ${caption}` : ''));
    }

    @On('video')
    async onAdminVideo(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;

        const video = (ctx.message as any)?.video as { file_id: string } | undefined;
        if (!video?.file_id) return;

        const caption = (ctx.message as any)?.caption as string | undefined;
        await ctx.reply(`🎥 VIDEO file_id:\n\n${video.file_id}` + (caption ? `\n\ncaption: ${caption}` : ''));
    }

    @On('document')
    async onAdminDocument(@Ctx() ctx: Context) {
        if (!isAdmin(ctx, this.adminIds)) return;

        const doc = (ctx.message as any)?.document as { file_id: string; file_name?: string } | undefined;
        if (!doc?.file_id) return;

        await ctx.reply(
            `📄 DOCUMENT file_id:\n\n${doc.file_id}` + (doc.file_name ? `\n\nname: ${doc.file_name}` : ''),
        );
    }
}