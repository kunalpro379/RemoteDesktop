








// Import required modules
const httpPort = 3000;
const kurentoIP = '127.0.0.1';
const kurentoPort = 8888;
const fs = require('fs');
const http = require('http');
const express = require('express');
const kurento = require('kurento-client');
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

// Start the server and listen on the specified port
server.listen(httpPort, () => {
    console.log(`Http server listening at port ${httpPort}`);
});

// Middleware to set CORS headers
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

/*
 * Definition of global variables.
 */
var stIdCounter = 0;
var stCandidatesQueue = {};
var stKurentoClient = null;
var stPresenter = {};
var stViewers = [];
var stNoPresenterMessage = 'No active presenter. Try again later...';

var presenter = {};
var viewers = {};
var waitingViewers = {};

const stOptions = {
    ws_uri: 'ws://' + kurentoIP + ':' + kurentoPort + '/kurento'
};

// Function to get the sender for a viewer
const getSender = (sessionId, id) => {
    if (!presenter || !presenter[sessionId]) {
        return;
    }
    if (presenter[sessionId].streamMechanism == "peer") {
        return presenter[sessionId].id;
    }
    let viewerKeys = Object.keys(viewers);
    if (Object.keys(presenter[sessionId].viewers).length < 2) {
        return presenter[sessionId].id;
    }
    let senderId = null;
    for (let idx = 0; idx < viewerKeys.length; idx++) {
        let viewer = viewers[viewerKeys[idx]];
        if (!viewer) {
            continue;
        }
        if (viewer.sessionId != sessionId) {
            continue;
        }
        if (viewer.disconnected) {
            viewer.disconnect();
            continue;
        }
        if (viewer.isMobile == 'true') {
            continue;
        }
        if (Object.keys(viewer.viewers).length >= 2) {
            continue;
        }
        if (viewer.parents[id]) {
            continue;
        }
        if (viewer.senderId == viewers[id].senderId) {
            continue;
        }
        senderId = viewer.id;
        break;
    }
    if (!senderId) {
        senderId = presenter[sessionId].id;
    }
    return senderId;
};

// Function to unregister a viewer
const unregisterViewer = (socket) => {
    Object.keys(socket.parents).forEach(parent => {
        if (viewers[parent]) {
            delete viewers[parent].childs[socket.id];
        }
    });
    if (presenter && presenter[socket.sessionId] && presenter[socket.sessionId].parents[socket.id]) {
        delete presenter[socket.sessionId].parents[socket.id];
    }

    Object.keys(socket.childs).forEach(child => {
        if (viewers[child]) {
            delete viewers[child].parents[socket.id];
        }
    });
    if (presenter && presenter[socket.sessionId] && presenter[socket.sessionId].childs[socket.id]) {
        delete presenter[socket.sessionId].childs[socket.id];
    }

    if (presenter && presenter[socket.sessionId]) {
        delete presenter[socket.sessionId].viewers[socket.id];
    }
    delete viewers[socket.id];

    if (socket.viewers) {
        Object.keys(socket.viewers).forEach(viewer => {
            try {
                if (!viewers[viewer]) {
                    return;
                }
                viewers[viewer].senderId = getSender(viewers[viewer].sessionId, viewers[viewer].id);
                viewers[viewer].emit("senderDisconnected", { newSenderId: viewers[viewer].senderId });
                let sender = viewers[viewer].senderId != presenter[socket.sessionId].id ? viewers[viewers[viewer].senderId] : presenter[socket.sessionId];
                sender.viewers[viewer] = viewers[viewer];
                if (presenter && presenter[socket.sessionId]) {
                    presenter[socket.sessionId].emit("viewerRegistered", { id: viewer, sender: viewers[viewer].senderId });
                }
            }
            catch (ex) { }
        });
    }
    if (viewers[socket.senderId]) {
        delete viewers[socket.senderId].viewers[socket.id];
        if (!viewers[socket.senderId].viewers) {
            viewers[socket.senderId].viewers = {};
        }
    }

    console.log("unregister viewer " + socket.id);

    if (presenter && presenter[socket.sessionId]) {
        presenter[socket.sessionId].emit("viewerLeave", { id: socket.id });
    }
}

