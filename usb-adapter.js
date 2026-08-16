// usb-adapter.js (Updated Safe Version)
const usb = require('usb');

class CustomUSB {
    constructor(vid, pid) {
        this.vid = vid;
        this.pid = pid;
        this.device = null;
        this.interface = null;
        this.endpoint = null;
    }

    open(callback) {
        try {
            this.device = usb.findByIds(this.vid, this.pid);
            
            if (!this.device) {
                return callback(new Error('Printer not found or turned off'));
            }

            this.device.open();
            
            // Standard Thermal Printers use Interface 0
            this.interface = this.device.interfaces[0];

            // === THE FIX IS HERE ===
            // On Windows + WinUSB, checking "isKernelDriverActive" crashes the app.
            // We ONLY run this check if we are NOT on Windows.
            if (process.platform !== 'win32') {
                try {
                    if (this.interface.isKernelDriverActive()) {
                        this.interface.detachKernelDriver();
                    }
                } catch (e) {
                    // Ignore errors here, just proceed
                }
            }
            // =======================

            this.interface.claim();

            // Find OUT endpoint
            this.endpoint = this.interface.endpoints.find(e => e.direction === 'out');
            
            if (!this.endpoint) {
                return callback(new Error('Output endpoint not found on device'));
            }

            callback(null); // Success
        } catch (err) {
            callback(err);
        }
    }

    write(data, callback) {
        if (!this.endpoint) {
            return callback(new Error('Device is not open'));
        }
        
        this.endpoint.transfer(data, (err) => {
            callback(err);
        });
    }

    close(callback) {
        try {
            if (this.interface) {
                this.interface.release(true, (err) => {
                    if (this.device) {
                        this.device.close();
                    }
                    if (callback) callback(err);
                });
            } else {
                if (callback) callback();
            }
        } catch (e) {
            if (callback) callback(e);
        }
    }
}

module.exports = CustomUSB;