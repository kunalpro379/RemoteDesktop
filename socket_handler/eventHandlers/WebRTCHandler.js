class WebRTCHandler {
    constructor(kurentoManager, socketHandler) {
        this.kurentoManager = kurentoManager;
        this.socketHandler = socketHandler;
    }

    handleMessage(socket, message, sessionId) {
        const parsedMessage = JSON.parse(message);
        switch (parsedMessage.id) {
            case 'presenter':
                this.handlePresenter(socket, sessionId, parsedMessage);
                break;

            case 'viewer':
                this.handleViewer(socket, sessionId, parsedMessage);
                break;

            case 'stop':
                this.kurentoManager.stop(sessionId, socket, this.socketHandler.viewers);
                break;

            case 'onIceCandidate':
                this.kurentoManager.onIceCandidate(sessionId, parsedMessage.candidate, socket);
                break;

            default:
                socket.send(JSON.stringify({
                    id: 'error',
                    message: 'Invalid message ' + message
                }));
                break;
        }
    }

    handlePresenter(socket, sessionId, parsedMessage) {
        this.kurentoManager.startPresenter(sessionId, socket, parsedMessage.sdpOffer, (error, sdpAnswer) => {
            if (error) {
                return socket.send(JSON.stringify({
                    id: 'presenterResponse',
                    response: 'rejected',
                    message: error
                }));
            }
            socket.send(JSON.stringify({
                id: 'presenterResponse',
                response: 'accepted',
                sdpAnswer: sdpAnswer
            }));
        });
    }

    handleViewer(socket, sessionId, parsedMessage) {
        this.kurentoManager.startViewer(sessionId, socket, parsedMessage.sdpOffer, (error, sdpAnswer) => {
            if (error) {
                return socket.send(JSON.stringify({
                    id: 'viewerResponse',
                    response: 'rejected',
                    message: error
                }));
            }
            socket.send(JSON.stringify({
                id: 'viewerResponse',
                response: 'accepted',
                sdpAnswer: sdpAnswer
            }));
        }, this.socketHandler.viewers);
    }
}

module.exports = WebRTCHandler;
