const { createCanvas, loadImage, registerFont } = require('canvas');
const bwipjs = require('bwip-js');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// ===== CUSTOMIZABLE FONT CONFIGURATION =====
const FONT_CONFIG = {
    fontFamily: 'RobotoMono',
    fontPath: path.join(__dirname, '../assets/RobotoMono.ttf'),
};

class LabelBuilder {
    constructor(data) {
        this.data = data;
        this.commandBuffer = [];
        this.dotsPerMm = 8;

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
                console.warn(`⚠️ Font file not found, using Arial`);
                FONT_CONFIG.fontFamily = 'Arial';
            }
        } catch (e) {
            console.warn(`⚠️ Font registration failed, using Arial`);
            FONT_CONFIG.fontFamily = 'Arial';
        }
    }

    async build() {
        console.log('🎨 Starting image-based label rendering...');

        // 1. Parse size
        const { w, h } = this.parseSize(this.data.size);
        const widthDots = w * this.dotsPerMm;
        const heightDots = h * this.dotsPerMm;

        // 2. Determine label type
        const isTitleSticker = this.data.variant === 'title_sticker' || !this.data.product.barcode;

        // 3. Render label image
        const imageData = await this.renderLabelImage(widthDots, heightDots, isTitleSticker);

        // 4. Save debug image
        await this.saveDebugImage(imageData.canvas, w, h, isTitleSticker);

        // 5. Convert to monochrome bitmap
        console.log('🔄 Converting to monochrome bitmap...');
        const bitmap = this.convertToMonochrome(imageData);

        // 6. Build TSPL commands
        this.addCmd(`SIZE ${w} mm,${h} mm`);
        this.addCmd('GAP 2 mm,0 mm');
        this.addCmd('CLS');
        this.addCmd('DIRECTION 1');

        // 7. Add bitmap
        const header = `BITMAP 0,0,${bitmap.widthBytes},${bitmap.heightDots},0,`;
        this.commandBuffer.push(Buffer.from(header));
        this.commandBuffer.push(bitmap.data);
        this.commandBuffer.push(Buffer.from('\r\n'));

        // 8. Print
        this.addCmd('PRINT 1,1');

        console.log(`✅ Label ready: ${widthDots}x${heightDots} dots (${w}x${h}mm)`);

        return Buffer.concat(this.commandBuffer);
    }

    async renderLabelImage(width, height, isTitleSticker) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#000000';

        const { product, shop } = this.data;
        const centerX = width / 2;
        const centerY = height / 2;

        // Calculate responsive font sizes based on label width (in dots)
        let shopFont, priceFont, titleFont;

        if (width <= 240) { // 30mm or less
            shopFont = 14;
            priceFont = 32;
            titleFont = 20;
        } else if (width <= 320) { // 40mm
            shopFont = 16;
            priceFont = 36;
            titleFont = 22;
        } else { // 50mm or more
            shopFont = 18;
            priceFont = 48;
            titleFont = 24;
        }

        if (isTitleSticker) {
            // === TITLE STICKER LAYOUT ===
            // Just large price and product title

            // Shop name at top (small)
            if (shop) {
                ctx.font = `bold ${shopFont}px ${FONT_CONFIG.fontFamily}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(shop.toUpperCase(), centerX, 10);
            }

            // Large price in center
            ctx.font = `bold ${priceFont}px ${FONT_CONFIG.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const priceY = centerY - 14;
            ctx.fillText(product.price, centerX, priceY);

            // Product title at bottom (wrap into max 2 lines)
            ctx.font = `${titleFont}px ${FONT_CONFIG.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const maxTitleWidth = width - 20;
            const titleLines = this.wrapText(ctx, product.title, maxTitleWidth, 2);
            const lineHeight = titleFont + 4;
            const totalTitleHeight = titleLines.length * lineHeight;

            // Draw each line from bottom up
            titleLines.reverse().forEach((line, index) => {
                const yPos = height - 10 - (index * lineHeight);
                ctx.fillText(line, centerX, yPos);
            });

        } else {
            // === BARCODE LABEL LAYOUT ===

            let y = 15;

            // Shop name at top
            if (shop) {
                ctx.font = `bold ${shopFont}px ${FONT_CONFIG.fontFamily}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(shop.toUpperCase(), centerX, y);
                y += shopFont + 5;
            }

            // Barcode (Real generation using bwip-js)
            if (product.barcode) {
                const barcodeHeight = Math.min(60, height * 0.3);
                const barcodeWidth = width - 40;
                const barcodeX = 20;

                try {
                    const buffer = await bwipjs.toBuffer({
                        bcid: 'code128',       // Barcode type
                        text: product.barcode, // Text to encode
                        scale: 3,               // 3x scaling factor
                        height: 10,              // Bar height, in millimeters
                        includetext: true,            // Show human-readable text
                        textxalign: 'center',        // Always good to set this
                    });

                    const image = await loadImage(buffer);
                    ctx.drawImage(image, barcodeX, y, barcodeWidth, barcodeHeight);
                } catch (e) {
                    console.error('Failed to generate barcode:', e);
                    // Fallback to text if barcode fails
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = `bold 20px ${FONT_CONFIG.fontFamily}`;
                    ctx.fillText(product.barcode, centerX, y + barcodeHeight / 2);
                }

                y += barcodeHeight + 10;
            }

            // Price (large, bold)
            ctx.font = `bold ${priceFont}px ${FONT_CONFIG.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(product.price, centerX, y);
            y += priceFont + 4;

            // Product title at bottom (truncated)
            ctx.font = `${titleFont}px ${FONT_CONFIG.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const maxTitleWidth = width - 20;
            const truncatedTitle = this.truncateText(ctx, product.title, maxTitleWidth);
            ctx.fillText(truncatedTitle, centerX, height - 10);
        }

        return { canvas, width, height };
    }

    truncateText(ctx, text, maxWidth) {
        let truncated = text;
        let textWidth = ctx.measureText(truncated).width;

        if (textWidth <= maxWidth) {
            return truncated;
        }

        // Add ellipsis and truncate
        while (textWidth > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
            textWidth = ctx.measureText(truncated + '...').width;
        }

        return truncated + '...';
    }

    wrapText(ctx, text, maxWidth, maxLines = 2) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth > maxWidth && currentLine) {
                // Line is too long, push current line and start new one
                lines.push(currentLine);
                currentLine = words[i];

                // Check if we've reached max lines
                if (lines.length >= maxLines) {
                    // Truncate remaining text with ellipsis
                    const remaining = words.slice(i).join(' ');
                    currentLine = this.truncateText(ctx, currentLine + ' ' + remaining, maxWidth);
                    break;
                }
            } else {
                currentLine = testLine;
            }
        }

        // Add the last line if it exists
        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.slice(0, maxLines);
    }

    async saveDebugImage(canvas, w, h, isTitleSticker) {
        // Only save in development mode
        if (config.env !== 'development') {
            return;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const type = isTitleSticker ? 'title_sticker' : 'barcode_label';
            const filename = `label_${type}_${w}x${h}_${timestamp}.png`;
            const filepath = path.join(config.paths.debug, filename);

            fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
            console.log(`📸 Debug image saved: ${filename}`);
        } catch (e) {
            console.error('Failed to save debug image:', e.message);
        }
    }

    convertToMonochrome(imageData) {
        const { canvas, width, height } = imageData;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        // Floyd-Steinberg dithering (same as ReceiptBuilder)
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

    parseSize(sizeStr) {
        const [w, h] = sizeStr.toLowerCase().split('x').map(Number);
        return { w: w || 50, h: h || 30 };
    }

    addCmd(cmd) {
        if (!cmd.endsWith('\n')) cmd += '\r\n';
        this.commandBuffer.push(Buffer.from(cmd, 'utf-8'));
    }
}

module.exports = LabelBuilder;