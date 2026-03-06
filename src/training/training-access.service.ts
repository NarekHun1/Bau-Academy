// src/training/training-access.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Markup } from 'telegraf';
import { LessonItemType } from '@prisma/client';

function genCode() {
    const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    return `MC-${part()}-${part()}`;
}

const LESSONS: { slug: string; title: string; emoji: string }[] = [
    { slug: 'canva-pro', title: 'Canva Pro', emoji: '🎨' },
    { slug: 'telegram', title: 'Telegram', emoji: '✈️' },
    { slug: 'linkedin', title: 'LinkedIn', emoji: '💼' },
    { slug: 'capcut-pro', title: 'CapCut Pro', emoji: '🎬' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hasUrl(text?: string | null) {
    if (!text) return false;
    return /https?:\/\/\S+/i.test(text);
}

// ─────────────────────────────────────────────
// 🔒 24h unlock settings
// ─────────────────────────────────────────────
const UNLOCK_HOURS = 24;
const UNLOCK_MS = UNLOCK_HOURS * 60 * 60 * 1000;

@Injectable()
export class TrainingAccessService {
    constructor(private readonly prisma: PrismaService) {}

    // ───────────────────────── USERS ─────────────────────────
    async upsertUser(tg: {
        telegramId: string;
        username?: string | null;
        firstName?: string | null;
        lastName?: string | null;
    }) {
        return this.prisma.trainingUser.upsert({
            where: { telegramId: tg.telegramId },
            create: {
                telegramId: tg.telegramId,
                username: tg.username ?? null,
                firstName: tg.firstName ?? null,
                lastName: tg.lastName ?? null,
            },
            update: {
                username: tg.username ?? null,
                firstName: tg.firstName ?? null,
                lastName: tg.lastName ?? null,
            },
        });
    }

    async getUserByTelegramId(telegramId: string) {
        return this.prisma.trainingUser.findUnique({ where: { telegramId } });
    }

    async setUserFullName(telegramId: string, fullName: string) {
        return this.prisma.trainingUser.update({
            where: { telegramId },
            data: { fullName },
        });
    }

    async hasAccess(telegramId: string) {
        const u = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        return !!u?.hasAccess;
    }

    // ───────────────────────── MAIN ACCESS REQUESTS (CODE FLOW) ─────────────────────────
    async createRequestIfNeeded(userId: number) {
        const pending = await this.prisma.accessRequest.findFirst({
            where: { userId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
        });
        if (pending) return pending;

        return this.prisma.accessRequest.create({
            data: { userId, status: 'PENDING' },
        });
    }

    // ───────────────────────── LESSONS (KEYBOARDS) ─────────────────────────
    lessonsKeyboard() {
        return Markup.inlineKeyboard(
            LESSONS.map((l) => [Markup.button.callback(`${l.emoji} ${l.title}`, `LESSON_REQ:${l.slug}`)]),
        );
    }

    async getMyLessonsKeyboard(telegramId: string) {
        const user = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        if (!user) {
            return Markup.inlineKeyboard([[Markup.button.callback('Օգտատերը չի գտնվել', 'noop')]]);
        }

        const accesses = await this.prisma.userLessonAccess.findMany({
            where: { userId: user.id },
            include: { lesson: true },
            orderBy: { grantedAt: 'asc' },
        });

        if (accesses.length === 0) {
            return Markup.inlineKeyboard([
                [Markup.button.callback('⏳ Բաց դասեր դեռ չկան', 'noop')],
                [Markup.button.callback('📩 Ընտրել նոր դաս', 'LESSONS_MENU')],
            ]);
        }

        const rows = accesses.map((a) => [Markup.button.callback(`✅ ${a.lesson.title}`, `OPEN_LESSON:${a.lesson.slug}`)]);
        rows.push([Markup.button.callback('📩 Ընտրել նոր դաս', 'LESSONS_MENU')]);
        return Markup.inlineKeyboard(rows);
    }

    private formatRemaining(ms: number) {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        return `${h}ժ ${m}ր`;
    }

    private async ensureFirstChapterUnlocked(userId: number, lessonId: number) {
        const chapters = await this.prisma.lessonChapter.findMany({
            where: { lessonId },
            orderBy: { order: 'asc' },
        });
        const first = chapters[0];
        if (!first) return;

        // if exists -> ok, if not -> create
        const existing = await this.prisma.userChapterProgress.findUnique({
            where: { userId_chapterId: { userId, chapterId: first.id } },
        });
        if (existing) return;

        await this.prisma.userChapterProgress.create({
            data: { userId, lessonId, chapterId: first.id, unlockedAt: new Date() },
        });
    }

    private async getChaptersUnlockInfo(userId: number, lessonId: number) {
        const chapters = await this.prisma.lessonChapter.findMany({
            where: { lessonId },
            orderBy: { order: 'asc' },
        });

        // ensure chapter-1 unlocked
        if (chapters.length) {
            await this.ensureFirstChapterUnlocked(userId, lessonId);
        }

        const progresses = await this.prisma.userChapterProgress.findMany({
            where: { userId, lessonId },
        });
        const progMap = new Map(progresses.map((p) => [p.chapterId, p]));

        return chapters.map((ch, idx) => {
            if (idx === 0) {
                return { ch, isOpen: true, remainingMs: 0, willOpenAt: null as Date | null };
            }

            const prev = chapters[idx - 1];
            const prevProg = progMap.get(prev.id);

            if (!prevProg) {
                // if somehow previous doesn't exist -> treat as locked
                return { ch, isOpen: false, remainingMs: UNLOCK_MS, willOpenAt: null as Date | null };
            }

            const willOpenAt = new Date(prevProg.unlockedAt.getTime() + UNLOCK_MS);
            const remainingMs = willOpenAt.getTime() - Date.now();

            return {
                ch,
                isOpen: remainingMs <= 0,
                remainingMs: Math.max(0, remainingMs),
                willOpenAt,
            };
        });
    }

    private async isChapterUnlocked(userId: number, lessonId: number, chapterId: number) {
        const info = await this.getChaptersUnlockInfo(userId, lessonId);
        const row = info.find((x) => x.ch.id === chapterId);
        return row?.isOpen ?? false;
    }

    private async unlockThisChapterIfTime(userId: number, lessonId: number, chapterId: number) {
        // When the user opens an unlocked chapter first time:
        // create progress row (unlockedAt = now) if not exists.
        const existing = await this.prisma.userChapterProgress.findUnique({
            where: { userId_chapterId: { userId, chapterId } },
        });
        if (existing) return existing;

        return this.prisma.userChapterProgress.create({
            data: { userId, lessonId, chapterId, unlockedAt: new Date(), openedAt: new Date() },
        });
    }

    private async markChapterOpened(userId: number, chapterId: number) {
        // don't overwrite if already set
        await this.prisma.userChapterProgress.updateMany({
            where: { userId, chapterId, openedAt: null },
            data: { openedAt: new Date() },
        });
    }

    // ───────────────────────── CHAPTERS KEYBOARD (with 🔒) ─────────────────────────
    async getLessonChaptersKeyboardForUser(telegramId: string, lessonSlug: string) {
        const user = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        if (!user) return Markup.inlineKeyboard([[Markup.button.callback('Օգտատերը չի գտնվել', 'noop')]]);

        const lesson = await this.prisma.lesson.findUnique({ where: { slug: lessonSlug } });
        if (!lesson) return Markup.inlineKeyboard([[Markup.button.callback('Դասը չի գտնվել', 'noop')]]);

        const chaptersInfo = await this.getChaptersUnlockInfo(user.id, lesson.id);

        if (!chaptersInfo.length) {
            return Markup.inlineKeyboard([[Markup.button.callback('⏳ Դասերը դեռ չկան', 'noop')]]);
        }

        return Markup.inlineKeyboard(
            chaptersInfo.map(({ ch, isOpen }) => {
                if (isOpen) {
                    return [Markup.button.callback(`📘 ${ch.title}`, `OPEN_CHAPTER:${lessonSlug}:${ch.slug}`)];
                }
                return [Markup.button.callback(`🔒 ${ch.title}`, `LOCKED_CHAPTER:${lessonSlug}:${ch.slug}`)];
            }),
        );
    }

    // ───────────────────────── OPEN LESSON (shows chapters) ─────────────────────────
    async openLessonForUser(
        telegramId: string,
        slug: string,
    ): Promise<{ ok: boolean; message?: string; text?: string; kb?: any }> {
        const user = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        if (!user) return { ok: false, message: 'Օգտատերը չի գտնվել' };
        if (!user.hasAccess) return { ok: false, message: 'Մուտք չկա։ Սեղմեք /start' };

        const lesson = await this.prisma.lesson.findUnique({ where: { slug } });
        if (!lesson) return { ok: false, message: 'Դասընթացը չի գտնվել' };

        const access = await this.prisma.userLessonAccess.findUnique({
            where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
        });
        if (!access) return { ok: false, message: 'Այս դասընթացին մուտք չունեք' };

        const kbChapters = await this.getLessonChaptersKeyboardForUser(telegramId, slug);

        const kb = Markup.inlineKeyboard([
            ...(kbChapters.reply_markup?.inline_keyboard ?? []),
            [Markup.button.callback('⬅️ Վերադառնալ իմ դասերին', 'MY_LESSONS_REFRESH')],
            [Markup.button.callback('📩 Հարցում ուղարկել այլ դասընթացի համար', 'LESSONS_MENU')],
        ]);

        const text = `📘 ${lesson.title}\n\nԸնտրեք դասը (գլուխը) 👇`;
        return { ok: true, text, kb };
    }

    // ───────────────────────── LOCKED CHAPTER MESSAGE ─────────────────────────
    async replyLockedChapter(ctx: any, telegramId: string, lessonSlug: string, chapterSlug: string) {
        const user = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        if (!user) return;

        if (!user.hasAccess) {
            await ctx.reply('Մուտք չկա։ Սեղմեք /start', { protect_content: true });
            return;
        }

        const lesson = await this.prisma.lesson.findUnique({ where: { slug: lessonSlug } });
        if (!lesson) {
            await ctx.reply('Դասընթացը չի գտնվել', { protect_content: true });
            return;
        }

        const chapter = await this.prisma.lessonChapter.findUnique({
            where: { lessonId_slug_chapter: { lessonId: lesson.id, slug: chapterSlug } },
        });
        if (!chapter) {
            await ctx.reply('Դասը չի գտնվել', { protect_content: true });
            return;
        }

        const info = await this.getChaptersUnlockInfo(user.id, lesson.id);
        const row = info.find((x) => x.ch.id === chapter.id);
        if (!row) return;

        const left = this.formatRemaining(row.remainingMs);

        await ctx.reply(
            `🔒 Այս դասը դեռ փակ է։\n\nՀաջորդ դասերը բացվում են յուրաքանչյուր ${UNLOCK_HOURS} ժամ հետո։\nՄնաց՝ ${left}`,
            { protect_content: true, parse_mode: undefined as any, disable_web_page_preview: true },
        );
    }

    // ───────────────────────── SEND CHAPTER CONTENT (with unlock check + next countdown) ─────────────────────────
    async sendChapterContent(ctx: any, telegramId: string, lessonSlug: string, chapterSlug: string) {
        const user = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        if (!user) return;

        if (!user.hasAccess) {
            await ctx.reply('Մուտք չկա։ Սեղմեք /start');
            return;
        }

        const lesson = await this.prisma.lesson.findUnique({ where: { slug: lessonSlug } });
        if (!lesson) {
            await ctx.reply('Դասընթացը չի գտնվել');
            return;
        }

        const access = await this.prisma.userLessonAccess.findUnique({
            where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
        });
        if (!access) {
            await ctx.reply('Այս դասընթացին մուտք չունեք');
            return;
        }

        const chapter = await this.prisma.lessonChapter.findUnique({
            where: { lessonId_slug_chapter: { lessonId: lesson.id, slug: chapterSlug } },
        });
        if (!chapter) {
            await ctx.reply('Դասը չի գտնվել');
            return;
        }

        // 🔒 CHECK UNLOCK
        const unlocked = await this.isChapterUnlocked(user.id, lesson.id, chapter.id);
        if (!unlocked) {
            await this.replyLockedChapter(ctx, telegramId, lessonSlug, chapterSlug);
            return;
        }

        // create progress row for this chapter if not exists (so next chapter timer starts)
        await this.unlockThisChapterIfTime(user.id, lesson.id, chapter.id);
        await this.markChapterOpened(user.id, chapter.id);

        const items = await this.prisma.lessonItem.findMany({
            where: { chapterId: chapter.id },
            orderBy: { order: 'asc' },
        });

        if (!items.length) {
            await ctx.reply('Այս դասը դեռ դատարկ է');
            return;
        }

        const protect = { protect_content: true };

        await ctx.reply(`📘 ${chapter.title}`, protect);
        await sleep(200);

        for (const item of items) {
            const caption = item.text ?? '';
            const urlInside = hasUrl(caption);

            const textOpts = {
                ...protect,
                parse_mode: undefined as any,
                // if there is url -> allow preview, else disable it
                disable_web_page_preview: !urlInside,
            };

            switch (item.type) {
                case LessonItemType.TEXT:
                    if (caption.trim()) {
                        await ctx.reply(caption, textOpts);
                        await sleep(180);
                    }
                    break;

                case LessonItemType.PHOTO: {
                    const src = (item.fileId || item.url || '').trim();
                    if (!src) break;

                    await ctx.replyWithPhoto(src, {
                        caption: caption || undefined,
                        parse_mode: undefined as any,
                        ...protect,
                    });
                    await sleep(220);
                    break;
                }

                case LessonItemType.VIDEO: {
                    const src = (item.fileId || item.url || '').trim();
                    if (!src) break;

                    await ctx.replyWithVideo(src, {
                        caption: caption || undefined,
                        parse_mode: undefined as any,
                        ...protect,
                    });
                    await sleep(300);
                    break;
                }

                case LessonItemType.DOCUMENT: {
                    const src = (item.fileId || item.url || '').trim();
                    if (!src) break;

                    await ctx.replyWithDocument(src, protect);
                    await sleep(300);
                    break;
                }

                case LessonItemType.LINK: {
                    const link = (item.url || '').trim();
                    if (!link) break;

                    await ctx.reply(`🔗 ${link}`, {
                        ...protect,
                        parse_mode: undefined as any,
                        disable_web_page_preview: false,
                    });
                    await sleep(150);
                    break;
                }

                case LessonItemType.BUTTONS: {
                    // show chapters list with locks
                    const kbChapters = await this.getLessonChaptersKeyboardForUser(telegramId, lessonSlug);
                    await ctx.reply(caption || 'Ընտրեք դասը 👇', {
                        ...kbChapters,
                        ...protect,
                        parse_mode: undefined as any,
                    });
                    await sleep(200);
                    break;
                }
            }
        }

        // ⏳ show next chapter countdown (like "lesson-2 opens in 24h")
        const info = await this.getChaptersUnlockInfo(user.id, lesson.id);
        const current = info.find((x) => x.ch.id === chapter.id);
        const next = info.find((x) => x.ch.order === (current?.ch.order ?? 0) + 1);

        if (next && !next.isOpen) {
            const left = this.formatRemaining(next.remainingMs);
            await ctx.reply(`⏳ Հաջորդ դասը (${next.ch.title}) կբացվի ${UNLOCK_HOURS} ժամ հետո։\nՄնաց՝ ${left}`, {
                ...protect,
                parse_mode: undefined as any,
                disable_web_page_preview: true,
            });
            await sleep(120);
        }

        await ctx.reply('Ընտրեք գործողությունը՝', {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📚 Գլուխների ցուցակ', `OPEN_LESSON:${lessonSlug}`)],
                [Markup.button.callback('📚 Իմ դասերը', 'MY_LESSONS_REFRESH')],
            ]),
            ...protect,
            parse_mode: undefined as any,
        });
    }

    // ───────────────────────── APPROVE/REJECT BASE ACCESS ─────────────────────────
    async approveRequest(requestId: number): Promise<{ req: any; accessCode: { code: string } | null }> {
        const req = await this.prisma.accessRequest.findUnique({
            where: { id: requestId },
            include: { user: true },
        });
        if (!req) throw new ForbiddenException('Հարցումը չի գտնվել');

        if (req.status !== 'PENDING') return { req, accessCode: null };

        await this.prisma.accessRequest.update({
            where: { id: requestId },
            data: { status: 'APPROVED', decidedAt: new Date() },
        });

        let code = genCode();
        for (let i = 0; i < 5; i++) {
            const exists = await this.prisma.accessCode.findUnique({ where: { code } });
            if (!exists) break;
            code = genCode();
        }

        const accessCode = await this.prisma.accessCode.create({
            data: { code, userId: req.userId, isUsed: false },
            select: { code: true },
        });

        const updatedReq = await this.prisma.accessRequest.findUnique({
            where: { id: requestId },
            include: { user: true },
        });

        return { req: updatedReq!, accessCode };
    }

    async rejectRequest(requestId: number) {
        const req = await this.prisma.accessRequest.findUnique({
            where: { id: requestId },
            include: { user: true },
        });
        if (!req) throw new ForbiddenException('Հարցումը չի գտնվել');

        const updated = await this.prisma.accessRequest.update({
            where: { id: requestId },
            data: { status: 'REJECTED', decidedAt: new Date() },
        });

        return { req: updated, user: req.user };
    }

    async activateCodeForUser(telegramId: string, codeRaw: string) {
        const code = codeRaw.trim().toUpperCase();

        const user = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        if (!user) throw new ForbiddenException('Օգտատերը չի գտնվել');

        const accessCode = await this.prisma.accessCode.findUnique({
            where: { code },
            include: { user: true },
        });

        if (!accessCode) return { ok: false, reason: 'not_found' as const };
        if (accessCode.isUsed) return { ok: false, reason: 'used' as const };
        if (accessCode.userId !== user.id) return { ok: false, reason: 'not_yours' as const };
        if (accessCode.expiresAt && accessCode.expiresAt.getTime() < Date.now()) {
            return { ok: false, reason: 'expired' as const };
        }

        await this.prisma.$transaction([
            this.prisma.accessCode.update({
                where: { id: accessCode.id },
                data: { isUsed: true, usedAt: new Date() },
            }),
            this.prisma.trainingUser.update({
                where: { id: user.id },
                data: { hasAccess: true },
            }),
        ]);

        return { ok: true as const };
    }

    // ───────────────────────── ADMIN MANUAL GRANT ─────────────────────────
    async grantLessonAccess(
        telegramId: string,
        slug: string,
    ): Promise<{ ok: boolean; lessonTitle?: string; message?: string }> {
        const user = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        if (!user) return { ok: false, message: 'Օգտատերը չի գտնվել' };

        const lesson = await this.prisma.lesson.findUnique({ where: { slug } });
        if (!lesson) return { ok: false, message: 'Դասընթացը չի գտնվել' };

        await this.prisma.userLessonAccess.upsert({
            where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
            update: {},
            create: { userId: user.id, lessonId: lesson.id },
        });

        // 🔒 ensure first chapter unlocked when lesson granted
        await this.ensureFirstChapterUnlocked(user.id, lesson.id);

        return { ok: true, lessonTitle: lesson.title };
    }

    // ───────────────────────── LESSON ACCESS REQUESTS ─────────────────────────
    async createLessonRequest(
        telegramId: string,
        slug: string,
    ): Promise<{
        ok: boolean;
        message?: string;
        requestId?: number;
        lessonTitle?: string;
        fullName?: string;
        username?: string | null;
    }> {
        const user = await this.prisma.trainingUser.findUnique({ where: { telegramId } });
        if (!user) return { ok: false, message: 'Օգտատերը չի գտնվել' };
        if (!user.hasAccess) return { ok: false, message: 'Մուտք չկա։ Սեղմեք /start' };
        if (!user.fullName) return { ok: false, message: 'Նախ ուղարկեք Ձեր անունը և ազգանունը' };

        const lesson = await this.prisma.lesson.findUnique({ where: { slug } });
        if (!lesson) return { ok: false, message: 'Դասընթացը չի գտնվել' };

        const already = await this.prisma.userLessonAccess.findFirst({
            where: { userId: user.id, lessonId: lesson.id },
        });
        if (already) return { ok: false, message: 'Այս դասընթացին արդեն ունեք մուտք' };

        const pending = await this.prisma.lessonAccessRequest.findFirst({
            where: { userId: user.id, lessonId: lesson.id, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
        });
        if (pending) {
            return {
                ok: true,
                requestId: pending.id,
                lessonTitle: lesson.title,
                fullName: user.fullName,
                username: user.username ?? null,
            };
        }

        const req = await this.prisma.lessonAccessRequest.create({
            data: { userId: user.id, lessonId: lesson.id, status: 'PENDING' },
        });

        return {
            ok: true,
            requestId: req.id,
            lessonTitle: lesson.title,
            fullName: user.fullName,
            username: user.username ?? null,
        };
    }

    async approveLessonRequest(requestId: number): Promise<{ telegramId: string; lessonTitle: string; fullName: string }> {
        const req = await this.prisma.lessonAccessRequest.findUnique({
            where: { id: requestId },
            include: { user: true, lesson: true },
        });
        if (!req) throw new ForbiddenException('Դասընթացի հարցումը չի գտնվել');

        if (req.status !== 'PENDING') {
            return {
                telegramId: req.user.telegramId,
                lessonTitle: req.lesson.title,
                fullName: req.user.fullName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
            };
        }

        await this.prisma.$transaction([
            this.prisma.lessonAccessRequest.update({
                where: { id: requestId },
                data: { status: 'APPROVED', decidedAt: new Date() },
            }),
            this.prisma.userLessonAccess.upsert({
                where: { userId_lessonId: { userId: req.userId, lessonId: req.lessonId } },
                update: {},
                create: { userId: req.userId, lessonId: req.lessonId },
            }),
        ]);

        // 🔒 ensure first chapter unlocked after approval
        await this.ensureFirstChapterUnlocked(req.userId, req.lessonId);

        return {
            telegramId: req.user.telegramId,
            lessonTitle: req.lesson.title,
            fullName: req.user.fullName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        };
    }

    async rejectLessonRequest(requestId: number): Promise<{ telegramId: string; lessonTitle: string; fullName: string }> {
        const req = await this.prisma.lessonAccessRequest.findUnique({
            where: { id: requestId },
            include: { user: true, lesson: true },
        });
        if (!req) throw new ForbiddenException('Դասընթացի հարցումը չի գտնվել');

        if (req.status === 'PENDING') {
            await this.prisma.lessonAccessRequest.update({
                where: { id: requestId },
                data: { status: 'REJECTED', decidedAt: new Date() },
            });
        }

        return {
            telegramId: req.user.telegramId,
            lessonTitle: req.lesson.title,
            fullName: req.user.fullName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        };
    }
}