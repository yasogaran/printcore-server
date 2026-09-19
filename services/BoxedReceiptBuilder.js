const ReceiptBuilder = require('./ReceiptBuilder');
const { createCanvas, loadImage } = require('canvas');
const bwipjs = require('bwip-js');

// ===== FONT SIZES SPECIFIC TO THE BOXED LAYOUT =====
const BOX_FONT_CONFIG = {
    tableHeader: 18,
    itemTitle: 18,
    boxLabel: 14,
    boxValue: 18,
    discountRow: 18,
    summary: 18,
    summaryTotal: 26,
    savedTitle: 18,
    savedAmount: 26,
    savedFooter: 14,
    loyalty: 18
};

class BoxedReceiptBuilder extends ReceiptBuilder {
    async renderReceiptImage() {
        const width = this.widthDots;
        const estimatedHeight = 1300 + (this.data.items.length * 160) + (this.data.print_barcode ? 220 : 0);
        const canvas = createCanvas(width, estimatedHeight);
        const ctx = canvas.getContext('2d');
        const margin = 20;
        const centerX = width / 2;
        const fontFamily = ReceiptBuilder.FONT_CONFIG.fontFamily;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, estimatedHeight);
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        let y = 40;

        const drawCentered = (text, fontSize, isBold = false) => {
            ctx.font = `${isBold ? 'bold' : ''} ${fontSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(text, centerX, y);
            y += fontSize + 8;
        };

        const drawLeftRight = (left, right, fontSize, isBold = false) => {
            ctx.font = `${isBold ? 'bold' : ''} ${fontSize}px ${fontFamily}`;
            ctx.textAlign = 'left';
            ctx.fillText(left, margin, y);
            ctx.textAlign = 'right';
            ctx.fillText(right, width - margin, y);
            y += fontSize + 8;
        };

        const drawDashedLine = () => {
            y += 5;
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(margin, y);
            ctx.lineTo(width - margin, y);
            ctx.stroke();
            ctx.setLineDash([]);
            y += 20;
        };

        const drawSolidLine = (bold = false) => {
            y += 5;
            ctx.setLineDash([]);
            ctx.lineWidth = bold ? 2.5 : 1;
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(width - margin, y);
            ctx.stroke();
            ctx.lineWidth = 1;
            y += bold ? 14 : 8;
        };

        const drawSavedBox = (totalDiscount) => {
            const innerWidth = width - margin * 2;
            const boxHeight = BOX_FONT_CONFIG.savedTitle + BOX_FONT_CONFIG.savedAmount + BOX_FONT_CONFIG.savedFooter + 50;

            ctx.setLineDash([]);
            ctx.strokeRect(margin, y, innerWidth, boxHeight);

            let innerY = y + 12;
            ctx.textAlign = 'center';

            ctx.font = `${BOX_FONT_CONFIG.savedTitle}px ${fontFamily}`;
            ctx.fillText('You Saved', centerX, innerY);
            innerY += BOX_FONT_CONFIG.savedTitle + 8;

            ctx.font = `bold ${BOX_FONT_CONFIG.savedAmount}px ${fontFamily}`;
            ctx.fillText(`RS. ${Number(totalDiscount).toFixed(2)}`, centerX, innerY);
            innerY += BOX_FONT_CONFIG.savedAmount + 8;

            ctx.font = `bold ${BOX_FONT_CONFIG.savedFooter}px ${fontFamily}`;
            ctx.fillText('ON THIS BILL - THANK YOU FOR BEING A CUSTOMER', centerX, innerY);

            y += boxHeight + 15;
        };

        const drawLoyaltyBox = (earned, total) => {
            const innerWidth = width - margin * 2;
            const rowHeight = BOX_FONT_CONFIG.loyalty + 16;
            const boxHeight = rowHeight * 2;

            ctx.setLineDash([]);
            ctx.strokeRect(margin, y, innerWidth, boxHeight);
            ctx.beginPath();
            ctx.moveTo(margin, y + rowHeight);
            ctx.lineTo(margin + innerWidth, y + rowHeight);
            ctx.stroke();

            ctx.font = `bold ${BOX_FONT_CONFIG.loyalty}px ${fontFamily}`;
            ctx.textAlign = 'left';
            ctx.fillText('Loyalty points earned', margin + 8, y + 8);
            ctx.textAlign = 'right';
            ctx.fillText(`${earned}`, width - margin - 8, y + 8);

            ctx.textAlign = 'left';
            ctx.fillText('Total Loyalty points', margin + 8, y + rowHeight + 8);
            ctx.textAlign = 'right';
            ctx.fillText(`${total}`, width - margin - 8, y + rowHeight + 8);

            y += boxHeight + 15;
        };

        // --- HEADER (unchanged from the plain template) ---
        if (this.data.store && this.data.store.logo) {
            try {
                let img;
                if (this.imageCache.has(this.data.store.logo)) {
                    img = this.imageCache.get(this.data.store.logo);
                } else {
                    img = await loadImage(this.data.store.logo);
                    this.imageCache.set(this.data.store.logo, img);
                }
                const aspectRatio = img.width / img.height;
                const drawHeight = 100;
                const drawWidth = drawHeight * aspectRatio;
                const xPos = (width - drawWidth) / 2;
                ctx.drawImage(img, xPos, y, drawWidth, drawHeight);
                y += drawHeight + 20;
            } catch (e) {
                console.log('Logo load failed (skipping)');
            }
        }

        drawCentered(this.data.store.name.toUpperCase(), 28, true);
        y += 5;
        drawCentered(this.data.store.address, 18);
        if (this.data.store.phones) drawCentered(`Tel: ${this.data.store.phones.join(', ')}`, 18);
        if (this.data.store.email) drawCentered(`Email: ${this.data.store.email}`, 18);

        y += 10;
        drawCentered('RECEIPT', 24, true);
        drawDashedLine();

        drawCentered(this.data.meta.id, 22, true);
        y += 10;
        drawLeftRight(`Date: ${this.data.meta.date}`, '', 18);
        y -= 18 + 8;
        drawLeftRight('', `Cashier: ${this.data.meta.cashier}`, 18);
        drawDashedLine();

        // --- ITEM TABLE ---
        // Fixed-width serial column (holds up to 2 digits) shared by the header and every item card.
        const serialWidth = 44;

        const innerWidthFull = width - margin * 2;
        const headerHeight = BOX_FONT_CONFIG.tableHeader + 16;
        ctx.setLineDash([]);
        ctx.strokeRect(margin, y, innerWidthFull, headerHeight);
        ctx.beginPath();
        ctx.moveTo(margin + serialWidth, y);
        ctx.lineTo(margin + serialWidth, y + headerHeight);
        ctx.stroke();

        ctx.font = `bold ${BOX_FONT_CONFIG.tableHeader}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText('#', margin + serialWidth / 2, y + 8);
        ctx.textAlign = 'left';
        ctx.fillText('Item', margin + serialWidth + 8, y + 8);
        ctx.textAlign = 'right';
        ctx.fillText('Total', margin + innerWidthFull - 8, y + 8);
        y += headerHeight + 10;

        // Draws one item as a single card: a narrow serial column spanning the title + price
        // rows, the product title, the MRP/SELLING/QTY/Total row, and (when present) the
        // item's own discount row — all inside one shared outer border, discount kept as the
        // card's next row rather than a separate floating box.
        const drawItemCard = (serial, item, itemDiscount) => {
            const innerWidth = width - margin * 2;
            const contentX0 = margin + serialWidth;
            const contentWidth = innerWidth - serialWidth;
            const titleRowHeight = BOX_FONT_CONFIG.itemTitle + 20;
            const priceRowHeight = BOX_FONT_CONFIG.boxLabel + BOX_FONT_CONFIG.boxValue + 20;
            const discountRowHeight = itemDiscount > 0 ? BOX_FONT_CONFIG.discountRow + 16 : 0;
            const serialSpanHeight = titleRowHeight + priceRowHeight;
            const cardHeight = serialSpanHeight + discountRowHeight;

            ctx.setLineDash([]);
            ctx.strokeRect(margin, y, innerWidth, cardHeight);

            // Serial column divider spans only the title + price rows (not the discount row).
            ctx.beginPath();
            ctx.moveTo(contentX0, y);
            ctx.lineTo(contentX0, y + serialSpanHeight);
            ctx.stroke();

            // Divider between the title row and the price row (content area only).
            ctx.beginPath();
            ctx.moveTo(contentX0, y + titleRowHeight);
            ctx.lineTo(margin + innerWidth, y + titleRowHeight);
            ctx.stroke();

            ctx.font = `bold ${BOX_FONT_CONFIG.itemTitle}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(`${serial}`, margin + serialWidth / 2, y + (serialSpanHeight / 2) - (BOX_FONT_CONFIG.itemTitle / 2));

            ctx.textAlign = 'left';
            ctx.fillText(item.title, contentX0 + 8, y + (titleRowHeight / 2) - (BOX_FONT_CONFIG.itemTitle / 2));

            const priceCells = [
                { label: 'MRP', value: Number(item.mrp || 0).toFixed(2), widthFraction: 0.22, align: 'center' },
                { label: 'SELLING', value: Number(item.sellingPrice || 0).toFixed(2), widthFraction: 0.22, align: 'center' },
                { label: 'QTY', value: `${item.qty}`, widthFraction: 0.16, align: 'center' },
                { label: null, value: `RS. ${Number(item.total || 0).toFixed(2)}`, widthFraction: 0.40, align: 'right' }
            ];

            let cx = contentX0;
            const priceY = y + titleRowHeight;
            priceCells.forEach((cell, idx) => {
                const cellWidth = contentWidth * cell.widthFraction;
                if (idx > 0) {
                    ctx.beginPath();
                    ctx.moveTo(cx, priceY);
                    ctx.lineTo(cx, priceY + priceRowHeight);
                    ctx.stroke();
                }

                ctx.textAlign = cell.align;
                const textX = cell.align === 'right' ? cx + cellWidth - 10 : cx + cellWidth / 2;
                if (cell.label) {
                    ctx.font = `${BOX_FONT_CONFIG.boxLabel}px ${fontFamily}`;
                    ctx.fillText(cell.label, textX, priceY + 8);
                    ctx.font = `bold ${BOX_FONT_CONFIG.boxValue}px ${fontFamily}`;
                    ctx.fillText(cell.value, textX, priceY + 8 + BOX_FONT_CONFIG.boxLabel + 4);
                } else {
                    ctx.font = `bold ${BOX_FONT_CONFIG.boxValue}px ${fontFamily}`;
                    ctx.fillText(cell.value, textX, priceY + (priceRowHeight / 2) - (BOX_FONT_CONFIG.boxValue / 2));
                }

                cx += cellWidth;
            });

            if (itemDiscount > 0) {
                const discountY = y + serialSpanHeight;

                ctx.beginPath();
                ctx.moveTo(margin, discountY);
                ctx.lineTo(margin + innerWidth, discountY);
                ctx.stroke();

                ctx.font = `bold ${BOX_FONT_CONFIG.discountRow}px ${fontFamily}`;
                ctx.textAlign = 'left';
                ctx.fillText('DISCOUNT', margin + 8, discountY + 8);
                ctx.textAlign = 'right';
                ctx.fillText(`YOU SAVED ${Number(itemDiscount).toFixed(2)}`, margin + innerWidth - 8, discountY + 8);
            }

            y += cardHeight + 10;
        };

        let grossTotal = 0;
        let totalDiscount = 0;

        this.data.items.forEach((item, index) => {
            grossTotal += Number(item.total || 0);
            const itemDiscount = Number(item.discount || 0);
            totalDiscount += itemDiscount;

            drawItemCard(index + 1, item, itemDiscount);
        });

        const netTotal = grossTotal - totalDiscount;

        drawDashedLine();
        drawLeftRight('GROSS TOTAL', `${grossTotal.toFixed(2)}`, BOX_FONT_CONFIG.summary);
        drawSolidLine(false);
        drawLeftRight('DISCOUNT EARNED', `${totalDiscount.toFixed(2)}`, BOX_FONT_CONFIG.summary);
        drawSolidLine(true);
        drawLeftRight('NET TOTAL', `${netTotal.toFixed(2)}`, BOX_FONT_CONFIG.summaryTotal, true);
        drawDashedLine();

        drawSavedBox(totalDiscount);

        if (this.data.loyalty) {
            drawLoyaltyBox(this.data.loyalty.earned || 0, this.data.loyalty.total || 0);
        }

        // --- FOOTER (unchanged from the plain template) ---
        const { summary = {}, status } = this.data.financials || {};
        drawCentered('PAYMENT DETAILS', 18, true);
        y += 10;
        if (summary.paidAmount > 0) drawLeftRight('Cash:', `${Number(summary.paidAmount).toFixed(2)}`, 18);
        if (summary.balance > 0) drawLeftRight('Balance Due:', `${Number(summary.balance).toFixed(2)}`, 18);

        y += 20;
        drawLeftRight('Status:', status ? status.toUpperCase() : 'PAID', 20, true);
        y += 10;
        drawDashedLine();

        y += 10;
        drawCentered('THANK YOU!', 20, true);
        drawCentered('Please Visit Again', 16);
        y += 20;
        ctx.font = `italic 14px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText('Powered by Hexcore', centerX, y);
        y += 40;

        // --- INVOICE CODE BARCODE (new section, end of invoice) ---
        if (this.data.print_barcode && this.data.meta && this.data.meta.id) {
            try {
                const barcodeWidth = width - margin * 2;
                const buffer = await bwipjs.toBuffer({
                    bcid: 'code128',
                    text: this.data.meta.id,
                    scale: 3,
                    height: 12,
                    includetext: true,
                    textxalign: 'center'
                });
                const barcodeImage = await loadImage(buffer);
                const barcodeHeight = barcodeImage.height * (barcodeWidth / barcodeImage.width);
                ctx.drawImage(barcodeImage, margin, y, barcodeWidth, barcodeHeight);
                y += barcodeHeight + 20;
            } catch (e) {
                console.log('Barcode generation failed (skipping)', e.message);
            }
        }

        const finalHeight = y;
        const croppedCanvas = createCanvas(width, finalHeight);
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.drawImage(canvas, 0, 0);

        return {
            canvas: croppedCanvas,
            width,
            height: finalHeight
        };
    }
}

module.exports = BoxedReceiptBuilder;