// Function to generate a unique ID
function nextUniqueId() {
    stIdCounter++;
    return stIdCounter.toString();
}

// Handle new socket connections
sio.on('connection', (socket) => {
    socket.isMobile = socket.handshake.query.mobile;
    socket.sessionId = socket.handshake.query.session_id ? socket.handshake.query.session_id : 'general';

    // Register a new presenter
    socket.on('registerPresenter', (fn) => {
        if (presenter[socket.sessionId]) {
            if (typeof (fn) == 'function') {
                fn(false);
            }
            return;
        }
        console.log("register presenter " + socket.sessionId + " " + socket.id);
        presenter[socket.sessionId] = socket;
        presenter[socket.sessionId].viewers = {};
        presenter[socket.sessionId].parents = {};
        presenter[socket.sessionId].childs = {};
        presenter[socket.sessionId].maxConnection = 2;
        presenter[socket.sessionId].streamMechanism = "distributed";
        socket.isPresenter = true;

        let existingViewers = [];
        Object.keys(viewers).forEach(id => {
            if (viewers[id].sessionId == socket.sessionId) {
                viewers[id].emit("presenterAvailable");
                existingViewers.push({ id: id });
            }
        });
        Object.keys(waitingViewers).forEach(id => {
            if (waitingViewers[id].sessionId == socket.sessionId) {
                waitingViewers[id].emit("presenterAvailable");
            }
        });
        if (typeof (fn) == 'function') {
            fn(true);
        }
    });
'sendPresenterCandidate'
    
    // Register a waiting viewer
    socket.on('registerWaitingViewer', (fn) => {
        console.log("register waiting viewer " + socket.sessionId + " " + socket.id);
        if (viewers[socket.id]) {
            unregisterViewer(socket);
        }

        waitingViewers[socket.id] = socket;
        if (typeof (fn) == 'function') {
            fn({ presenterStatus: presenter && presenter[socket.sessionId] ? 'online' : 'offline', sharingStatus: presenter && presenter[socket.sessionId] ? presenter[socket.sessionId].sharingStatus : 'stop' });
        }
    });

    // Register a new viewer
    socket.on('registerViewer', (fn) => {
        console.log("register viewer " + socket.sessionId + " " + socket.id);
        delete waitingViewers[socket.id];
        viewers[socket.id] = socket;
        socket.isViewer = true;
        socket.viewers = {};
        socket.parents = {};
        socket.childs = {};
        if (!presenter || !presenter[socket.sessionId]) {
            socket.waitingPresenter = true;
            return;
        }
        socket.senderId = getSender(socket.sessionId, socket.id);

        let sender = viewers[socket.senderId] ? viewers[socket.senderId] : presenter[socket.sessionId];
        sender.viewers[socket.id] = socket;

        sender.childs[socket.id] = true;
        Object.keys(sender.parents).forEach(parent => {
            if (viewers[parent]) {
                viewers[parent].childs[socket.id] = true;
            }
        })
        socket.parents[sender.id] = true;

        if (presenter && presenter[socket.sessionId]) {
            presenter[socket.sessionId].emit("viewerRegistered", { id: socket.id, sender: socket.senderId });
        }
        if (typeof (fn) == 'function') {
            fn({ senderId: socket.senderId, sharingStatus: presenter[socket.sessionId].sharingStatus, streamMechanism: presenter && presenter[socket.sessionId] ? presenter[socket.sessionId].streamMechanism : null });
        }
    });

    // Handle socket disconnection
    socket.on('disconnect', () => {
        stop(sessionId, socket);
        if (socket.isPresenter) {
            console.log("unregister presenter " + socket.sessionId + " " + socket.id);
            delete presenter[socket.sessionId];
            Object.keys(viewers).forEach(id => {
                if (viewers[id].sessionId == socket.sessionId) {
                    viewers[id].emit("presenterUnavailable");
                }
            });
            Object.keys(waitingViewers).forEach(id => {
                if (waitingViewers[id].sessionId == socket.sessionId) {
                    waitingViewers[id].emit("presenterUnavailable");
                }
            });
            Object.keys(socket.viewers).forEach(id => {
                socket.viewers[id].emit("senderDisconnected");
            });
        }
        if (socket.isViewer) {
            unregisterViewer(socket);
        }
    });

    // Handle presenter offer
    socket.on("setPresenterOffer", (data) => {
        if (!viewers[data.id]) {
            return;
        }
        viewers[data.id].emit("sendPresenterOffer", { offer: data.offer });
    })

    // Handle viewer offer
    socket.on("setViewerOffer", (data) => {
        if (socket.senderId && viewers[socket.senderId]) {
            viewers[socket.senderId].emit("sendViewerOffer", { id: socket.id, offer: data.offer });
        }
        else {
            presenter && presenter[socket.sessionId] && presenter[socket.sessionId].emit("sendViewerOffer", { id: socket.id, offer: data.offer });
        }
    });

    // Handle presenter candidate
    socket.on("setPresenterCandidate", (data) => {
        if (!viewers[data.id]) {
            return;
        }
        viewers[data.id].emit("sendPresenterCandidate", { candidate: data.candidate });
    });

    // Handle viewer candidate
    socket.on("setViewerCandidate", (data) => {
        if (!presenter || !presenter[socket.sessionId]) {
            return;
        }
        if (data.id) {
            if (viewers[data.id]) {
                viewers[data.id].emit("sendPresenterCandidate", { candidate: data.candidate });
            }
        }
        else {
            if (socket.senderId != presenter[socket.sessionId].id) {
                if (viewers[socket.senderId]) {
                    viewers[socket.senderId].emit("sendViewerCandidate", { id: socket.id, candidate: data.candidate });
                }
            }
            else {
                presenter[socket.sessionId].emit("sendViewerCandidate", { id: socket.id, candidate: data.candidate });
            }
        }
    });

    // Handle sender creating a peer connection
    socket.on("senderCreatePeerConnection", (data) => {
        if (!viewers[data.sender]) {
            return;
        }
        viewers[data.sender].emit("senderCreatePeerConnection", { id: data.viewer });
    });

    // Handle presenter stopping sharing
    socket.on("presenterStopSharing", (data) => {
        if (!presenter[socket.sessionId]) {
            return;
        }
        presenter[socket.sessionId].sharingStatus = "stop";
        Object.keys(viewers).forEach(id => {
            if (viewers[id].sessionId == socket.sessionId) {
                viewers[id].emit("sharingStopped");
            }
        });
        Object.keys(waitingViewers).forEach(id => {
            if (waitingViewers[id].sessionId == socket.sessionId) {
                waitingViewers[id].emit("sharingStopped");
            }
        });
        stop(socket.sessionId, socket);
    });

    // Handle presenter starting sharing
    socket.on("presenterStartSharing", (data) => {
        if (presenter[socket.sessionId]) {
            presenter[socket.sessionId].sharingStatus = "start";
        }
        Object.keys(viewers).forEach(id => {
            if (viewers[id].sessionId == socket.sessionId) {
                viewers[id].emit("sharingStarted");
            }
        });
        Object.keys(waitingViewers).forEach(id => {
            if (waitingViewers[id].sessionId == socket.sessionId) {
                waitingViewers[id].emit("sharingStarted");
            }
        });
        for (let id in socket.viewers) {
            socket.viewers[id].emit("senderStartPlaying");
        }
    });

    // Handle setting the stream mechanism
    socket.on("setMechanism", (data) => {
        if (!socket.isPresenter) {
            return;
        }
        socket.streamMechanism = data;
    });

    // Check if a viewer is valid
    socket.on("checkValidViewer", (id) => {
        socket.emit("checkValidViewerResponse", { id: id, isValid: viewers[id] != null, sender: viewers[id] != null ? viewers[id].senderId : null });
    });

    /* Stream server */
    var sessionId = nextUniqueId();
    console.log('Connection received with sessionId ' + sessionId);

    socket.on('error', function (error) {
        console.log('Connection ' + sessionId + ' error');
        stop(sessionId, socket);
    });

    socket.on('close', function () {
        console.log('Connection ' + sessionId + ' closed');
        stop(sessionId, socket);
    });

    socket.on('message', function (_message) {
        var message = JSON.parse(_message);
        switch (message.id) {
            case 'presenter':
                startPresenter(sessionId, socket, message.sdpOffer, function (error, sdpAnswer) {
                    if (error) {
                        return socket.send(JSON.stringify({
                            id: 'presenterResponse',
                            response: 'rejected',
                            message: error
                        }));
                    }
                    socket.send(JSON.stringify({
                        id: 'presenterResponse',
                        response: 'accepted',
                        sdpAnswer: sdpAnswer
                    }));
                });
                break;

            case 'viewer':
                startViewer(sessionId, socket, message.sdpOffer, function (error, sdpAnswer) {
                    if (error) {
                        return socket.send(JSON.stringify({
                            id: 'viewerResponse',
                            response: 'rejected',
                            message: error
                        }));
                    }

                    socket.send(JSON.stringify({
                        id: 'viewerResponse',
                        response: 'accepted',
                        sdpAnswer: sdpAnswer
                    }));
                });
                break;

            case 'stop':
                stop(sessionId, socket);
                break;

            case 'onIceCandidate':
                onIceCandidate(sessionId, message.candidate, socket);
                break;

            default:
                socket.send(JSON.stringify({
                    id: 'error',
                    message: 'Invalid message ' + message
                }));
                break;
        }
    });
});

