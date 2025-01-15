class DisconnectHandler {
    constructor(kurentoManager, socketHandler) {
        this.kurentoManager = kurentoManager;
        this.socketHandler = socketHandler;
    }

    handle(socket, sessionId) {
        this.kurentoManager.stop(sessionId, socket);
        if (socket.isPresenter) {
            console.log("unregister presenter " + socket.sessionId + " " + socket.id);
            delete this.socketHandler.presenter[socket.sessionId];
            this.notifyViewerDisconnection(socket);
        }

        if (socket.isViewer) {
            this.socketHandler.unregisterViewer(socket);
        }
    }

    notifyViewerDisconnection(socket) {
        Object.keys(this.socketHandler.viewers).forEach(id => {
            if (this.socketHandler.viewers[id].sessionId === socket.sessionId) {
                this.socketHandler.viewers[id].emit("presenterUnavailable");
            }
        });

        Object.keys(this.socketHandler.waitingViewers).forEach(id => {
            if (this.socketHandler.waitingViewers[id].sessionId === socket.sessionId) {
                this.socketHandler.waitingViewers[id].emit("presenterUnavailable");
            }
        });

        Object.keys(socket.viewers).forEach(id => {
            socket.viewers[id].emit("senderDisconnected");
        });
    }
}

module.exports = DisconnectHandler;
