import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

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
            margin: 50,
        });

        const chunks: Buffer[] = [];

        return new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Background frame
            doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(3).stroke();

            // Title
            doc.moveDown(0.5);
            doc
                .fontSize(30)
                .text('CERTIFICATE OF COMPLETION', {
                    align: 'center',
                });

            doc.moveDown(1);

            doc
                .fontSize(18)
                .text('This certificate is proudly awarded to', {
                    align: 'center',
                });

            doc.moveDown(0.8);

            doc
                .fontSize(28)
                .text(fullName, {
                    align: 'center',
                    underline: true,
                });

            doc.moveDown(1);

            doc
                .fontSize(18)
                .text('for successfully completing the course', {
                    align: 'center',
                });

            doc.moveDown(0.8);

            doc
                .fontSize(24)
                .text(courseTitle, {
                    align: 'center',
                });

            doc.moveDown(1);

            doc
                .fontSize(16)
                .text(`Final score: ${percent}%`, {
                    align: 'center',
                });

            doc.moveDown(0.5);

            const dateText = issuedAt.toLocaleDateString('en-GB');
            doc
                .fontSize(14)
                .text(`Issue date: ${dateText}`, {
                    align: 'center',
                });

            if (certificateId) {
                doc.moveDown(0.5);
                doc
                    .fontSize(12)
                    .text(`Certificate ID: ${certificateId}`, {
                        align: 'center',
                    });
            }

            // Signature lines
            const y = doc.page.height - 120;

            doc.moveTo(100, y).lineTo(260, y).stroke();
            doc.moveTo(doc.page.width - 260, y).lineTo(doc.page.width - 100, y).stroke();

            doc
                .fontSize(12)
                .text('Instructor / Academy', 120, y + 8, { width: 120, align: 'center' });

            doc
                .fontSize(12)
                .text('Authorized Signature', doc.page.width - 250, y + 8, {
                    width: 140,
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

        return `MC-${y}${m}${d}-U${userId}-Q${quizId}`;
    }
}