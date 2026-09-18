// routes/dataset.js
//
// Isolated dataset-upload feature. Mounted once in server.js as
// `app.use('/api/v2/dataset', require('./routes/dataset'))` — nothing here
// touches any printer route, middleware, or service.
const express = require('express');
const multer = require('multer');
const DatasetUploader = require('../services/DatasetUploader');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

router.post('/upload', (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File exceeds the maximum allowed size (50MB)' });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            const { updatedOn, targetPath, fileType, fileName } = req.body;
            const result = await DatasetUploader.save({
                updatedOn,
                targetPath,
                fileType,
                fileName,
                file: req.file
            });

            return res.status(200).json({
                status: 'success',
                savedPath: result.savedPath,
                fileName: result.fileName,
                updatedOn: result.updatedOn
            });
        } catch (e) {
            if (e instanceof DatasetUploader.ValidationError) {
                return res.status(400).json({ error: e.message });
            }
            console.error(e);
            return res.status(500).json({ error: e.message });
        }
    });
});

module.exports = router;
