// services/PrinterService.js
const CustomUSB = require('../usb-adapter'); // Note the '..' to go back up one folder
const config = require('../config');

class PrinterService {
    constructor() {
        this.isConnected = false;
        this.reconnectTimer = null;
    }

    startMonitoring() {
        this.checkConnection();
        this.reconnectTimer = setInterval(() => this.checkConnection(), config.printer.reconnectInterval);
    }

    async checkConnection() {
        return new Promise(resolve => {
            try {
                const dev = new CustomUSB(config.printer.vid, config.printer.pid);
                dev.open(err => {
                    if (!err) {
                        dev.close();
                        if (!this.isConnected) console.log("✅ Printer Connected (Hardware)");
                        this.isConnected = true;
                    } else {
                        if (this.isConnected) console.warn("⚠️ Printer Disconnected");
                        this.isConnected = false;
                    }
                    resolve(this.isConnected);
                });
            } catch (e) {
                this.isConnected = false;
                resolve(false);
            }
        });
    }

    async print(buffer) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) return reject(new Error("Printer not connected"));

            try {
                const dev = new CustomUSB(config.printer.vid, config.printer.pid);
                dev.open(err => {
                    if (err) return reject(err);
                    dev.write(buffer, writeErr => {
                        dev.close();
                        if (writeErr) reject(writeErr);
                        else resolve();
                    });
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}

module.exports = PrinterService;