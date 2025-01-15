const PresenterHandler = require('./eventHandlers/PresenterHandler');
const ViewerHandler = require('./eventHandlers/ViewerHandler');
const WebRTCHandler = require('./eventHandlers/WebRTCHandler');
const StreamingControlHandler = require('./eventHandlers/StreamMechanismHandler');
const DisconnectHandler = require('./eventHandlers/DisconnectHandler');

class SocketEventHandlers {
    constructor(io, kurentoManager, socketHandler) {
        this.io = io;
        this.kurentoManager = kurentoManager;
        this.socketHandler = socketHandler;
        this.handlers = this.initializeHandlers();
    }

    initializeHandlers() {
        return {
            // Presenter handlers
            registerPresenter: (socket, fn) => new PresenterHandler(this.socketHandler).register(socket, fn),

            // Viewer handlers
            registerWaitingViewer: (socket, fn) => new ViewerHandler(this.socketHandler).registerWaitingViewer(socket, fn),
            registerViewer: (socket, fn) => new ViewerHandler(this.socketHandler).registerViewer(socket, fn),

            // WebRTC signaling handlers
            handleMessage: (socket, message, sessionId) => new WebRTCHandler(this.kurentoManager, this.socketHandler).handleMessage(socket, message, sessionId),

            // Streaming control handlers
            presenterStopSharing: (socket, sessionId) => new StreamingControlHandler(this.socketHandler).stopSharing(socket, sessionId),
            presenterStartSharing: (socket) => new StreamingControlHandler(this.socketHandler).startSharing(socket),

            // Disconnect handler
            handleDisconnect: (socket, sessionId) => new DisconnectHandler(this.kurentoManager, this.socketHandler).handle(socket, sessionId)



        };
    }
}

module.exports = SocketEventHandlers;
