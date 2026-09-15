// Converts a monochrome bitmap (as produced by each builder's convertToMonochrome)
// into raw printer command bytes. TSPL is used by the XP-380; ESC/POS by the XP-80T.
//
// Bitmap bit convention from convertToMonochrome: bit=1 means WHITE pixel, bit=0 means
// BLACK/print. ESC/POS's GS v 0 raster command expects the opposite (bit=1 = print),
// so escposBitmap() inverts the bytes before sending.
class PrinterCommands {
    static escposBitmap(bitmap) {
        const inverted = Buffer.alloc(bitmap.data.length);
        for (let i = 0; i < bitmap.data.length; i++) {
            inverted[i] = ~bitmap.data[i] & 0xff;
        }

        const xL = bitmap.widthBytes & 0xff;
        const xH = (bitmap.widthBytes >> 8) & 0xff;
        const yL = bitmap.heightDots & 0xff;
        const yH = (bitmap.heightDots >> 8) & 0xff;

        return Buffer.concat([
            Buffer.from([0x1b, 0x40]),                                // ESC @  - initialize printer
            Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]),     // GS v 0 - print raster bit image
            inverted,
            // GS V 1 - partial cut (2-byte form). The cut command itself advances the
            // paper to the cutter, so no manual feed beforehand is needed; the extended
            // 4-byte form (GS V 66 n) isn't reliably supported by cheaper POS-80 clones
            // and can cause them to feed far more paper than expected before cutting.
            Buffer.from([0x1d, 0x56, 0x01]),
        ]);
    }
}

module.exports = PrinterCommands;
