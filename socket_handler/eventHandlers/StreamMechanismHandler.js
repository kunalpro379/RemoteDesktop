class StreamingControlHandler {
    constructor(socketHandler) {
        this.socketHandler = socketHandler;
    }

    stopSharing(socket, sessionId) {
        if (!this.socketHandler.presenter[socket.sessionId]) return;

        this.socketHandler.presenter[socket.sessionId].sharingStatus = "stop";
        this.notifyViewers(socket, "sharingStopped");
        this.socketHandler.kurentoManager.stop(sessionId, socket);
    }

    startSharing(socket) {
        if (this.socketHandler.presenter[socket.sessionId]) {
            this.socketHandler.presenter[socket.sessionId].sharingStatus = "start";
        }

        this.notifyViewers(socket, "sharingStarted");

        for (let id in socket.viewers) {
            socket.viewers[id].emit("senderStartPlaying");
        }
    }
    setMechanism(socket, data) {
        if (socket.isPresenter) {
            socket.streamMechanism = data;
        }
    }

    notifyViewers(socket, event) {
        Object.keys(this.socketHandler.viewers).forEach(id => {
            if (this.socketHandler.viewers[id].sessionId === socket.sessionId) {
                this.socketHandler.viewers[id].emit(event);
            }
        });

        Object.keys(this.socketHandler.waitingViewers).forEach(id => {
            if (this.socketHandler.waitingViewers[id].sessionId === socket.sessionId) {
                this.socketHandler.waitingViewers[id].emit(event);
            }
        });
    }
}

module.exports = StreamingControlHandler;
