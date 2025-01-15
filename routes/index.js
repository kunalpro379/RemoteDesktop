const express = require('express');
const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// API documentation route
router.get('/api-docs', (req, res) => {
    res.json({
        endpoints: {
            host: {
                start: 'POST /api/host/start',
                stop: 'POST /api/host/stop'
            },
            controller: {
                connect: 'POST /api/controller/connect',
                disconnect: 'POST /api/controller/disconnect'
            },
            user: {
                profile: 'GET /api/user/profile',
                settings: 'PUT /api/user/settings'
            }
        }
    });
});

module.exports = router;
