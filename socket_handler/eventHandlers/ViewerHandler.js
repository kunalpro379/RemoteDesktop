class ViewerHandler {
    constructor(socketHandler) {
        this.socketHandler = socketHandler;
    }

    registerWaitingViewer(socket, fn) {
        console.log("register waiting viewer " + socket.sessionId + " " + socket.id);
        if (this.socketHandler.viewers[socket.id]) {
            this.socketHandler.unregisterViewer(socket);
        }

        this.socketHandler.waitingViewers[socket.id] = socket;
        if (typeof fn === 'function') {
            fn({
                presenterStatus: this.socketHandler.presenter && this.socketHandler.presenter[socket.sessionId] ? 'online' : 'offline',
                sharingStatus: this.socketHandler.presenter && this.socketHandler.presenter[socket.sessionId] ?
                    this.socketHandler.presenter[socket.sessionId].sharingStatus : 'stop'
            });
        }
    }

    registerViewer(socket, fn) {
        console.log("register viewer " + socket.sessionId + " " + socket.id);
        delete this.socketHandler.waitingViewers[socket.id];
        this.socketHandler.viewers[socket.id] = socket;
        socket.isViewer = true;
        socket.viewers = {};
        socket.parents = {};
        socket.childs = {};

        if (!this.socketHandler.presenter || !this.socketHandler.presenter[socket.sessionId]) {
            socket.waitingPresenter = true;
            return;
        }

        socket.senderId = this.socketHandler.getSender(socket.sessionId, socket.id);
        let sender = this.socketHandler.viewers[socket.senderId] ?
            this.socketHandler.viewers[socket.senderId] :
            this.socketHandler.presenter[socket.sessionId];

        sender.viewers[socket.id] = socket;
        sender.childs[socket.id] = true;

        this.notifyParents(sender, socket);
        this.notifyViewerRegistered(socket);

        if (typeof fn === 'function') {
            fn({
                senderId: socket.senderId,
                sharingStatus: this.socketHandler.presenter[socket.sessionId].sharingStatus,
                streamMechanism: this.socketHandler.presenter && this.socketHandler.presenter[socket.sessionId] ? 
                    this.socketHandler.presenter[socket.sessionId].streamMechanism : null
            });
        }
    }

    notifyParents(sender, socket) {
        Object.keys(sender.parents).forEach(parent => {
            if (this.socketHandler.viewers[parent]) {
                this.socketHandler.viewers[parent].childs[socket.id] = true;
            }
        });
    }

    notifyViewerRegistered(socket) {
        if (this.socketHandler.presenter && this.socketHandler.presenter[socket.sessionId]) {
            this.socketHandler.presenter[socket.sessionId].emit("viewerRegistered", { 
                id: socket.id, 
                sender: socket.senderId 
            });
        }
    }
}

module.exports = ViewerHandler;
