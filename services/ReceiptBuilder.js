const LogoManager = require('./LogoManager');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// ===== CUSTOMIZABLE FONT CONFIGURATION =====
const FONT_CONFIG = {
    fontFamily: 'RobotoMono',  // Change to any font name
    fontPath: path.join(__dirname, '../assets/RobotoMono.ttf'), // Path to .ttf file

    // Font sizes (in pixels)
    storeName: 28,
    address: 18,
    receiptHeader: 24,
    metaId: 22,
    metaDetails: 18,
    itemHeader: 18,
    itemTitle: 18,
    itemDetails: 18,
    subtotal: 18,
    total: 28,
    paymentHeader: 18,
    paymentDetails: 18,
    status: 20,
    footer: 20,
    footerSmall: 16,
    footerTiny: 14
};

class ReceiptBuilder {
    constructor(data) {
        this.data = data;
        this.widthMm = data.settings?.paperWidth || 80;
        this.dotsPerMm = 8;
        this.widthDots = this.widthMm * this.dotsPerMm;
        this.commandBuffer = [];
        this.y = 0;
        this.imageCache = new Map();

        // Ensure debug directory exists
        if (!fs.existsSync(config.paths.debug)) {
            fs.mkdirSync(config.paths.debug, { recursive: true });
        }

        // Register custom font
        try {
            if (fs.existsSync(FONT_CONFIG.fontPath)) {
                registerFont(FONT_CONFIG.fontPath, { family: FONT_CONFIG.fontFamily });
                console.log(`✅ Font loaded: ${FONT_CONFIG.fontFamily}`);
            } else {
                console.warn(`⚠️ Font file not found: ${FONT_CONFIG.fontPath}, using Arial`);
                FONT_CONFIG.fontFamily = 'Arial'; // Fallback
            }
        } catch (e) {
            console.warn(`⚠️ Font registration failed, using Arial:`, e.message);
            FONT_CONFIG.fontFamily = 'Arial'; // Fallback
        }
    }

    async build() {
        console.log('🎨 Starting image-based receipt rendering...');

        // 1. Render receipt as an image
        const imageData = await this.renderReceiptImage();

        // 2. Save PNG for debugging
        await this.saveDebugImage(imageData.canvas);

        // 3. Convert to monochrome bitmap (using LogoManager's method)
        console.log('🔄 Converting to monochrome bitmap...');
        const bitmap = this.convertToMonochrome(imageData);

        // 4. Build TSPL commands
        this.sizeCommandIndex = this.commandBuffer.length;
        const heightMm = Math.ceil(bitmap.heightDots / this.dotsPerMm) + 3;
        this.addCmd(`SIZE ${this.widthMm} mm,${heightMm} mm`);
        this.addCmd('GAP 0,0');
        this.addCmd('REFERENCE 0,0');
        this.addCmd('CLS');
        this.addCmd('DIRECTION 0');

        // 5. Add bitmap command
        const header = `BITMAP 0,0,${bitmap.widthBytes},${bitmap.heightDots},0,`;
        this.commandBuffer.push(Buffer.from(header));
        this.commandBuffer.push(bitmap.data);
        this.commandBuffer.push(Buffer.from('\r\n'));

        // 6. Print
        this.addCmd('PRINT 1,1');

        console.log(`✅ Receipt ready: ${bitmap.widthDots}x${bitmap.heightDots} dots (${heightMm}mm)`);
        console.log(`   Bitmap size: ${bitmap.widthBytes} x ${bitmap.heightDots} = ${bitmap.data.length} bytes`);

        return Buffer.concat(this.commandBuffer);
    }

    async saveDebugImage(canvas) {
        // Only save in development mode
        if (config.env !== 'development') {
            return;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `receipt_${timestamp}.png`;
            const filepath = path.join(config.paths.debug, filename);

            fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
            console.log(`📸 Debug image saved: ${filename}`);
        } catch (e) {
            console.error('Failed to save debug image:', e.message);
        }
    }

    async renderReceiptImage() {
        const width = this.widthDots;
        const estimatedHeight = 900 + (this.data.items.length * 80);
        const canvas = createCanvas(width, estimatedHeight);
        const ctx = canvas.getContext('2d');
        const margin = 20;
        const centerX = width / 2;

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, estimatedHeight);
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        let y = 40;

