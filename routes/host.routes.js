const express = require('express');
const router = express.Router();
const { validateTokenMiddleware } = require('../middlewares/jwt');

router.post('/start', validateTokenMiddleware, (req, res) => {
    try {
        // Host start logic
        res.json({ status: 'success', message: 'Host session started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/stop', validateTokenMiddleware, (req, res) => {
    try {
        // Host stop logic
        res.json({ status: 'success', message: 'Host session stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
