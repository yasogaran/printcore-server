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
            // ESC d 5 - feed 5 lines before cutting. On tall raster images (e.g. boxed
            // template with a trailing barcode section) the cutter can fire before the
            // tail of the image has physically cleared the print head, so it ends up
            // printed past the cut line on the next receipt. GS V's own paper advance
            // isn't enough to guarantee that on cheaper POS-80 clones.
            Buffer.from([0x1b, 0x64, 0x05]),
            // GS V 1 - partial cut (2-byte form). The extended 4-byte form (GS V 66 n)
            // isn't reliably supported by cheaper POS-80 clones and can cause them to
            // feed far more paper than expected before cutting.
            Buffer.from([0x1d, 0x56, 0x01]),
        ]);
    }

    // ESC p m t1 t2 - generate a pulse to kick the cash drawer connected to the
    // printer's RJ11 port. m selects the pin (0 = pin 2, 1 = pin 5; pin 2 is the
    // standard/default wiring). t1/t2 are the pulse ON/OFF durations; 25/250 is the
    // widely-used default (~50ms on / ~500ms off).
    static escposDrawerKick(pin = 2, onMs = 25, offMs = 250) {
        const m = pin === 5 ? 1 : 0;
        return Buffer.from([0x1b, 0x70, m, onMs & 0xff, offMs & 0xff]);
    }
}

module.exports = PrinterCommands;
