const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const config = require('../config');

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
            const width = 576;
            const estimatedHeight = 900 + (data.items.length * 60);
            const canvas = createCanvas(width, estimatedHeight);
            const ctx = canvas.getContext('2d');
            const margin = 20;
            const centerX = width / 2;

            // Background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, estimatedHeight);
            ctx.fillStyle = '#000000';
            ctx.textBaseline = 'top';
            let y = 40;

            // --- DRAW LOGO ---
            if (data.store && data.store.logo) {
                try {
                    let img;
                    if (this.imageCache.has(data.store.logo)) {
                        img = this.imageCache.get(data.store.logo);
                    } else {
                        img = await loadImage(data.store.logo);
                        this.imageCache.set(data.store.logo, img);
                    }
                    const aspectRatio = img.width / img.height;
                    const drawHeight = 100;
                    const drawWidth = drawHeight * aspectRatio;
                    const xPos = (width - drawWidth) / 2;
                    ctx.drawImage(img, xPos, y, drawWidth, drawHeight);
                    y += drawHeight + 20;
                } catch (e) {
                    console.log("Virtual Preview: Logo load failed (skipping)");
                }
            }

            // Helper Functions
            const drawCentered = (text, fontSize, isBold = false) => {
                ctx.font = `${isBold ? 'bold' : ''} ${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.fillText(text, centerX, y);
                y += fontSize + 8;
            };

            const drawLeftRight = (left, right, fontSize, isBold = false) => {
                ctx.font = `${isBold ? 'bold' : ''} ${fontSize}px Arial`;
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

            // Receipt Content
            drawCentered(data.store.name.toUpperCase(), 28, true);
            y += 5;
            drawCentered(data.store.address, 18);
            if (data.store.phones) drawCentered(`Tel: ${data.store.phones.join(', ')}`, 18);

            y += 10;
            drawCentered("RECEIPT", 24, true);
            drawDashedLine();

            drawCentered(data.meta.id, 22);
            y += 10;
            drawLeftRight("Date:", data.meta.date, 18);
            drawLeftRight("Cashier:", data.meta.cashier, 18);
            drawDashedLine();

            drawLeftRight("ITEM", "TOTAL", 18, true);
            y += 5;

            data.items.forEach(item => {
                ctx.textAlign = 'left';
                ctx.font = "bold 18px Arial";
                ctx.fillText(item.title, margin, y);
                y += 24;

                ctx.font = "18px Arial";
                ctx.textAlign = 'left';
                // Safe fix for undefined/null values
                const price = Number(item.unitPrice || 0).toFixed(2);
                const total = Number(item.total || 0).toFixed(2);

                const qtyText = `${item.qty} x LKR ${price}`;
                ctx.fillText(qtyText, margin + 10, y);

                ctx.textAlign = 'right';
                ctx.font = "bold 18px Arial";
                ctx.fillText(`LKR ${total}`, width - margin, y);

                y += 30;
            });
            drawDashedLine();

            const { summary, status } = data.financials;
            drawLeftRight("Subtotal:", `LKR ${Number(summary.subtotal).toFixed(2)}`, 18);
            if (summary.discount > 0) {
                drawLeftRight("Discount:", `- LKR ${Number(summary.discount).toFixed(2)}`, 18);
            }
            y += 10;
            drawLeftRight("TOTAL:", `LKR ${Number(summary.total).toFixed(2)}`, 28, true);
            drawDashedLine();

            drawCentered("PAYMENT DETAILS", 18, true);
            y += 10;
            if (summary.paidAmount > 0) drawLeftRight("Cash:", `LKR ${Number(summary.paidAmount).toFixed(2)}`, 18);
            if (summary.balance > 0) drawLeftRight("Balance Due:", `LKR ${Number(summary.balance).toFixed(2)}`, 18);

            y += 20;
            drawLeftRight("Status:", status ? status.toUpperCase() : "PAID", 20, true);
            y += 10;
            drawDashedLine();

            y += 10;
            drawCentered("THANK YOU!", 20, true);
            drawCentered("Please Visit Again", 16);
            y += 20;
            ctx.font = "italic 14px Arial";
            ctx.fillText("Powered by Hexcore", centerX, y);

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