        // Helper Functions
        const drawCentered = (text, fontSize, isBold = false) => {
            ctx.font = `${isBold ? 'bold' : ''} ${fontSize}px ${FONT_CONFIG.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.fillText(text, centerX, y);
            y += fontSize + 8;
        };

        const drawLeftRight = (left, right, fontSize, isBold = false) => {
            ctx.font = `${isBold ? 'bold' : ''} ${fontSize}px ${FONT_CONFIG.fontFamily}`;
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

        // --- DRAW LOGO ---
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
                console.log("Logo load failed (skipping)");
            }
        }

        // Receipt Content
        drawCentered(this.data.store.name.toUpperCase(), FONT_CONFIG.storeName, true);
        y += 5;
        drawCentered(this.data.store.address, FONT_CONFIG.address);
        if (this.data.store.phones) drawCentered(`Tel: ${this.data.store.phones.join(', ')}`, FONT_CONFIG.address);
        if (this.data.store.email) drawCentered(`Email: ${this.data.store.email}`, FONT_CONFIG.address);

        y += 10;
        drawCentered("RECEIPT", FONT_CONFIG.receiptHeader, true);
        drawDashedLine();

        drawCentered(this.data.meta.id, FONT_CONFIG.metaId, true);
        y += 10;
        drawLeftRight(`Date: ${this.data.meta.date}`, '', FONT_CONFIG.metaDetails);
        y -= FONT_CONFIG.metaDetails + 8; // Reset y
        drawLeftRight('', `Cashier: ${this.data.meta.cashier}`, FONT_CONFIG.metaDetails);
        drawDashedLine();

        drawLeftRight("ITEM", "TOTAL", FONT_CONFIG.itemHeader, true);
        y += 5;

        this.data.items.forEach(item => {
            ctx.textAlign = 'left';
            ctx.font = `bold ${FONT_CONFIG.itemTitle}px ${FONT_CONFIG.fontFamily}`;
            ctx.fillText(item.title, margin, y);
            y += FONT_CONFIG.itemTitle + 8;

            ctx.font = `${FONT_CONFIG.itemDetails}px ${FONT_CONFIG.fontFamily}`;
            ctx.textAlign = 'left';
            const price = Number(item.unitPrice || 0).toFixed(2);
            const total = Number(item.total || 0).toFixed(2);

            const qtyText = `${item.qty} x ${price}`;
            ctx.fillText(qtyText, margin + 10, y);

            ctx.textAlign = 'right';
            ctx.font = `bold ${FONT_CONFIG.itemDetails}px ${FONT_CONFIG.fontFamily}`;
            ctx.fillText(`${total}`, width - margin, y);

            y += FONT_CONFIG.itemDetails + 12;
        });
        drawDashedLine();

        const { summary, status } = this.data.financials;
        drawLeftRight("Subtotal:", `${Number(summary.subtotal).toFixed(2)}`, FONT_CONFIG.subtotal);
        if (summary.discount > 0) {
            drawLeftRight("Discount:", `- ${Number(summary.discount).toFixed(2)}`, FONT_CONFIG.subtotal);
        }
        y += 10;
        drawLeftRight("TOTAL:", `${Number(summary.total).toFixed(2)}`, FONT_CONFIG.total, true);
        drawDashedLine();

        drawCentered("PAYMENT DETAILS", FONT_CONFIG.paymentHeader, true);
        y += 10;
        if (summary.paidAmount > 0) drawLeftRight("Cash:", `${Number(summary.paidAmount).toFixed(2)}`, FONT_CONFIG.paymentDetails);
        if (summary.balance > 0) drawLeftRight("Balance Due:", `${Number(summary.balance).toFixed(2)}`, FONT_CONFIG.paymentDetails);

        y += 20;
        drawLeftRight("Status:", status ? status.toUpperCase() : "PAID", FONT_CONFIG.status, true);
        y += 10;
        drawDashedLine();

        y += 10;
        drawCentered("THANK YOU!", FONT_CONFIG.footer, true);
        drawCentered("Please Visit Again", FONT_CONFIG.footerSmall);
        y += 20;
        ctx.font = `italic ${FONT_CONFIG.footerTiny}px ${FONT_CONFIG.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText("Powered by Techdomain", centerX, y);
        y += 40;

        // Crop canvas to actual content height
        const finalHeight = y;
        const croppedCanvas = createCanvas(width, finalHeight);
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.drawImage(canvas, 0, 0);

        return {
            canvas: croppedCanvas,
            width: width,
            height: finalHeight
        };
    }

    convertToMonochrome(imageData) {
        const { canvas, width, height } = imageData;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        // Same logic as LogoManager - Floyd-Steinberg dithering
        const bytesPerRow = Math.ceil(width / 8);
        const buffer = Buffer.alloc(bytesPerRow * height);
        const grayPixels = [];

        // Convert to grayscale
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                row.push(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
            }
            grayPixels.push(row);
        }

        // Floyd-Steinberg Dithering
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const oldP = grayPixels[y][x];
                const newP = oldP < 128 ? 0 : 255;
                const err = oldP - newP;

                if (x + 1 < width) grayPixels[y][x + 1] += err * 7 / 16;
                if (y + 1 < height) {
                    if (x > 0) grayPixels[y + 1][x - 1] += err * 3 / 16;
                    grayPixels[y + 1][x] += err * 5 / 16;
                    if (x + 1 < width) grayPixels[y + 1][x + 1] += err * 1 / 16;
                }

                if (newP === 255) { // White pixel (inverted for thermal printer)
                    const bytePos = (y * bytesPerRow) + Math.floor(x / 8);
                    const bitPos = 7 - (x % 8);
                    buffer[bytePos] |= (1 << bitPos);
                }
            }
        }

        return {
            data: buffer,
            widthDots: width,
            heightDots: height,
            widthBytes: bytesPerRow
        };
    }

    addCmd(cmd) {
        if (!cmd.endsWith('\n')) cmd += '\r\n';
        this.commandBuffer.push(Buffer.from(cmd, 'utf-8'));
    }
}

module.exports = ReceiptBuilder;