/*
 * Definition of functions
 */

// Recover kurentoClient for the first time.
function getstKurentoClient(socket, callback) {
    if (stKurentoClient !== null) {
        return callback(null, stKurentoClient);
    }

    kurento(stOptions.ws_uri, function (error, _stKurentoClient) {
        if (error) {
            console.log("Could not find media server at address " + stOptions.ws_uri);
            return callback("Could not find media server at address" + stOptions.ws_uri
                + ". Exiting with error " + error);
        }
        console.log("Open kurento clinet");
        stKurentoClient = _stKurentoClient;
        callback(null, stKurentoClient);
    });
}

// Start a presenter session
function startPresenter(sessionId, socket, sdpOffer, callback) {
    clearCandidatesQueue(sessionId);

    if (stPresenter[socket.sessionId] !== null && stPresenter[socket.sessionId] !== undefined) {
        stop(sessionId, socket);
        return callback("Another user is currently acting as stPresenter. Try again later ...");
    }

    stPresenter[socket.sessionId] = {
        id: sessionId,
        pipeline: null,
        webRtcEndpoint: null
    }
    socket.webRtcEndpoint = null;

    getstKurentoClient(socket, function (error, stKurentoClient) {
        if (error) {
            stop(sessionId, socket);
            return callback(error);
        }

        if (stPresenter[socket.sessionId] === null || stPresenter[socket.sessionId] === undefined) {
            stop(sessionId, socket);
            return callback(stNoPresenterMessage);
        }
        stKurentoClient.create('MediaPipeline', function (error, pipeline) {
            if (error) {
                stop(sessionId, socket);
                return callback(error);
            }

            if (!stPresenter[socket.sessionId]) {
                stop(sessionId, socket);
                return callback(stNoPresenterMessage);
            }

            stPresenter[socket.sessionId].pipeline = pipeline;

            socket.emit("streamserverPresenterAvailable");

            pipeline.create('WebRtcEndpoint', function (error, webRtcEndpoint) {
                if (error) {
                    stop(sessionId, socket);
                    return callback(error);
                }

                if (!stPresenter[socket.sessionId]) {
                    stop(sessionId, socket);
                    return callback(stNoPresenterMessage);
                }

                stPresenter[socket.sessionId].webRtcEndpoint = webRtcEndpoint;
                socket.webRtcEndpoint = webRtcEndpoint;

                if (stCandidatesQueue[sessionId]) {
                    while (stCandidatesQueue[sessionId].length) {
                        var candidate = stCandidatesQueue[sessionId].shift();
                        webRtcEndpoint.addIceCandidate(candidate);
                    }
                }

                webRtcEndpoint.on('OnIceCandidate', function (event) {
                    var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                    socket.send(JSON.stringify({
                        id: 'iceCandidate',
                        candidate: candidate
                    }));
                });

                webRtcEndpoint.processOffer(sdpOffer, function (error, sdpAnswer) {
                    if (error) {
                        stop(sessionId, socket);
                        return callback(error);
                    }

                    if (!stPresenter[socket.sessionId]) {
                        stop(sessionId, socket);
                        return callback(stNoPresenterMessage);
                    }

                    callback(null, sdpAnswer);
                });

                webRtcEndpoint.gatherCandidates(function (error) {
                    if (error) {
                        stop(sessionId, socket);
                        return callback(error);
                    }
                });
            });
        });
    });
}

