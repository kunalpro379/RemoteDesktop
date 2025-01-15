const express = require('express');
const router = express.Router();
const { validateTokenMiddleware } = require('../middlewares/jwt');
const prisma = require('../prisma/db');

router.post('/decode-token', validateTokenMiddleware, async (req, res) => {
    try {
        const userDetails = req.decodedPayload;
        console.log('Decoded user details:', userDetails); // Add logging for debugging
        
        let user = await prisma.user.findFirst({
            where: {
                email: userDetails.email
            }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    username: userDetails["cognito:username"], // Fixed: using correct field name
                    email: userDetails.email,
                    phoneNumber: userDetails.phone_number || null,
                    gender: userDetails.gender || null
                }
            });

            console.log('New user created:', user.email);
        }

        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phoneNumber: user.phoneNumber,
                gender: user.gender,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ 
            error: 'Login failed', 
            details: error.message 
        });
    }
});

module.exports = router;