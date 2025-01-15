// server.js
const httpPort = 3096;
const http = require('http');
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

// Create an HTTP server
const server = http.createServer(app);

// Set up Socket.IO with CORS configuration
const sio = require('socket.io')({
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Attach Socket.IO to the server
sio.attach(server);

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
new SocketHandler(sio, kurentoManager);

sio.on('connection', (socket) => {
    
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

// Start the server and listen on the specified port
server.listen(httpPort, () => {
    console.log(`Http server listening at port ${httpPort}`);
});