// Start a viewer session
function startViewer(sessionId, socket, sdpOffer, callback) {
    if (!stPresenter[socket.sessionId]) {
        stop(sessionId, socket);
        return callback(stNoPresenterMessage);
    }
    stPresenter[socket.sessionId].pipeline.create('WebRtcEndpoint', function (error, webRtcEndpoint) {
        if (error) {
            stop(sessionId, socket);
            return callback(error);
        }
        if (!viewers[socket.id]) {
            stop(sessionId, socket);
            return;
        }
        viewers[socket.id].webRtcEndpoint = webRtcEndpoint;

        if (!stPresenter[socket.sessionId]) {
            stop(sessionId, socket);
            return callback(stNoPresenterMessage);
        }

        if (stCandidatesQueue[sessionId]) {
            while (stCandidatesQueue[sessionId].length) {
                var candidate = stCandidatesQueue[sessionId].shift();
                webRtcEndpoint.addIceCandidate(candidate);
            }
        }

        webRtcEndpoint.on('OnIceCandidate', function (event) {
            var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
            socket.send(JSON.stringify({
                id: 'iceCandidate',
                candidate: candidate
            }));
        });

        webRtcEndpoint.processOffer(sdpOffer, function (error, sdpAnswer) {
            if (error) {
                stop(sessionId, socket);
                return callback(error);
            }
            if (!stPresenter[socket.sessionId]) {
                stop(sessionId, socket);
                return callback(stNoPresenterMessage);
            }

            stPresenter[socket.sessionId].webRtcEndpoint.connect(webRtcEndpoint, function (error) {
                if (error) {
                    stop(sessionId, socket);
                    return callback(error);
                }
                if (!stPresenter[socket.sessionId]) {
                    stop(sessionId, socket);
                    return callback(stNoPresenterMessage);
                }

                callback(null, sdpAnswer);
                webRtcEndpoint.gatherCandidates(function (error) {
                    if (error) {
                        stop(sessionId, socket);
                        return callback(error);
                    }
                });
            });
        });
    });
}

