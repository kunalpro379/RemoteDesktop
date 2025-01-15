const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: err.message
        });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message
        });
    }

    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
};

module.exports = errorHandler;
