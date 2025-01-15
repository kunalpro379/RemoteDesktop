// socketHandler.js
const SocketEventHandlers = require('./SocketEventHandler');
const ViewerHelper = require('./viewerHelpers');
const SignalingHandler = require('./eventHandlers/signalingHandlers');

class SocketHandler {
    constructor(io, kurentoManager) {
        this.io = io;
        this.kurentoManager = kurentoManager;
        this.stIdCounter = 0;
        this.presenter = {};
        this.viewers = {};
        this.waitingViewers = {};
        this.eventHandlers = new SocketEventHandlers(io, kurentoManager, this);

        // Initialize ViewerHelper
        this.viewerHelper = new ViewerHelper(this.presenter, this.viewers);
        this.signalingHandler = new SignalingHandler(this);

        this.setupSocketHandlers();
        console.log('SocketHandler initialized');
    }

    nextUniqueId() {
        this.stIdCounter++;
        return this.stIdCounter.toString();
    }

    // Use the getSender method from the ViewerHelper class
    getSender(sessionId, id) {
        return this.viewerHelper.getSender(sessionId, id);
    }

    // Use the unregisterViewer method from the ViewerHelper class
    unregisterViewer(socket) {
        this.viewerHelper.unregisterViewer(socket);
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            socket.isMobile = socket.handshake.query.mobile;
            socket.sessionId = socket.handshake.query.session_id ? socket.handshake.query.session_id : 'general';
            let sessionId = this.nextUniqueId();

            // Register all event handlers
            socket.on('registerPresenter', (fn) => {
                console.log('Presenter registration attempt:', socket.id);
                this.eventHandlers.handlers.registerPresenter(socket, fn);
                console.log('Presenter state after registration:', this.presenter);
            });
            socket.on('registerWaitingViewer', (fn) => this.eventHandlers.handlers.registerWaitingViewer(socket, fn));
            socket.on('registerViewer', (fn) => this.eventHandlers.handlers.registerViewer(socket, fn));
            socket.on('message', (message) => this.eventHandlers.handlers.handleMessage(socket, message, sessionId));
            socket.on('presenterStopSharing', () => this.eventHandlers.handlers.presenterStopSharing(socket, sessionId));
            socket.on('presenterStartSharing', () => this.eventHandlers.handlers.presenterStartSharing(socket));
            socket.on('disconnect', () => this.eventHandlers.handlers.handleDisconnect(socket, sessionId));

            socket.on("setPresenterOffer", (data) => this.signalingHandler.handleSetPresenterOffer(socket, data));
            socket.on("setViewerOffer", (data) => this.signalingHandler.handleSetViewerOffer(socket, data));
            socket.on("setPresenterCandidate", (data) => this.signalingHandler.handleSetPresenterCandidate(socket, data));
            socket.on("setViewerCandidate", (data) => this.signalingHandler.handleSetViewerCandidate(socket, data));
            socket.on("setMechanism", (data) => this.signalingHandler.handleSetMechanism(socket, data));
            socket.on("checkValidViewer", (id) => this.signalingHandler.handleCheckValidViewer(socket, id));
            socket.on('cursorPosition', (data) => {
                socket.broadcast.emit('cursorPosition', data);
            });

            // Debug logging for socket IDs
            console.log('New connection:', { 
                socketId: socket.id, 
                isPresenter: this.presenter.id === socket.id 
            });

            // Modified cursor handling
            socket.on('viewerCursorPosition', (data) => {
                socket.broadcast.emit('cursorPosition', data);
                // const presenterSocket = this.io.sockets.sockets.get(this.presenter?.id);
                
                // Debug logging
                // console.log('Cursor data received:', {
                //     from: socket.id,
                //     to: this.presenter?.id,
                //     presenterExists: !!presenterSocket,
                //     data
                // });

                // if (presenterSocket) {
                //     presenterSocket.emit('viewerCursor', data);
                // }
            });

            // Presenter broadcasts replicated cursor to all viewers
            socket.on('presenterCursorUpdate', (data) => {
                // Broadcast replicated cursor data to all viewers except sender
                socket.broadcast.emit('cursorPosition', {
                    ...data,
                    replicatedBy: 'presenter'
                });
            });
        });
    }
}

module.exports = SocketHandler;
