// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('./config');
const ReceiptBuilder = require('./services/ReceiptBuilder');
const BoxedReceiptBuilder = require('./services/BoxedReceiptBuilder');
const LabelBuilder = require('./services/LabelBuilder');
const LabelImagePrinter = require('./services/LabelImagePrinter');
const ThermalImagePrinter = require('./services/ThermalImagePrinter');
const PrinterService = require('./services/PrinterService');
const PrinterCommands = require('./services/PrinterCommands');
const VirtualPrinter = require('./services/VirtualPrinter'); 

const app = express();
app.use(cors());
app.use(bodyParser.json());

const printer = new PrinterService();
const virtual = new VirtualPrinter();

// --- API DOCUMENTATION AT ROOT ---
app.get('/', (req, res) => {
    res.json({
        service: "PrintCore Thermal Print Server",
        developed_by:"yasogaran at Hexcore Pvt Ltd",
        version: "2.0.0",
        endpoints: {
            "POST /api/v2/print/receipt": "Send structured receipt object. Set settings.template to 'boxed-template' for the boxed invoice layout (MRP/Selling/Qty boxes, item discounts, loyalty points), print_barcode: true to append an invoice code barcode, and kick_drawer: true to pulse the cash drawer on the printer's RJ11 port (ESC/POS printers only). See docs/receipt-printing.md",
            "POST /api/v2/print/label": "Send structured label object",
            "POST /api/v2/print/label/image": "Print base64-encoded image on label",
            "POST /api/v2/print/image": "Print base64-encoded image on thermal paper"
        }
    });
});

// --- RECEIPT ENDPOINT ---
app.post('/api/v2/print/receipt', async (req, res) => {
    try {
        const data = req.body;
        if (!data.store || !data.items || !data.financials) {
            return res.status(400).json({ error: "Missing required invoice fields" });
        }

        const Builder = data.settings?.template === 'boxed-template' ? BoxedReceiptBuilder : ReceiptBuilder;
        const builder = new Builder(data);
        let buffer = await builder.build();

        let drawerNote;
        if (data.kick_drawer) {
            if (config.printer.language === 'escpos') {
                const kick = PrinterCommands.escposDrawerKick(data.drawerPin, data.drawerOnMs, data.drawerOffMs);
                buffer = Buffer.concat([buffer, kick]); // one write, drawer opens right after the cut
            } else {
                drawerNote = 'unsupported for tspl printer';
            }
        }

        if (printer.isConnected) {
            await printer.print(buffer);
            return res.json({ status: "success", mode: "hardware", ...(drawerNote && { drawer: drawerNote }) });
        } else if (config.env === 'development') {
            // Generate Virtual Receipt
            if (data.kick_drawer && config.printer.language === 'escpos') {
                drawerNote = 'skipped (no hardware connected)';
            }
            const result = await virtual.saveImage(data, 'receipt_v2');
            return res.json({ status: "success", mode: "virtual", file: result.filename, ...(drawerNote && { drawer: drawerNote }) });
        } else {
            return res.status(503).json({ error: "Printer Offline" });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- LABEL ENDPOINT (FIXED) ---
app.post('/api/v2/print/label', async (req, res) => {
    try {
        const data = req.body;
        if (!data.size || !data.product) {
            return res.status(400).json({ error: "Missing size or product data" });
        }

        const builder = new LabelBuilder(data);
        const buffer = await builder.build();

        if (printer.isConnected) {
            await printer.print(buffer);
            return res.json({ status: "success", mode: "hardware" });
        } else if (config.env === 'development') {
            // === FIX IS HERE: Call saveImage instead of just returning JSON ===
            const result = await virtual.saveImage(data, 'label');
            return res.json({ status: "success", mode: "virtual", file: result.filename });
        } else {
            return res.status(503).json({ error: "Printer Offline" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- LABEL IMAGE ENDPOINT ---
app.post('/api/v2/print/label/image', async (req, res) => {
    try {
        const data = req.body;
        if (!data.image || !data.width || !data.height) {
            return res.status(400).json({
                error: "Missing required fields: image (base64), width (mm), height (mm)"
            });
        }

        const builder = new LabelImagePrinter(data);
        const buffer = await builder.build();

        if (printer.isConnected) {
            await printer.print(buffer);
            return res.json({ status: "success", mode: "hardware" });
        } else if (config.env === 'development') {
            // In development, save debug image
            const result = await virtual.saveImage(data, 'label_image');
            return res.json({ status: "success", mode: "virtual", file: result.filename });
        } else {
            return res.status(503).json({ error: "Printer Offline" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- THERMAL IMAGE ENDPOINT ---
app.post('/api/v2/print/image', async (req, res) => {
    try {
        const data = req.body;
        if (!data.image || !data.width) {
            return res.status(400).json({ 
                error: "Missing required fields: image (base64), width (mm)" 
            });
        }

        const builder = new ThermalImagePrinter(data);
        const buffer = await builder.build();

        if (printer.isConnected) {
            await printer.print(buffer);
            return res.json({ status: "success", mode: "hardware" });
        } else if (config.env === 'development') {
            // In development, save debug image
            const result = await virtual.saveImage(data, 'thermal_image');
            return res.json({ status: "success", mode: "virtual", file: result.filename });
        } else {
            return res.status(503).json({ error: "Printer Offline" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Start
app.listen(config.port, () => {
    console.log(`🚀 Professional Print Server running on port ${config.port}`);
    printer.startMonitoring();
});