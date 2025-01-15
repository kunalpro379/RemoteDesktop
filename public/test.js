const kurento = require('kurento-client');

class KurentoSessionManager {
    constructor(wsUri) {
        this.wsUri = wsUri;
        this.kurentoClient = null;
    }

    getKurentoClient(callback) {
        if (this.kurentoClient !== null) {
            return callback(null, this.kurentoClient);
        }

        kurento(this.wsUri, (error, kurentoClient) => {
            if (error) {
                console.log("Could not find media server at address " + this.wsUri);
                return callback("Could not find media server at address " + this.wsUri + ". Exiting with error " + error);
            }
            console.log("Kurento client connected");
            this.kurentoClient = kurentoClient;
            callback(null, this.kurentoClient);
        });
    }

    createPresenterSession(sessionId, socket, sdpOffer, callback) {
        this.getKurentoClient((error, kurentoClient) => {
            if (error) {
                return callback(error);
            }

            if (!stPresenter[socket.sessionId]) {
                return callback(stNoPresenterMessage);
            }

            kurentoClient.create('MediaPipeline', (error, pipeline) => {
                if (error) {
                    return callback(error);
                }

                if (!stPresenter[socket.sessionId]) {
                    return callback(stNoPresenterMessage);
                }

                stPresenter[socket.sessionId].pipeline = pipeline;
                socket.emit("streamserverPresenterAvailable");
socket.send(JSON.stringify({
    id: 'iceCandidate',
    candidate: candidate
}));
                pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
                    if (error) {
                        return callback(error);
                    }

                    if (!stPresenter[socket.sessionId]) {
                        return callback(stNoPresenterMessage);
                    }

                    stPresenter[socket.sessionId].webRtcEndpoint = webRtcEndpoint;
                    socket.webRtcEndpoint = webRtcEndpoint;

                    if (stCandidatesQueue[sessionId]) {
                        while (stCandidatesQueue[sessionId].length) {
                            const candidate = stCandidatesQueue[sessionId].shift();
                            webRtcEndpoint.addIceCandidate(candidate);
                        }
                    }

                    webRtcEndpoint.on('OnIceCandidate', (event) => {
                        const candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                        socket.send(JSON.stringify({
                            id: 'iceCandidate',
                            candidate: candidate
                        }));
                    });

                    webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
                        if (error) {
                            return callback(error);
                        }

                        if (!stPresenter[socket.sessionId]) {
                            return callback(stNoPresenterMessage);
                        }

                        callback(null, sdpAnswer);
                    });

                    webRtcEndpoint.gatherCandidates((error) => {
                        if (error) {
                            return callback(error);
                        }
                    });
                });
            });
        });
    }
}

module.exports = KurentoSessionManager;

const KurentoSessionManager = require('./test');
const kurentoSessionManager = new KurentoSessionManager('ws://' + kurentoIP + ':' + kurentoPort + '/kurento');

function startViewer(sessionId, socket, sdpOffer, callback) {
    if (!stPresenter[socket.sessionId]) {
        stop(sessionId, socket);
        return callback(stNoPresenterMessage);
    }

    kurentoSessionManager.getKurentoClient((error, kurentoClient) => {
        if (error) {
            stop(sessionId, socket);
            return callback(error);
        }

        kurentoSessionManager.createWebRtcEndpoint(stPresenter[socket.sessionId].pipeline, (error, webRtcEndpoint) => {
            if (error) {
                stop(sessionId, socket);
                return callback(error);
            }

            if (!viewers[socket.id]) {
                stop(sessionId, socket);
                return;
            }

            viewers[socket.id].webRtcEndpoint = webRtcEndpoint;

            if (!stPresenter[socket.sessionId]) {
                stop(sessionId, socket);
                return callback(stNoPresenterMessage);
            }

            kurentoSessionManager.addIceCandidatesFromQueue(sessionId, webRtcEndpoint, stCandidatesQueue);

            kurentoSessionManager.setupIceCandidateListener(webRtcEndpoint, socket);

            kurentoSessionManager.processOffer(webRtcEndpoint, sdpOffer, (error, sdpAnswer) => {
                if (error) {
                    stop(sessionId, socket);
                    return callback(error);
                }

                if (!stPresenter[socket.sessionId]) {
                    stop(sessionId, socket);
                    return callback(stNoPresenterMessage);
                }

                stPresenter[socket.sessionId].webRtcEndpoint.connect(webRtcEndpoint, (error) => {
                    if (error) {
                        stop(sessionId, socket);
                        return callback(error);
                    }

                    if (!stPresenter[socket.sessionId]) {
                        stop(sessionId, socket);
                        return callback(stNoPresenterMessage);
                    }

                    callback(null, sdpAnswer);

                    kurentoSessionManager.gatherCandidates(webRtcEndpoint, (error) => {
                        if (error) {
                            stop(sessionId, socket);
                            return callback(error);
                        }
                    });
                });
            });
        });
    });
}