// Clear the candidates queue for a session
function clearCandidatesQueue(sessionId) {
    if (stCandidatesQueue[sessionId]) {
        delete stCandidatesQueue[sessionId];
    }
}

// Stop a session
function stop(sessionId, socket) {
    if (socket.isPresenter) {
        Object.keys(viewers).forEach(id => {
            if (viewers[id] && viewers[id].sessionId == socket.sessionId) {
                viewers[id].send(JSON.stringify({
                    id: 'stopCommunication'
                }));
                if (viewers[id].webRtcEndpoint) {
                    viewers[id].webRtcEndpoint.release();
                    viewers[id].webRtcEndpoint = null;
                }
            }
        });
        if (stPresenter[socket.sessionId] && stPresenter[socket.sessionId].pipeline) {
            stPresenter[socket.sessionId].pipeline.release();
            stPresenter[socket.sessionId].pipeline = null;
        }
        delete stPresenter[socket.sessionId];
    }
    else if (viewers[socket.id]) {
        if (viewers[socket.id] && viewers[socket.id].webRtcEndpoint) {
            viewers[socket.id].webRtcEndpoint.release();
            viewers[socket.id].webRtcEndpoint = null;
        }
    }

    clearCandidatesQueue(sessionId);
}

// Handle ICE candidate
function onIceCandidate(sessionId, _candidate, socket) {
    var candidate = kurento.getComplexType('IceCandidate')(_candidate);

    if (socket.isPresenter && socket.webRtcEndpoint) {
        socket.webRtcEndpoint.addIceCandidate(candidate);
    }
    else if (socket.isViewer && socket.webRtcEndpoint) {
        socket.webRtcEndpoint.addIceCandidate(candidate);
    }
    else {
        if (!stCandidatesQueue[sessionId]) {
            stCandidatesQueue[sessionId] = [];
        }
        stCandidatesQueue[sessionId].push(candidate);
    }
}


