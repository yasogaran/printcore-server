// config.js
require('dotenv').config();
const path = require('path');

// Known Zadig/WinUSB VID:PID pairs and command language per printer model.
// Select via PRINTER_MODEL in .env. "tspl" = label-printer commands (XP-380),
// "escpos" = receipt-printer commands (XP-80T / PrinterPOS-80).
const PRINTER_PROFILES = {
    'xp-380': { vid: 0x1fc9, pid: 0x2016, language: 'tspl' },
    'xp-80t': { vid: 0x0483, pid: 0x5743, language: 'escpos' },
};

const printerModel = (process.env.PRINTER_MODEL || 'xp-380').toLowerCase();
const printerProfile = PRINTER_PROFILES[printerModel] || PRINTER_PROFILES['xp-380'];

module.exports = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 9000,
    printer: {
        // PRINTER_VID/PRINTER_PID (hex, no 0x prefix, e.g. "1FC9") override the profile above.
        vid: process.env.PRINTER_VID ? parseInt(process.env.PRINTER_VID, 16) : printerProfile.vid,
        pid: process.env.PRINTER_PID ? parseInt(process.env.PRINTER_PID, 16) : printerProfile.pid,
        // PRINTER_LANGUAGE overrides the profile's command language ("tspl" or "escpos").
        language: (process.env.PRINTER_LANGUAGE || printerProfile.language || 'tspl').toLowerCase(),
        reconnectInterval: 5000
    },
    paths: {
        debug: path.join(__dirname, 'debug_output'),
        assets: path.join(__dirname, 'assets')
    }
};