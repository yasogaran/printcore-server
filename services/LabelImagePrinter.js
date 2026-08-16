const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * LabelImagePrinter - Service for printing base64-encoded images on labels
 * Handles aspect ratio preservation and image centering
 */
class LabelImagePrinter {
    constructor(data) {
        this.data = data;
        this.commandBuffer = [];
        this.dotsPerMm = 8; // Thermal printer resolution

        // Ensure debug directory exists
        if (!fs.existsSync(config.paths.debug)) {
            fs.mkdirSync(config.paths.debug, { recursive: true });
        }
    }

    async build() {
        console.log('🎨 Starting label image printing...');

        // 1. Validate input
        const { image, width, height } = this.data;
        if (!image || !width || !height) {
            throw new Error('Missing required parameters: image, width, height');
        }

        // 2. Parse label dimensions
        const labelWidthMm = parseFloat(width);
        const labelHeightMm = parseFloat(height);
        const labelWidthDots = Math.round(labelWidthMm * this.dotsPerMm);
        const labelHeightDots = Math.round(labelHeightMm * this.dotsPerMm);

        console.log(`📏 Label dimensions: ${labelWidthMm}x${labelHeightMm}mm (${labelWidthDots}x${labelHeightDots} dots)`);

        // 3. Load and decode the base64 image
        const img = await this.loadBase64Image(image);
        console.log(`🖼️  Source image: ${img.width}x${img.height}px`);

        // 4. Calculate aspect-fit dimensions
        const scaledDims = this.calculateAspectFit(
            img.width,
            img.height,
            labelWidthDots,
            labelHeightDots
        );
        console.log(`📐 Scaled dimensions: ${scaledDims.width}x${scaledDims.height} dots`);

        // 5. Render image on label canvas
        const imageData = await this.renderLabelImage(img, labelWidthDots, labelHeightDots, scaledDims);

        // 6. Save debug image
        await this.saveDebugImage(imageData.canvas, labelWidthMm, labelHeightMm);

        // 7. Convert to monochrome bitmap
        console.log('🔄 Converting to monochrome bitmap...');
        const bitmap = this.convertToMonochrome(imageData);

        // 8. Build TSPL commands
        this.addCmd(`SIZE ${labelWidthMm} mm,${labelHeightMm} mm`);
        this.addCmd('GAP 2 mm,0 mm');
        this.addCmd('CLS');
        this.addCmd('DIRECTION 1');

        // 9. Add bitmap
        const header = `BITMAP 0,0,${bitmap.widthBytes},${bitmap.heightDots},0,`;
        this.commandBuffer.push(Buffer.from(header));
        this.commandBuffer.push(bitmap.data);
        this.commandBuffer.push(Buffer.from('\r\n'));

        // 10. Print
        this.addCmd('PRINT 1,1');

        console.log(`✅ Label image ready for printing`);

        return Buffer.concat(this.commandBuffer);
    }

    /**
     * Load base64-encoded image
     */
    async loadBase64Image(base64String) {
        try {
            // Remove data URL prefix if present (e.g., "data:image/png;base64,")
            const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

            // Create buffer from base64
            const imageBuffer = Buffer.from(base64Data, 'base64');

            // Load image using canvas library
            const img = await loadImage(imageBuffer);

            return img;
        } catch (error) {
            throw new Error(`Failed to decode base64 image: ${error.message}`);
        }
    }

    /**
     * Calculate dimensions to fit image within label while preserving aspect ratio
     * Image will be centered on the label
     */
    calculateAspectFit(imgWidth, imgHeight, labelWidth, labelHeight) {
        const imgAspect = imgWidth / imgHeight;
        const labelAspect = labelWidth / labelHeight;

        let scaledWidth, scaledHeight;

        if (imgAspect > labelAspect) {
            // Image is wider than label (fit to width)
            scaledWidth = labelWidth;
            scaledHeight = Math.round(labelWidth / imgAspect);
        } else {
            // Image is taller than label (fit to height)
            scaledHeight = labelHeight;
            scaledWidth = Math.round(labelHeight * imgAspect);
        }

        // Calculate centering offsets
        const offsetX = Math.round((labelWidth - scaledWidth) / 2);
        const offsetY = Math.round((labelHeight - scaledHeight) / 2);

        return {
            width: scaledWidth,
            height: scaledHeight,
            offsetX: offsetX,
            offsetY: offsetY
        };
    }

    /**
     * Render the image on a label-sized canvas with proper scaling and centering
     */
    async renderLabelImage(img, labelWidth, labelHeight, scaledDims) {
        const canvas = createCanvas(labelWidth, labelHeight);
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, labelWidth, labelHeight);

        // Draw the scaled image centered on the label
        ctx.drawImage(
            img,
            scaledDims.offsetX,
            scaledDims.offsetY,
            scaledDims.width,
            scaledDims.height
        );

        return {
            canvas: canvas,
            width: labelWidth,
            height: labelHeight
        };
    }

    /**
     * Save debug image (development mode only)
     */
    async saveDebugImage(canvas, widthMm, heightMm) {
        if (config.env !== 'development') {
            return;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `label_image_${widthMm}x${heightMm}_${timestamp}.png`;
            const filepath = path.join(config.paths.debug, filename);

            fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
            console.log(`📸 Debug image saved: ${filename}`);
            this.debugFilename = filename;
        } catch (e) {
            console.error('Failed to save debug image:', e.message);
        }
    }

    /**
     * Convert image to monochrome bitmap using Floyd-Steinberg dithering
     * (Same algorithm as ReceiptBuilder and LabelBuilder)
     */
    convertToMonochrome(imageData) {
        const { canvas, width, height } = imageData;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

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

        const colorMode = this.data.color || 'grayscale';

        if (colorMode === 'black_white') {
            // Simple Thresholding
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const p = grayPixels[y][x];
                    const newP = p < 128 ? 0 : 255;
                    
                    if (newP === 255) { // White pixel (inverted for thermal printer)
                        const bytePos = (y * bytesPerRow) + Math.floor(x / 8);
                        const bitPos = 7 - (x % 8);
                        buffer[bytePos] |= (1 << bitPos);
                    }
                }
            }
        } else {
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
        }

        return {
            data: buffer,
            widthDots: width,
            heightDots: height,
            widthBytes: bytesPerRow
        };
    }

    /**
     * Add TSPL command to buffer
     */
    addCmd(cmd) {
        if (!cmd.endsWith('\n')) cmd += '\r\n';
        this.commandBuffer.push(Buffer.from(cmd, 'utf-8'));
    }
}

module.exports = LabelImagePrinter;
