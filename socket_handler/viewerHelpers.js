// ViewerHelper.js
class ViewerHelper {
    constructor(presenter, viewers) {
        this.presenter = presenter;
        this.viewers = viewers;
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
}

module.exports = ViewerHelper;
