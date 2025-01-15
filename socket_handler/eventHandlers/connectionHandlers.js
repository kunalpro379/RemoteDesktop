class ConnectionHandlers {
    constructor(sessionManager, kurentoManager) {
        this.sessionManager = sessionManager;
        this.kurentoManager = kurentoManager;
    }

    async registerPresenter(socket, fn) {
        socket.isPresenter = true;
        this.sessionManager.presenter[socket.sessionId] = socket;
        this.sessionManager.presenter[socket.sessionId].viewers = {};
        this.sessionManager.presenter[socket.sessionId].childs = {};
        this.sessionManager.presenter[socket.sessionId].parents = {};
        fn(true);
    }

    async registerWaitingViewer(socket, fn) {
        this.sessionManager.waitingViewers[socket.id] = socket;
        fn(true);
    }

    async registerViewer(socket, fn) {
        socket.viewers = {};
        socket.childs = {};
        socket.parents = {};
        this.sessionManager.viewers[socket.id] = socket;
        socket.senderId = this.sessionManager.getSender(socket.sessionId, socket.id);
        
        if (socket.senderId != this.sessionManager.presenter[socket.sessionId].id) {
            this.sessionManager.viewers[socket.senderId].viewers[socket.id] = socket;
        } else {
            this.sessionManager.presenter[socket.sessionId].viewers[socket.id] = socket;
        }
        
        fn({ id: socket.id, senderId: socket.senderId });
        
        if (this.sessionManager.presenter && this.sessionManager.presenter[socket.sessionId]) {
            this.sessionManager.presenter[socket.sessionId].emit("viewerRegistered", { 
                id: socket.id, 
                sender: socket.senderId 
            });
        }
    }

    handleDisconnect(socket, sessionId) {
        if (socket.isPresenter) {
            delete this.sessionManager.presenter[socket.sessionId];
            Object.keys(this.sessionManager.viewers)
                .filter(key => this.sessionManager.viewers[key].sessionId === socket.sessionId)
                .forEach(key => {
                    this.sessionManager.viewers[key].emit("presenterLeft");
                });
        } else {
            this.sessionManager.unregisterViewer(socket);
        }
    }
}

module.exports = ConnectionHandlers;