const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * ThermalImagePrinter - Service for printing base64-encoded images on thermal receipt paper
 * Automatically fits images to paper width while maintaining aspect ratio
 */
class ThermalImagePrinter {
    constructor(data) {
        this.data = data;
        this.commandBuffer = [];
        this.dotsPerMm = 8; // Thermal printer resolution (203 DPI)

        // Ensure debug directory exists
        if (!fs.existsSync(config.paths.debug)) {
            fs.mkdirSync(config.paths.debug, { recursive: true });
        }
    }

    async build() {
        console.log('🎨 Starting thermal image printing...');

        // 1. Validate input
        const { image, width } = this.data;
        if (!image || !width) {
            throw new Error('Missing required parameters: image, width');
        }

        // 2. Parse paper width
        const paperWidthMm = parseFloat(width);
        const paperWidthDots = Math.round(paperWidthMm * this.dotsPerMm);

        console.log(`📏 Paper width: ${paperWidthMm}mm (${paperWidthDots} dots)`);

        // 3. Load and decode the base64 image
        const img = await this.loadBase64Image(image);
        console.log(`🖼️  Source image: ${img.width}x${img.height}px`);

        // 4. Calculate height based on aspect ratio to fit width
        const scaledDims = this.calculateWidthFit(
            img.width,
            img.height,
            paperWidthDots
        );
        console.log(`📐 Scaled dimensions: ${scaledDims.width}x${scaledDims.height} dots`);

        // 5. Render image on thermal paper canvas
        const imageData = await this.renderThermalImage(img, scaledDims.width, scaledDims.height);

        // 6. Save debug image
        await this.saveDebugImage(imageData.canvas, paperWidthMm, scaledDims.height);

        // 7. Convert to monochrome bitmap
        console.log('🔄 Converting to monochrome bitmap...');
        const bitmap = this.convertToMonochrome(imageData);

        // 8. Build TSPL commands
        const heightMm = Math.ceil(bitmap.heightDots / this.dotsPerMm) + 3;
        this.addCmd(`SIZE ${paperWidthMm} mm,${heightMm} mm`);
        this.addCmd('GAP 0,0');
        this.addCmd('REFERENCE 0,0');
        this.addCmd('CLS');
        this.addCmd('DIRECTION 0');

        // 9. Add bitmap
        const header = `BITMAP 0,0,${bitmap.widthBytes},${bitmap.heightDots},0,`;
        this.commandBuffer.push(Buffer.from(header));
        this.commandBuffer.push(bitmap.data);
        this.commandBuffer.push(Buffer.from('\r\n'));

        // 10. Print
        this.addCmd('PRINT 1,1');

        console.log(`✅ Thermal image ready for printing (${paperWidthMm}x${heightMm}mm)`);

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
     * Calculate dimensions to fit image to paper width while maintaining aspect ratio
     * Height adjusts automatically based on aspect ratio
     */
    calculateWidthFit(imgWidth, imgHeight, paperWidth) {
        const aspectRatio = imgWidth / imgHeight;

        // Fit to paper width
        const scaledWidth = paperWidth;
        const scaledHeight = Math.round(paperWidth / aspectRatio);

        return {
            width: scaledWidth,
            height: scaledHeight
        };
    }

    /**
     * Render the image on thermal paper canvas with proper scaling
     */
    async renderThermalImage(img, width, height) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw the scaled image
        ctx.drawImage(img, 0, 0, width, height);

        return {
            canvas: canvas,
            width: width,
            height: height
        };
    }

    /**
     * Save debug image (development mode only)
     */
    async saveDebugImage(canvas, widthMm, heightDots) {
        if (config.env !== 'development') {
            return;
        }

        try {
            const heightMm = Math.ceil(heightDots / this.dotsPerMm);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `thermal_image_${widthMm}mm_${timestamp}.png`;
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

module.exports = ThermalImagePrinter;