// socketHandler.js
const SocketEventHandlers = require('./socket');

class SocketHandler {
    constructor(io, kurentoManager) {
        this.io = io;
        this.kurentoManager = kurentoManager;
        this.stIdCounter = 0;
        this.presenter = {};
        this.viewers = {};
        this.waitingViewers = {};
        this.eventHandlers = new SocketEventHandlers(io, kurentoManager, this);
        
        this.setupSocketHandlers();
    }

    nextUniqueId() {
        this.stIdCounter++;
        return this.stIdCounter.toString();
    }

    getSender(sessionId, id) {
        if (!this.presenter || !this.presenter[sessionId]) {
            return;
        }
        if (this.presenter[sessionId].streamMechanism == "peer") {
            return this.presenter[sessionId].id;
        }
        let viewerKeys = Object.keys(this.viewers);
        if (Object.keys(this.presenter[sessionId].viewers).length < 2) {
            return this.presenter[sessionId].id;
        }
        let senderId = null;
        for (let idx = 0; idx < viewerKeys.length; idx++) {
            let viewer = this.viewers[viewerKeys[idx]];
            if (!viewer || 
                viewer.sessionId != sessionId || 
                viewer.disconnected || 
                viewer.isMobile == 'true' || 
                Object.keys(viewer.viewers).length >= 2 || 
                viewer.parents[id] || 
                viewer.senderId == this.viewers[id].senderId) {
                continue;
            }
            senderId = viewer.id;
            break;
        }
        if (!senderId) {
            senderId = this.presenter[sessionId].id;
        }
        return senderId;
    }

