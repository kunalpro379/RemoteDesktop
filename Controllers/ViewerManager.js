class ViewerManager {
    constructor() {
        this.viewers = {};
    }

    addViewer(socketId, viewerData) {
        this.viewers[socketId] = viewerData;
    }

    removeViewer(socketId) {
        if (this.viewers[socketId]) {
            this.viewers[socketId].webRtcEndpoint?.release();
            delete this.viewers[socketId];
        }
    }

    getViewer(socketId) {
        return this.viewers[socketId];
    }
}

module.exports = ViewerManager;
