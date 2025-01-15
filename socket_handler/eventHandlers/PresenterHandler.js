class PresenterHandler {
    constructor(socketHandler) {
        this.socketHandler = socketHandler;
    }

    register(socket, fn) {
        if (this.socketHandler.presenter[socket.sessionId]) {
            if (typeof fn === 'function') fn(false);
            return;
        }

        console.log("register presenter " + socket.sessionId + " " + socket.id);
        this.socketHandler.presenter[socket.sessionId] = socket;
        this.socketHandler.presenter[socket.sessionId].viewers = {};
        this.socketHandler.presenter[socket.sessionId].parents = {};
        this.socketHandler.presenter[socket.sessionId].childs = {};
        this.socketHandler.presenter[socket.sessionId].maxConnection = 2;
        this.socketHandler.presenter[socket.sessionId].streamMechanism = "distributed";
        socket.isPresenter = true;

        this.notifyExistingViewers(socket);
        if (typeof fn === 'function') fn(true);
    }

    notifyExistingViewers(socket) {
        let existingViewers = [];
        Object.keys(this.socketHandler.viewers).forEach(id => {
            if (this.socketHandler.viewers[id].sessionId === socket.sessionId) {
                this.socketHandler.viewers[id].emit("presenterAvailable");
                existingViewers.push({ id: id });
            }
        });

        Object.keys(this.socketHandler.waitingViewers).forEach(id => {
            if (this.socketHandler.waitingViewers[id].sessionId === socket.sessionId) {
                this.socketHandler.waitingViewers[id].emit("presenterAvailable");
            }
        });
    }
}

module.exports = PresenterHandler;
