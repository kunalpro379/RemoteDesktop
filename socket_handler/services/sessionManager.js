class SessionManager {
    constructor() {
        this.presenter = {};
        this.viewers = {};
        this.waitingViewers = {};
    }

    unregisterViewer(socket) {
        // Initialize socket properties if they don't exist
        socket.parents = socket.parents || {};
        socket.childs = socket.childs || {};
        socket.viewers = socket.viewers || {};

        // Handle parent connections
        Object.keys(socket.parents).forEach(parent => {
            if (this.viewers[parent]) {
                delete this.viewers[parent].childs[socket.id];
            }
        });

        if (this.presenter && 
            this.presenter[socket.sessionId] && 
            this.presenter[socket.sessionId].parents && 
            this.presenter[socket.sessionId].parents[socket.id]) {
            delete this.presenter[socket.sessionId].parents[socket.id];
        }

        // Handle child connections
        Object.keys(socket.childs).forEach(child => {
            if (this.viewers[child]) {
                delete this.viewers[child].parents[socket.id];
            }
        });

        if (this.presenter && 
            this.presenter[socket.sessionId] && 
            this.presenter[socket.sessionId].childs && 
            this.presenter[socket.sessionId].childs[socket.id]) {
            delete this.presenter[socket.sessionId].childs[socket.id];
        }

        // Handle presenter viewers
        if (this.presenter && 
            this.presenter[socket.sessionId] && 
            this.presenter[socket.sessionId].viewers) {
            delete this.presenter[socket.sessionId].viewers[socket.id];
        }
        
        // Remove from viewers list
        delete this.viewers[socket.id];

        // Handle socket viewers
        if (socket.viewers) {
            Object.keys(socket.viewers).forEach(viewer => {
                try {
                    if (!this.viewers[viewer]) return;
                    
                    this.viewers[viewer].senderId = this.getSender(this.viewers[viewer].sessionId, this.viewers[viewer].id);
                    this.viewers[viewer].emit("senderDisconnected", { newSenderId: this.viewers[viewer].senderId });
                    
                    const sender = this.viewers[viewer].senderId != this.presenter[socket.sessionId].id ? 
                        this.viewers[this.viewers[viewer].senderId] : 
                        this.presenter[socket.sessionId];
                    
                    if (sender && sender.viewers) {
                        sender.viewers[viewer] = this.viewers[viewer];
                    }
                    
                    if (this.presenter && 
                        this.presenter[socket.sessionId] && 
                        typeof this.presenter[socket.sessionId].emit === 'function') {
                        this.presenter[socket.sessionId].emit("viewerRegistered", { 
                            id: viewer, 
                            sender: this.viewers[viewer].senderId 
                        });
                    }
                } catch (ex) {
                    console.error("Error handling viewer:", ex);
                }
            });
        }

        // Handle sender viewers
        if (socket.senderId && this.viewers[socket.senderId]) {
            if (!this.viewers[socket.senderId].viewers) {
                this.viewers[socket.senderId].viewers = {};
            }
            delete this.viewers[socket.senderId].viewers[socket.id];
        }

        console.log("unregister viewer " + socket.id);
        if (this.presenter && 
            this.presenter[socket.sessionId] && 
            typeof this.presenter[socket.sessionId].emit === 'function') {
            this.presenter[socket.sessionId].emit("viewerLeave", { id: socket.id });
        }
    }

    getSender(sessionId, id) {
        if (!this.presenter || !this.presenter[sessionId]) {
            return;
        }
        if (this.presenter[sessionId].streamMechanism == "peer") {
            return this.presenter[sessionId].id;
        }
        let viewerKeys = Object.keys(this.viewers);
        if (Object.keys(this.presenter[sessionId].viewers || {}).length < 2) {
            return this.presenter[sessionId].id;
        }
        let senderId = null;
        for (let idx = 0; idx < viewerKeys.length; idx++) {
            let viewer = this.viewers[viewerKeys[idx]];
            if (!viewer || 
                viewer.sessionId != sessionId || 
                viewer.disconnected || 
                viewer.isMobile == 'true' || 
                Object.keys(viewer.viewers || {}).length >= 2 || 
                (viewer.parents && viewer.parents[id]) || 
                (this.viewers[id] && viewer.senderId == this.viewers[id].senderId)) {
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
}

module.exports = SessionManager;