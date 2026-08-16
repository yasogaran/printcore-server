const { createCanvas, loadImage } = require('canvas');

class LogoManager {
    static tsplCache = new Map();

    /**
     * Downloads and resizes image.
     * @param {string} url - The URL or local path
     * @param {object|number} options - { width: 40, height: 15 } OR just a number for width
     */
    static async getLogoData(url, options = {}) {
        // Handle legacy call (if just a number was passed)
        let maxW_mm = 40;
        let fixedH_mm = null;

        if (typeof options === 'number') {
            maxW_mm = options;
        } else {
            maxW_mm = options.width || 40; // Max allowed width (safety)
            fixedH_mm = options.height || null; // Target fixed height
        }

        const cacheKey = `${url}_w${maxW_mm}_h${fixedH_mm}`;
        if (this.tsplCache.has(cacheKey)) return this.tsplCache.get(cacheKey);

        try {
            const image = await loadImage(url);
            
            // 8 dots per mm (203 DPI)
            let width = image.width;
            let height = image.height;

            // === RESIZE LOGIC ===
            if (fixedH_mm) {
                // Priority: FIT TO HEIGHT (15mm)
                const targetHeightDots = fixedH_mm * 8;
                const scale = targetHeightDots / height;
                
                height = targetHeightDots;
                width = Math.round(image.width * scale);
                
                // Safety: If proportional width is crazy big, cap it
                const maxDots = maxW_mm * 8;
                if (width > maxDots) {
                    const scale2 = maxDots / width;
                    width = maxDots;
                    height = Math.round(height * scale2);
                }
            } else {
                // Priority: FIT TO WIDTH (Legacy)
                const maxDots = maxW_mm * 8;
                if (width > maxDots) {
                    height = Math.round((height * maxDots) / width);
                    width = maxDots;
                }
            }

            // 2. Process Image (Canvas)
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(image, 0, 0, width, height);

            // 3. Dithering (Black & White conversion)
            const imgData = ctx.getImageData(0, 0, width, height);
            const pixels = imgData.data;
            const bytesPerRow = Math.ceil(width / 8);
            const buffer = Buffer.alloc(bytesPerRow * height);
            const grayPixels = [];

            // Grayscale
            for (let y = 0; y < height; y++) {
                const row = [];
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    row.push(pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114);
                }
                grayPixels.push(row);
            }

            // Floyd-Steinberg Dither
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

                    if (newP === 0) { // Black pixel
                        const bytePos = (y * bytesPerRow) + Math.floor(x / 8);
                        const bitPos = 7 - (x % 8);
                        buffer[bytePos] |= (1 << bitPos);
                    }
                }
            }

            const result = {
                data: buffer,
                widthBytes: bytesPerRow,
                widthDots: width,
                heightDots: height
            };

            this.tsplCache.set(cacheKey, result);
            return result;

        } catch (error) {
            console.error("❌ Logo Error:", error.message);
            return null;
        }
    }
}

module.exports = LogoManager;