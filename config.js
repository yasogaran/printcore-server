// config.js
require('dotenv').config();
const path = require('path');

module.exports = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 9000,
    printer: {
        vid: 0x1fc9, 
        pid: 0x2016,
        reconnectInterval: 5000
    },
    paths: {
        debug: path.join(__dirname, 'debug_output'),
        assets: path.join(__dirname, 'assets')
    }
};