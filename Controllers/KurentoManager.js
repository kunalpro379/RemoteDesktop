const KurentoClientManager = require('./KurentoClientManager');
const PresenterManager = require('./PresenterManager');
const ViewerManager = require('./ViewerManager');
const IceCandidateManager = require('./IceCandidateManager');

class KurentoManager {
    constructor(kurentoIP, kurentoPort) {
        this.clientManager = new KurentoClientManager(kurentoIP, kurentoPort);
        this.presenterManager = new PresenterManager();
        this.viewerManager = new ViewerManager();
        this.iceCandidateManager = new IceCandidateManager();
    }

    startPresenter(sessionId, socket, sdpOffer, callback) {
        // Clear candidate queue for this session
        this.iceCandidateManager.clearCandidates(sessionId);

        // Check if there's already an active presenter for this session
        if (this.presenterManager.hasPresenter(socket.sessionId)) {
            this.stop(sessionId, socket);
            return callback("Another user is currently acting as presenter. Try again later ...");
        }

        // Set the presenter for this session
        this.presenterManager.setPresenter(socket.sessionId, {
            id: sessionId,
            pipeline: null,
            webRtcEndpoint: null
        });

        socket.webRtcEndpoint = null;

        // Get the Kurento client
        this.clientManager.getKurentoClient((error, kurentoClient) => {
            if (error) {
                this.stop(sessionId, socket);
                return callback(error);
            }

            // Check if presenter has been removed
            if (!this.presenterManager.hasPresenter(socket.sessionId)) {
                this.stop(sessionId, socket);
                return callback(this.presenterManager.noPresenterMessage);
            }

            kurentoClient.create('MediaPipeline', (error, pipeline) => {
                if (error) {
                    this.stop(sessionId, socket);
                    return callback(error);
                }

                // Set the pipeline for this presenter
                this.presenterManager.getPresenter(socket.sessionId).pipeline = pipeline;
                socket.emit("streamserverPresenterAvailable");

                pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
                    if (error) {
                        this.stop(sessionId, socket);
                        return callback(error);
                    }

                    // Check if presenter has been removed again
                    if (!this.presenterManager.hasPresenter(socket.sessionId)) {
                        this.stop(sessionId, socket);
                        return callback(this.presenterManager.noPresenterMessage);
                    }

                    // Set the WebRTC endpoint for this presenter
                    this.presenterManager.getPresenter(socket.sessionId).webRtcEndpoint = webRtcEndpoint;
                    socket.webRtcEndpoint = webRtcEndpoint;

                    // Process ICE candidates if any
                    const candidates = this.iceCandidateManager.getCandidates(sessionId);
                    candidates.forEach(candidate => {
                        webRtcEndpoint.addIceCandidate(candidate);
                    });

                    // Listen for ICE candidates
                    webRtcEndpoint.on('OnIceCandidate', (event) => {
                        const candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                        socket.send(JSON.stringify({
                            id: 'iceCandidate',
                            candidate: candidate
                        }));
                    });

                    // Process SDP offer
                    webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
                        if (error) {
                            this.stop(sessionId, socket);
                            return callback(error);
                        }

                        if (!this.presenterManager.hasPresenter(socket.sessionId)) {
                            this.stop(sessionId, socket);
                            return callback(this.presenterManager.noPresenterMessage);
                        }

                        callback(null, sdpAnswer);
                    });

                    // Gather candidates
                    webRtcEndpoint.gatherCandidates((error) => {
                        if (error) {
                            this.stop(sessionId, socket);
                            return callback(error);
                        }
                    });
                });
            });
        });
    }

    startViewer(sessionId, socket, sdpOffer, callback) {
        // Check if there's an active presenter
        if (!this.presenterManager.hasPresenter(socket.sessionId)) {
            this.stop(sessionId, socket);
            return callback(this.presenterManager.noPresenterMessage);
        }

        // Get the presenter pipeline and create the WebRTC endpoint for viewer
        this.presenterManager.getPresenter(socket.sessionId).pipeline.create('WebRtcEndpoint', (error, webRtcEndpoint) => {
            if (error) {
                this.stop(sessionId, socket);
                return callback(error);
            }

            // Add the viewer to the viewers list
            this.viewerManager.addViewer(socket.id, { sessionId, webRtcEndpoint });

            // Check if presenter still exists
            if (!this.presenterManager.hasPresenter(socket.sessionId)) {
                this.stop(sessionId, socket);
                return callback(this.presenterManager.noPresenterMessage);
            }

            // Add ICE candidates from queue
            const candidates = this.iceCandidateManager.getCandidates(sessionId);
            candidates.forEach(candidate => {
                webRtcEndpoint.addIceCandidate(candidate);
            });

            // Listen for ICE candidates
            webRtcEndpoint.on('OnIceCandidate', (event) => {
                const candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                socket.send(JSON.stringify({
                    id: 'iceCandidate',
                    candidate: candidate
                }));
            });

            // Process SDP offer
            webRtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
                if (error) {
                    this.stop(sessionId, socket);
                    return callback(error);
                }

                if (!this.presenterManager.hasPresenter(socket.sessionId)) {
                    this.stop(sessionId, socket);
                    return callback(this.presenterManager.noPresenterMessage);
                }

                // Connect the viewer to the presenter
                this.presenterManager.getPresenter(socket.sessionId).webRtcEndpoint.connect(webRtcEndpoint, (error) => {
                    if (error) {
                        this.stop(sessionId, socket);
                        return callback(error);
                    }

                    if (!this.presenterManager.hasPresenter(socket.sessionId)) {
                        this.stop(sessionId, socket);
                        return callback(this.presenterManager.noPresenterMessage);
                    }

                    callback(null, sdpAnswer);

                    // Gather candidates for the viewer
                    webRtcEndpoint.gatherCandidates((error) => {
                        if (error) {
                            this.stop(sessionId, socket);
                            return callback(error);
                        }
                    });
                });
            });
        });
    }

    stop(sessionId, socket) {
        // If the socket is a presenter, notify all viewers
        if (socket.isPresenter) {
            Object.keys(this.viewerManager.viewers).forEach(id => {
                const viewer = this.viewerManager.getViewer(id);
                if (viewer && viewer.sessionId === socket.sessionId) {
                    viewer.send(JSON.stringify({ id: 'stopCommunication' }));
                    viewer.webRtcEndpoint?.release();
                }
            });

            // Release the presenter pipeline
            if (this.presenterManager.hasPresenter(socket.sessionId)) {
                const presenter = this.presenterManager.getPresenter(socket.sessionId);
                presenter.pipeline.release();
                this.presenterManager.removePresenter(socket.sessionId);
            }
        } else if (this.viewerManager.viewers[socket.id]) {
            const viewer = this.viewerManager.getViewer(socket.id);
            viewer.webRtcEndpoint?.release();
            this.viewerManager.removeViewer(socket.id);
        }

        // Clear the candidate queue for this session
        this.iceCandidateManager.clearCandidates(sessionId);
    }

    onIceCandidate(sessionId, candidate, socket) {
        // Handle the ICE candidates and add to the candidate manager
        const kurentoCandidate = kurento.getComplexType('IceCandidate')(candidate);
        if (socket.isPresenter || socket.isViewer) {
            socket.webRtcEndpoint.addIceCandidate(kurentoCandidate);
        } else {
            this.iceCandidateManager.addCandidate(sessionId, kurentoCandidate);
        }
    }
}

module.exports = KurentoManager;
