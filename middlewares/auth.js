const jwt = require('./jwt');

const authMiddleware = async (req, res, next) => {
    try {
        // Validate token
        await jwt.validateTokenMiddleware(req, res, next);
        
        // Add session tracking
        req.session = {
            startTime: new Date(),
            userId: req.user.sub
        };
        
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = authMiddleware;
