const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const ReceiptBuilder = require('./ReceiptBuilder');
const BoxedReceiptBuilder = require('./BoxedReceiptBuilder');

class VirtualPrinter {
    constructor() {
        if (!fs.existsSync(config.paths.debug)) {
            fs.mkdirSync(config.paths.debug, { recursive: true });
        }
        this.imageCache = new Map();
    }

    async saveImage(data, type) {
        // === BRANCH LOGIC: LABEL VS RECEIPT ===
        if (type && type.includes('label')) {
            return this.generateLabelImage(data, type);
        } else {
            return this.generateReceiptImage(data, type);
        }
    }

    // ==========================================
    // 🏷️ BOXED ROW LABEL GENERATOR
    // ==========================================
    async generateLabelImage(data) {
        try {
            // 1. Setup Canvas
            const [wMm, hMm] = (data.size || "50x25").toLowerCase().split('x').map(Number);
            const width = wMm * 8;
            const height = hMm * 8;

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // 2. White Background & Settings
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 3. Draw Outer Border (Thick)
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, width, height);
            ctx.lineWidth = 2; // Thinner for inner lines

            const { product, shop, variant } = data;

            // CHECK VARIANT: "Title Sticker" vs "Barcode Label"
            // If explicit variant 'title_sticker' OR no barcode provided -> Title Sticker Mode
            const isTitleSticker = (variant === 'title_sticker') || !product.barcode;

            // --- LAYOUT CALCULATIONS ---
            const centerX = width / 2;

            // Row Heights (approximate percentages based on your images)
            const headerH = height * 0.15; // 15% for Shop Name
            const bottomH = height * 0.20; // 20% for Product Title at bottom

            // The middle area is split differently based on variant
            let middleTopY = headerH;
            let middleBottomY = height - bottomH;

            // --- ROW 1: SHOP NAME ---
            // Draw Separator Line
            ctx.beginPath();
            ctx.moveTo(0, headerH);
            // ctx.lineTo(width, headerH);
            ctx.stroke();

            // Draw Text
            if (shop) {
                ctx.font = "bold 14px Arial";
                ctx.fillText(shop.toUpperCase(), centerX, headerH / 2);
            }

            if (isTitleSticker) {
                // === LAYOUT B: TITLE STICKER (No Barcode, Huge Price) ===
                // Matches image_ba8a53.png

                // Middle Area is purely for Price
                const priceAreaH = middleBottomY - middleTopY;
                const priceCenterY = middleTopY + (priceAreaH / 2);

                // Draw Huge Price
                ctx.font = "bold 45px Arial";
                ctx.fillText(product.price, centerX, priceCenterY);

            } else {
                // === LAYOUT A: BARCODE LABEL (Standard) ===

                // Split middle area into Barcode (Top) and Price (Bottom)
                const barcodeH = (middleBottomY - middleTopY) * 0.55; // 55% for barcode
                const priceH = (middleBottomY - middleTopY) * 0.45;   // 45% for price

                const barcodeY = middleTopY;
                const priceY = middleTopY + barcodeH;

                // Draw Separator between Barcode and Price
                ctx.beginPath();
                ctx.moveTo(0, priceY);
                // ctx.lineTo(width, priceY);
                ctx.stroke();

                // 1. Draw Barcode (Simulated)
                const barMargin = 10;
                const barW = width - (barMargin * 2);
                const barHActual = barcodeH - 10;

                ctx.fillStyle = "#000";
                // Draw a solid block then cut white lines
                ctx.fillRect(barMargin, barcodeY + 5, barW, barHActual);

                ctx.fillStyle = "#fff";
                // Cut random white lines to look like barcode
                for (let i = 0; i < barW; i += 3) {
                    if (Math.random() > 0.4) {
                        ctx.fillRect(barMargin + i, barcodeY + 5, 1 + Math.random(), barHActual);
                    }
                }
                ctx.fillStyle = "#000"; // Reset

                // 2. Draw Price
                ctx.font = "bold 30px Arial";
                ctx.fillText(product.price, centerX, priceY + (priceH / 2));
            }


            // Draw Title
            ctx.font = "16px Arial";
            ctx.fillText(product.title, centerX, middleBottomY + (bottomH / 2));

            // Save File
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const modeName = isTitleSticker ? "title_sticker" : "barcode_label";
            const filename = `label_${modeName}_${data.size}_${timestamp}.png`;
            const filepath = path.join(config.paths.debug, filename);

            fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
            console.log(`🏷️  ${isTitleSticker ? 'Title Sticker' : 'Barcode Label'} Saved: ${filename}`);

            return { success: true, filename };

        } catch (e) {
            console.error("Label Gen Error:", e);
            return { success: false, error: e.message };
        }
    }

    // ==========================================
    // 🧾 RECEIPT GENERATOR (EXISTING)
    // ==========================================
    async generateReceiptImage(data, type) {
        try {
            const Builder = data.settings?.template === 'boxed-template' ? BoxedReceiptBuilder : ReceiptBuilder;
            const builder = new Builder(data);
            const { canvas } = await builder.renderReceiptImage();

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${type}_${timestamp}.png`;
            const filepath = path.join(config.paths.debug, filename);

            fs.writeFileSync(filepath, canvas.toBuffer('image/png'));
            console.log(`📸 Receipt Saved: ${filename}`);

            return { success: true, filename };

        } catch (e) {
            console.error(e);
            return { success: false, error: e.message };
        }
    }
}

module.exports = VirtualPrinter;