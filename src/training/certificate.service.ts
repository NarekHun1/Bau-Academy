import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class CertificateService {
    async generateCertificateBuffer(params: {
        fullName: string;
        courseTitle: string;
        percent: number;
        issuedAt?: Date;
        certificateId?: string;
    }): Promise<Buffer> {
        const {
            fullName,
            courseTitle,
            percent,
            issuedAt = new Date(),
            certificateId,
        } = params;

        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margin: 0,
        });

        const chunks: Buffer[] = [];

        return new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;

            const colors = {
                blue: '#2F35B0',
                orange: '#F8A12D',
                white: '#FFFFFF',
                textDark: '#1F2937',
                textMuted: '#6B7280',
                border: '#E5E7EB',
                softBg: '#F8F9FC',
            };

            // Logo path
            const logoPath = path.join(process.cwd(), 'src', 'assets', 'bau academy.png');            // Для проекта потом лучше заменить на:
            // const logoPath = path.join(process.cwd(), 'src', 'assets', 'bau-logo.png');

            // Background
            doc.rect(0, 0, pageWidth, pageHeight).fill(colors.softBg);

            // Outer border
            doc
                .lineWidth(2)
                .strokeColor(colors.orange)
                .rect(24, 24, pageWidth - 48, pageHeight - 48)
                .stroke();

            // Top header band
            doc
                .fillColor(colors.blue)
                .rect(24, 24, pageWidth - 48, 120)
                .fill();

            // Orange accent line under header
            doc
                .fillColor(colors.orange)
                .rect(24, 144, pageWidth - 48, 8)
                .fill();

            // Logo
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 55, 42, {
                    fit: [220, 80],
                });
            }

            // Header right text
            doc
                .fillColor(colors.white)
                .fontSize(16)
                .text('OFFICIAL CERTIFICATE', pageWidth - 250, 55, {
                    width: 180,
                    align: 'right',
                });

            doc
                .fontSize(11)
                .fillColor('#DDE3FF')
                .text('BAU ACADEMY', pageWidth - 250, 80, {
                    width: 180,
                    align: 'right',
                });

            // Main title
            doc
                .fillColor(colors.textDark)
                .fontSize(28)
                .text('Certificate of Completion', 0, 185, {
                    align: 'center',
                });

            // Subtitle
            doc
                .fillColor(colors.textMuted)
                .fontSize(15)
                .text('This certificate is proudly awarded to', 0, 230, {
                    align: 'center',
                });

            // Name
            doc
                .fillColor(colors.blue)
                .fontSize(30)
                .text(fullName, 100, 270, {
                    width: pageWidth - 200,
                    align: 'center',
                });

            // Orange underline under name
            const underlineWidth = 320;
            const underlineX = (pageWidth - underlineWidth) / 2;
            doc
                .lineWidth(3)
                .strokeColor(colors.orange)
                .moveTo(underlineX, 320)
                .lineTo(underlineX + underlineWidth, 320)
                .stroke();

            // Course text
            doc
                .fillColor(colors.textMuted)
                .fontSize(15)
                .text('for successfully completing the course', 0, 345, {
                    align: 'center',
                });

            doc
                .fillColor(colors.textDark)
                .fontSize(24)
                .text(courseTitle, 120, 380, {
                    width: pageWidth - 240,
                    align: 'center',
                });

            // Score badge
            doc
                .roundedRect(pageWidth / 2 - 85, 430, 170, 44, 12)
                .fillColor(colors.orange)
                .fill();

            doc
                .fillColor(colors.white)
                .fontSize(16)
                .text(`Final Score: ${percent}%`, pageWidth / 2 - 85, 444, {
                    width: 170,
                    align: 'center',
                });

            // Bottom info cards
            const cardY = 510;
            const cardW = 180;
            const gap = 25;
            const totalW = cardW * 3 + gap * 2;
            const startX = (pageWidth - totalW) / 2;

            const dateText = issuedAt.toLocaleDateString('en-GB');

            const cards = [
                { title: 'Issue Date', value: dateText },
                { title: 'Certificate ID', value: certificateId || 'N/A' },
                { title: 'Academy', value: 'BAU Academy' },
            ];

            cards.forEach((card, index) => {
                const x = startX + index * (cardW + gap);

                doc
                    .roundedRect(x, cardY, cardW, 60, 10)
                    .fillColor(colors.white)
                    .fill();

                doc
                    .lineWidth(1)
                    .strokeColor(colors.border)
                    .roundedRect(x, cardY, cardW, 60, 10)
                    .stroke();

                doc
                    .fillColor(colors.textMuted)
                    .fontSize(11)
                    .text(card.title, x, cardY + 12, {
                        width: cardW,
                        align: 'center',
                    });

                doc
                    .fillColor(colors.textDark)
                    .fontSize(13)
                    .text(card.value, x + 10, cardY + 30, {
                        width: cardW - 20,
                        align: 'center',
                    });
            });

            // Signature lines
            const sigY = pageHeight - 70;

            doc
                .lineWidth(1)
                .strokeColor(colors.textMuted)
                .moveTo(90, sigY)
                .lineTo(250, sigY)
                .stroke();

            doc
                .lineWidth(1)
                .strokeColor(colors.textMuted)
                .moveTo(pageWidth - 250, sigY)
                .lineTo(pageWidth - 90, sigY)
                .stroke();

            doc
                .fillColor(colors.textMuted)
                .fontSize(11)
                .text('Instructor / Academy', 90, sigY + 8, {
                    width: 160,
                    align: 'center',
                });

            doc
                .fillColor(colors.textMuted)
                .fontSize(11)
                .text('Authorized Signature', pageWidth - 250, sigY + 8, {
                    width: 160,
                    align: 'center',
                });

            doc.end();
        });
    }

    generateCertificateId(userId: number, quizId: number): string {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');

        return `BAU-${y}${m}${d}-U${userId}-Q${quizId}`;
    }
}