    unregisterViewer(socket) {
        Object.keys(socket.parents).forEach(parent => {
            if (this.viewers[parent]) {
                delete this.viewers[parent].childs[socket.id];
            }
        });

        if (this.presenter && this.presenter[socket.sessionId] && this.presenter[socket.sessionId].parents[socket.id]) {
            delete this.presenter[socket.sessionId].parents[socket.id];
        }

        Object.keys(socket.childs).forEach(child => {
            if (this.viewers[child]) {
                delete this.viewers[child].parents[socket.id];
            }
        });

        if (this.presenter && this.presenter[socket.sessionId] && this.presenter[socket.sessionId].childs[socket.id]) {
            delete this.presenter[socket.sessionId].childs[socket.id];
        }

        if (this.presenter && this.presenter[socket.sessionId]) {
            delete this.presenter[socket.sessionId].viewers[socket.id];
        }
        delete this.viewers[socket.id];

        if (socket.viewers) {
            Object.keys(socket.viewers).forEach(viewer => {
                try {
                    if (!this.viewers[viewer]) return;
                    
                    this.viewers[viewer].senderId = this.getSender(this.viewers[viewer].sessionId, this.viewers[viewer].id);
                    this.viewers[viewer].emit("senderDisconnected", { newSenderId: this.viewers[viewer].senderId });
                    
                    let sender = this.viewers[viewer].senderId != this.presenter[socket.sessionId].id ? 
                        this.viewers[this.viewers[viewer].senderId] : 
                        this.presenter[socket.sessionId];
                    
                    sender.viewers[viewer] = this.viewers[viewer];
                    
                    if (this.presenter && this.presenter[socket.sessionId]) {
                        this.presenter[socket.sessionId].emit("viewerRegistered", { 
                            id: viewer, 
                            sender: this.viewers[viewer].senderId 
                        });
                    }
                } catch (ex) { }
            });
        }

        if (this.viewers[socket.senderId]) {
            delete this.viewers[socket.senderId].viewers[socket.id];
            if (!this.viewers[socket.senderId].viewers) {
                this.viewers[socket.senderId].viewers = {};
            }
        }

        console.log("unregister viewer " + socket.id);
        if (this.presenter && this.presenter[socket.sessionId]) {
            this.presenter[socket.sessionId].emit("viewerLeave", { id: socket.id });
        }
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            socket.isMobile = socket.handshake.query.mobile;
            socket.sessionId = socket.handshake.query.session_id ? socket.handshake.query.session_id : 'general';
            let sessionId = this.nextUniqueId();

            // Register all event handlers
            socket.on('registerPresenter', (fn) => this.eventHandlers.handlers.registerPresenter(socket, fn));
            socket.on('registerWaitingViewer', (fn) => this.eventHandlers.handlers.registerWaitingViewer(socket, fn));
            socket.on('registerViewer', (fn) => this.eventHandlers.handlers.registerViewer(socket, fn));
            socket.on('message', (message) => this.eventHandlers.handlers.handleMessage(socket, message, sessionId));
            socket.on('presenterStopSharing', () => this.eventHandlers.handlers.presenterStopSharing(socket, sessionId));
            socket.on('presenterStartSharing', () => this.eventHandlers.handlers.presenterStartSharing(socket));
            socket.on('disconnect', () => this.eventHandlers.handlers.handleDisconnect(socket, sessionId));

            // WebRTC signaling handlers
            socket.on("setPresenterOffer", (data) => {
                if (!this.viewers[data.id]) return;
                this.viewers[data.id].emit("sendPresenterOffer", { offer: data.offer });
            });

            socket.on("setViewerOffer", (data) => {
                if (socket.senderId && this.viewers[socket.senderId]) {
                    this.viewers[socket.senderId].emit("sendViewerOffer", { 
                        id: socket.id, 
                        offer: data.offer 
                    });
                } else {
                    this.presenter && this.presenter[socket.sessionId] && 
                    this.presenter[socket.sessionId].emit("sendViewerOffer", { 
                        id: socket.id, 
                        offer: data.offer 
                    });
                }
            });

            socket.on("setPresenterCandidate", (data) => {
                if (!this.viewers[data.id]) return;
                this.viewers[data.id].emit("sendPresenterCandidate", { 
                    candidate: data.candidate 
                });
            });

            socket.on("setViewerCandidate", (data) => {
                if (!this.presenter || !this.presenter[socket.sessionId]) return;
                
                if (data.id) {
                    if (this.viewers[data.id]) {
                        this.viewers[data.id].emit("sendPresenterCandidate", { 
                            candidate: data.candidate 
                        });
                    }
                } else {
                    if (socket.senderId != this.presenter[socket.sessionId].id) {
                        if (this.viewers[socket.senderId]) {
                            this.viewers[socket.senderId].emit("sendViewerCandidate", { 
                                id: socket.id, 
                                candidate: data.candidate 
                            });
                        }
                    } else {
                        this.presenter[socket.sessionId].emit("sendViewerCandidate", { 
                            id: socket.id, 
                            candidate: data.candidate 
                        });
                    }
                }
            });

            // Stream mechanism and viewer validation handlers
            socket.on("setMechanism", (data) => {
                if (!socket.isPresenter) return;
                socket.streamMechanism = data;
            });

            socket.on("checkValidViewer", (id) => {
                socket.emit("checkValidViewerResponse", {
                    id: id,
                    isValid: this.viewers[id] != null,
                    sender: this.viewers[id] != null ? this.viewers[id].senderId : null
                });
            });
        });
    }
}

module.exports = SocketHandler;