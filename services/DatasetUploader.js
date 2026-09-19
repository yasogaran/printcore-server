// services/DatasetUploader.js
//
// Fully isolated from the printer feature set: saves an uploaded dataset file
// (.csv/.txt) to a caller-supplied local target path, and appends one line per
// successful action to a plain-text log. No dependency on config.js or any
// printer service — everything this feature needs lives in this one file.
const fs = require('fs');
const path = require('path');

const ALLOWED_TYPES = ['.csv', '.txt'];
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'dataset-uploads.log');

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class DatasetUploader {
    static normalizeType(fileType) {
        if (!fileType) return '';
        const t = fileType.trim().toLowerCase();
        return t.startsWith('.') ? t : `.${t}`;
    }

    static async save({ updatedOn, targetPath, fileType, fileName, file }) {
        if (!targetPath) throw new ValidationError('targetPath is required');
        if (!file) throw new ValidationError('file is required');

        const normalizedType = DatasetUploader.normalizeType(fileType);
        if (!ALLOWED_TYPES.includes(normalizedType)) {
            throw new ValidationError(`fileType must be one of ${ALLOWED_TYPES.join(', ')}`);
        }

        // basename keeps the file inside targetPath even if the caller sends separators.
        let storedName = path.basename(fileName || file.originalname);
        if (!path.extname(storedName)) storedName += normalizedType;

        const storedExt = path.extname(storedName).toLowerCase();
        if (storedExt !== normalizedType) {
            throw new ValidationError(
                `File name extension "${storedExt}" does not match declared fileType "${normalizedType}"`
            );
        }

        fs.mkdirSync(targetPath, { recursive: true });

        const savedPath = path.join(targetPath, storedName);
        fs.writeFileSync(savedPath, file.buffer);

        const resolvedUpdatedOn = updatedOn || new Date().toISOString();
        DatasetUploader.logAction({
            updatedOn: resolvedUpdatedOn,
            targetPath,
            fileName: storedName,
            fileType: normalizedType
        });

        return { savedPath, fileName: storedName, updatedOn: resolvedUpdatedOn };
    }

    static logAction({ updatedOn, targetPath, fileName, fileType }) {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        const line = `${updatedOn} | ${targetPath} | ${fileName} | ${fileType}\n`;
        fs.appendFileSync(LOG_FILE, line);
    }
}

module.exports = DatasetUploader;
module.exports.ValidationError = ValidationError;
module.exports.ALLOWED_TYPES = ALLOWED_TYPES;
module.exports.LOG_FILE = LOG_FILE;
