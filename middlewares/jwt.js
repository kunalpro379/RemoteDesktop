
const https = require('https');


const region = 'ap-south-1';
const userPoolId = 'ap-south-1_RMDcX6Ucr';
const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;

// Function to get JWKS
const getJWKS = () => {
    return new Promise((resolve, reject) => {
        https.get(jwksUri, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
};

// Function to base64 URL decode
const base64UrlDecode = (str) => {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(base64, 'base64');
    return JSON.parse(buffer.toString('utf-8'));
};

// Middleware to validate token
const validateTokenMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized. Missing or invalid token.' });
        }

        const token = authHeader.split(' ')[1];
        const tokenParts = token.split('.');
        const decodedHeader = base64UrlDecode(tokenParts[0]);

        const jwks = await getJWKS();
        const key = jwks.keys.find(k => k.kid === decodedHeader.kid);

        if (!key) {
            return res.status(401).json({ error: 'Invalid key' });
        }

        // Signature verification can be added here if needed

        req.decodedPayload = base64UrlDecode(tokenParts[1]);
        next();
    } catch (error) {
        console.error('Token validation error:', error.message);
        res.status(400).json({ error: 'Invalid token format', details: error.message });
    }
};

module.exports = {
    validateTokenMiddleware
};
