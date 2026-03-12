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
                blueDark: '#23298E',
                orange: '#F8A12D',
                white: '#FFFFFF',
                textDark: '#1F2937',
                textMuted: '#6B7280',
                border: '#E5E7EB',
                softBg: '#F7F8FC',
                cardBg: '#FFFFFF',
                lineSoft: '#C7CDD9',
                shadow: '#EEF1F8',
            };

            const logoPath = path.join(
                process.cwd(),
                'src',
                'assets',
                'bau academy.png',
            );

            const safeText = (value?: string | null) =>
                value && value.trim() ? value.trim() : 'N/A';

            const formatDate = (date: Date) => {
                const d = String(date.getDate()).padStart(2, '0');
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const y = date.getFullYear();
                return `${d}/${m}/${y}`;
            };

            const fitFontSize = (
                text: string,
                maxWidth: number,
                startSize: number,
                minSize: number,
            ) => {
                let size = startSize;
                while (size > minSize) {
                    doc.fontSize(size);
                    if (doc.widthOfString(text) <= maxWidth) return size;
                    size -= 1;
                }
                return minSize;
            };

            const drawCenteredText = (
                text: string,
                y: number,
                size: number,
                color: string,
                options?: { width?: number; x?: number; font?: string },
            ) => {
                doc.font(options?.font || 'Helvetica');

                const width = options?.width ?? pageWidth;
                const x = options?.x ?? 0;

                doc.fillColor(color).fontSize(size).text(text, x, y, {
                    width,
                    align: 'center',
                });
            };

            const drawInfoBlock = (
                x: number,
                y: number,
                w: number,
                h: number,
                title: string,
                value: string,
            ) => {
                doc
                    .save()
                    .roundedRect(x, y + 4, w, h, 12)
                    .fillColor(colors.shadow)
                    .fill()
                    .restore();

                doc
                    .save()
                    .roundedRect(x, y, w, h, 12)
                    .fillColor(colors.cardBg)
                    .fill()
                    .restore();

                doc
                    .lineWidth(1)
                    .strokeColor(colors.border)
                    .roundedRect(x, y, w, h, 12)
                    .stroke();

                doc
                    .fillColor(colors.textMuted)
                    .font('Helvetica')
                    .fontSize(10)
                    .text(title, x, y + 11, {
                        width: w,
                        align: 'center',
                    });

                doc
                    .fillColor(colors.textDark)
                    .font('Helvetica-Bold')
                    .fontSize(12)
                    .text(value, x + 10, y + 28, {
                        width: w - 20,
                        align: 'center',
                    });
            };

            // Background
            doc.rect(0, 0, pageWidth, pageHeight).fill(colors.softBg);

            // Decorative outer border
            doc
                .lineWidth(2)
                .strokeColor(colors.orange)
                .rect(24, 24, pageWidth - 48, pageHeight - 48)
                .stroke();

            // Inner subtle border
            doc
                .lineWidth(1)
                .strokeColor('#D9DDE8')
                .rect(36, 36, pageWidth - 72, pageHeight - 72)
                .stroke();

            // Top header
            doc
                .save()
                .fillColor(colors.blue)
                .rect(24, 24, pageWidth - 48, 118)
                .fill()
                .restore();

            // Top darker strip
            doc
                .save()
                .fillColor(colors.blueDark)
                .rect(24, 24, pageWidth - 48, 24)
                .fill()
                .restore();

            // Orange accent line
            doc
                .fillColor(colors.orange)
                .rect(24, 142, pageWidth - 48, 7)
                .fill();

            // Logo block
            doc
                .save()
                .roundedRect(54, 44, 110, 62, 10)
                .fillColor('#ffffff')
                .fillOpacity(0.08)
                .fill()
                .fillOpacity(1)
                .restore();

            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 62, 51, {
                    fit: [90, 45],
                    valign: 'center',
                });
            } else {
                doc
                    .fillColor(colors.white)
                    .font('Helvetica-Bold')
                    .fontSize(24)
                    .text('BAU', 68, 62);
            }

            // Right header text
            doc
                .fillColor(colors.white)
                .font('Helvetica-Bold')
                .fontSize(16)
                .text('OFFICIAL CERTIFICATE', pageWidth - 270, 56, {
                    width: 200,
                    align: 'right',
                });

            doc
                .fillColor('#D9E1FF')
                .font('Helvetica')
                .fontSize(11)
                .text('BAU ACADEMY', pageWidth - 270, 81, {
                    width: 200,
                    align: 'right',
                });

            // Main title
            drawCenteredText('Certificate of Completion', 182, 29, colors.textDark, {
                font: 'Helvetica-Bold',
            });

            // Subtitle
            drawCenteredText(
                'This certificate is proudly awarded to',
                228,
                14,
                colors.textMuted,
                { font: 'Helvetica' },
            );

            // Full name
            const nameMaxWidth = pageWidth - 220;
            const nameFontSize = fitFontSize(
                safeText(fullName),
                nameMaxWidth,
                31,
                22,
            );

            drawCenteredText(safeText(fullName), 262, nameFontSize, colors.blue, {
                x: 110,
                width: pageWidth - 220,
                font: 'Helvetica-Bold',
            });

            // Orange underline under name
            const underlineWidth = 290;
            const underlineX = (pageWidth - underlineWidth) / 2;

            doc
                .lineWidth(3)
                .strokeColor(colors.orange)
                .moveTo(underlineX, 317)
                .lineTo(underlineX + underlineWidth, 317)
                .stroke();

            // Course subtitle
            drawCenteredText(
                'for successfully completing the course',
                341,
                14,
                colors.textMuted,
                { font: 'Helvetica' },
            );

            // Course title
            const courseMaxWidth = pageWidth - 260;
            const courseFontSize = fitFontSize(
                safeText(courseTitle),
                courseMaxWidth,
                24,
                18,
            );

            drawCenteredText(
                safeText(courseTitle),
                374,
                courseFontSize,
                colors.textDark,
                {
                    x: 130,
                    width: pageWidth - 260,
                    font: 'Helvetica-Bold',
                },
            );

            // Score badge
            const badgeW = 180;
            const badgeH = 46;
            const badgeX = pageWidth / 2 - badgeW / 2;
            const badgeY = 422;

            doc
                .save()
                .roundedRect(badgeX, badgeY + 4, badgeW, badgeH, 13)
                .fillColor('#EFC27A')
                .fill()
                .restore();

            doc
                .save()
                .roundedRect(badgeX, badgeY, badgeW, badgeH, 13)
                .fillColor(colors.orange)
                .fill()
                .restore();

            doc
                .fillColor(colors.white)
                .font('Helvetica-Bold')
                .fontSize(16)
                .text(`Final Score: ${percent}%`, badgeX, badgeY + 14, {
                    width: badgeW,
                    align: 'center',
                });

            // Bottom info blocks
            const infoY = 478;
            const infoW = 175;
            const infoH = 58;
            const infoGap = 24;
            const totalInfoWidth = infoW * 3 + infoGap * 2;
            const startX = (pageWidth - totalInfoWidth) / 2;
            const dateText = formatDate(issuedAt);

            drawInfoBlock(startX, infoY, infoW, infoH, 'Issue Date', dateText);

            drawInfoBlock(
                startX + infoW + infoGap,
                infoY,
                infoW,
                infoH,
                'Certificate ID',
                safeText(certificateId),
            );

            drawInfoBlock(
                startX + (infoW + infoGap) * 2,
                infoY,
                infoW,
                infoH,
                'Issued By',
                'BAU Academy',
            );

            // Signature lines
            const sigLineY = pageHeight - 48;
            const sigTextY = sigLineY + 8;

            // Left signature
            doc
                .lineWidth(1)
                .strokeColor(colors.lineSoft)
                .moveTo(92, sigLineY)
                .lineTo(262, sigLineY)
                .stroke();

            // Right signature
            doc
                .lineWidth(1)
                .strokeColor(colors.lineSoft)
                .moveTo(pageWidth - 262, sigLineY)
                .lineTo(pageWidth - 92, sigLineY)
                .stroke();

            doc
                .fillColor(colors.textMuted)
                .font('Helvetica')
                .fontSize(10)
                .text('Instructor / Academy', 92, sigTextY, {
                    width: 170,
                    align: 'center',
                });

            doc
                .fillColor(colors.textMuted)
                .font('Helvetica')
                .fontSize(10)
                .text('Authorized Signature', pageWidth - 262, sigTextY, {
                    width: 170,
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