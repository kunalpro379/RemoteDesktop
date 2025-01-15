// eventHandlers/SignalingHandler.js

class SignalingHandler {
    constructor(socketHandler) {
        this.socketHandler = socketHandler;
    }

    // Handle setting the presenter offer
    handleSetPresenterOffer(socket, data) {
        if (!this.socketHandler.viewers[data.id]) return;
        this.socketHandler.viewers[data.id].emit("sendPresenterOffer", { offer: data.offer });
    }

    // Handle setting the viewer offer
    handleSetViewerOffer(socket, data) {
        if (socket.senderId && this.socketHandler.viewers[socket.senderId]) {
            this.socketHandler.viewers[socket.senderId].emit("sendViewerOffer", {
                id: socket.id,
                offer: data.offer
            });
        } else {
            if (this.socketHandler.presenter && this.socketHandler.presenter[socket.sessionId]) {
                this.socketHandler.presenter[socket.sessionId].emit("sendViewerOffer", {
                    id: socket.id,
                    offer: data.offer
                });
            }
        }
    }

    // Handle setting the presenter candidate
    handleSetPresenterCandidate(socket, data) {
        if (!this.socketHandler.viewers[data.id]) return;
        this.socketHandler.viewers[data.id].emit("sendPresenterCandidate", {
            candidate: data.candidate
        });
    }

    // Handle setting the viewer candidate
    handleSetViewerCandidate(socket, data) {
        if (!this.socketHandler.presenter || !this.socketHandler.presenter[socket.sessionId]) return;

        if (data.id) {
            if (this.socketHandler.viewers[data.id]) {
                this.socketHandler.viewers[data.id].emit("sendPresenterCandidate", {
                    candidate: data.candidate
                });
            }
        } else {
            if (socket.senderId !== this.socketHandler.presenter[socket.sessionId].id) {
                if (this.socketHandler.viewers[socket.senderId]) {
                    this.socketHandler.viewers[socket.senderId].emit("sendViewerCandidate", {
                        id: socket.id,
                        candidate: data.candidate
                    });
                }
            } else {
                this.socketHandler.presenter[socket.sessionId].emit("sendViewerCandidate", {
                    id: socket.id,
                    candidate: data.candidate
                });
            }
        }
    }

    // Handle setting the stream mechanism
    handleSetMechanism(socket, data) {
        if (!socket.isPresenter) return;
        socket.streamMechanism = data;
    }

    // Handle checking if a viewer is valid
    handleCheckValidViewer(socket, id) {
        socket.emit("checkValidViewerResponse", {
            id: id,
            isValid: this.socketHandler.viewers[id] != null,
            sender: this.socketHandler.viewers[id] != null ? this.socketHandler.viewers[id].senderId : null
        });
    }
}

module.exports = SignalingHandler;
