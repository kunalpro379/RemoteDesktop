// server.js
const httpPort = 3096;
const httpsPort = 3097;  // New HTTPS port
const http = require('http');
// const https = require('https');
const fs = require('fs');
const express = require('express');
const path = require('path');
const cors = require('cors');
const { validateTokenMiddleware } = require('./middlewares/jwt');
const errorHandler = require('./middlewares/error');
const KurentoManager = require('./KurentoManager/KurentoManager');
const SocketHandler = require('./socket_handler/socket');
const robot = require('robotjs'); // Add this line

// Create Express app
const app = express();

// SSL certificates
// const options = {
//     key: fs.readFileSync('certs/private.key'),
//     cert: fs.readFileSync('certs/certificate.crt')
// };

// Simplify to just HTTP for local development
const httpServer = http.createServer(app);

// Update CORS settings
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
}));

// Simplify Socket.IO setup
const io = require('socket.io')(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Remove the HTTP to HTTPS redirect for socket.io paths
// app.use((req, res, next) => {
//     if (!req.secure && !req.url.includes('/socket.io/')) {
//         return res.redirect(['https://', req.hostname, ':', httpsPort, req.url].join(''));
//     }
//     next();
// });

app.use((req, res, next) => {
    if (!req.secure && !req.url.includes('/socket.io/')) {
        return res.redirect(['http://', req.hostname, ':', httpPort, req.url].join(''));
    }
    next();
});

// Import routes
const hostRoutes = require('./routes/host.routes');
const userRoutes = require('./routes/user.routes');

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Middleware to set CORS headers
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    // res.setHeader('Feature-Policy', 'display-capture *');
    // res.setHeader('Permissions-Policy', 'display-capture=(self)');
    next();
});
// Static files middleware
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/client', express.static(path.join(__dirname, 'client')));
app.use(express.static('public'));

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Routes
app.use('/api/host', validateTokenMiddleware, hostRoutes);  // Protected route
app.use('/api/user', userRoutes);  // Unprotected route

// Error handling must be last
app.use(errorHandler);

// Initialize Kurento Manager
const kurentoManager = new KurentoManager('127.0.0.1', 8888);

// Initialize Socket Handler
new SocketHandler(io, kurentoManager);

io.on('connection', (socket) => {
    
    socket.on('cursorPosition', (data) => {
        try {
            // Get system screen size
            const screenSize = robot.getScreenSize();
            
            // Convert normalized coordinates to actual screen coordinates
            const x = Math.round(data.x * screenSize.width);
            const y = Math.round(data.y * screenSize.height);
            
            console.log('Screen mapping:', {
                normalized: { x: data.x, y: data.y },
                screen: { x, y },
                screenSize,
                videoInfo: data.videoInfo
            });

            // Move the actual system cursor
            robot.moveMouse(x, y);

            // Handle clicks
            if (data.clicking) {
                robot.mouseClick();
            }

            socket.broadcast.emit('cursorPosition', {
                ...data,
                systemX: x,
                systemY: y,
                screenSize
            });
            console.log(
                
                    data,
                     x,
                    y,
                    screenSize
            
            )
        } catch (error) {
            console.error('Robot.js error:', error);
        }
    });
});

// Start only HTTP server
httpServer.listen(httpPort, () => {
    console.log(`HTTP server running on port ${httpPort}`);
});












