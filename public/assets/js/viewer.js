export default class viewer {

    constructor(options = {}) {
        this.played = false;
        this.isWaitingViewer = true;
        this.player = options.player;
        this.presenterStatus = 'offline';
        this.nodePort = window.location.port;
        this.socket = null;
        this.peerConnection = null;
        this.viewers = {};
        this.streams = null;
        this.isSharing = false;
        this.isConnected = false;
        this.iceServers = options.iceServers;
        this.webRtcPeer = null;
        this.autoPlay = false;
        this.serverUrl = `http://localhost:3096`; // Set default server URL
        this.init();
        this.initLocalCursor();
    }

    async init() {
        this.autoPlay = (new URLSearchParams(window.location.search)).get("auto");
        if (this.autoPlay === "1" || this.autoPlay === "true") {
            this.autoPlay = true;
        } else {
            this.autoPlay = false;
        }
        if (this.autoPlay) {
            this.player.muted = true;
        }

        // Use localhost:3096 as default server URL
        this.serverUrl = 'http://localhost:3096';
        
        await this.waitForSocketIO();
        this.registerNodeEvents();

        this.player.addEventListener('play', () => {
            this.played = true;
        });

        // Initialize socket connection
        try {
            // Make sure socket.io is available
            if (typeof io === 'undefined') {
                throw new Error('Socket.IO is not available');
            }

            console.log('Connecting to server:', this.serverUrl);
            await this.initializeSocket();
        } catch (err) {
            console.error('Socket initialization failed:', err);
            this.showConnectionError(`Connection failed: ${err.message}`);
            throw err;
        }
    }

    getServerUrl() {
        // Get the current protocol and host
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const port = window.location.port || (protocol === 'https:' ? '443' : '80');
        
        // Construct the server URL
        return `${protocol}//${hostname}:${port}`;
    }

    async initializeSocket() {
        return new Promise((resolve, reject) => {
            try {
                const sessionId = new URLSearchParams(window.location.search).get("session_id");
                console.log('Initializing socket with session:', sessionId);

                this.socket = io(this.serverUrl, {
                    query: {
                        mobile: this.mobileCheck(),
                        session_id: sessionId
                    },
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    transports: ['websocket', 'polling'],
                    rejectUnauthorized: false, // Allow self-signed certificates
                    timeout: 10000,
                    path: '/socket.io'
                });

                // Add connection logging
                console.log('Attempting to connect to:', this.serverUrl);

                // Add connection event handlers
                this.socket.on('connect', () => {
                    console.log('Socket connected successfully with ID:', this.socket.id);
                    this.isConnected = true;
                    this.clearConnectionError();
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    console.error('Socket connection error:', error);
                    this.showConnectionError('Connection error: ' + error.message);
                    reject(error);
                });

                // Initialize the rest of socket events
                this.setupSocketEvents();
            } catch (err) {
                console.error('Socket setup error:', err);
                reject(err);
            }
        });
    }

    clearConnectionError() {
        const errorDiv = document.querySelector('.connection-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    setupSocketEvents() {
        // Move your existing socket event handlers here
        // ...existing socket event handlers...
    }

    // Add helper method to wait for socket.io
    waitForSocketIO() {
        return new Promise((resolve, reject) => {
            if (typeof io !== 'undefined') {
                resolve();
                return;
            }

            const maxAttempts = 10;
            let attempts = 0;
            
            const checkIO = setInterval(() => {
                attempts++;
                if (typeof io !== 'undefined') {
                    clearInterval(checkIO);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkIO);
                    reject(new Error('Socket.IO failed to load'));
                }
            }, 500);
        });
    }

    emitCursorPosition(x, y, interactionType = 'default', videoInfo) {
        if (!this.socket || !this.socket.id) return;

        const cursorData = {
            x,  // Send normalized coordinates (0-1)
            y,
            cursorType: interactionType,
            userId: this.socket.id,
            timestamp: Date.now(),
            videoInfo,  // Include video dimensions and aspect ratio
            clicking: interactionType === 'clicking',
            dragging: interactionType === 'dragging'
        };

        this.socket.emit('cursorPosition', cursorData);
    }

    // Add this method to handle mouse events
    setupMouseEvents(element) {
        element.addEventListener('mousedown', () => {
            this.emitCursorPosition(this.lastX, this.lastY, 'clicking');
        });

        element.addEventListener('mouseup', () => {
            this.emitCursorPosition(this.lastX, this.lastY, 'default');
        });

        let isDragging = false;
        element.addEventListener('dragstart', () => {
            isDragging = true;
            this.emitCursorPosition(this.lastX, this.lastY, 'dragging');
        });

        element.addEventListener('dragend', () => {
            isDragging = false;
            this.emitCursorPosition(this.lastX, this.lastY, 'default');
        });
    }

    registerNodeEvents() {
        if (typeof io === 'undefined') {
            console.error('Socket.IO is not loaded');
            this.showConnectionError('Connection library failed to load');
            return;
        }

        let sessionId = (new URLSearchParams(window.location.search)).get("session_id");
        
        try {
            // Use the same serverUrl as initialized
            this.socket = io(this.serverUrl, {
                query: `mobile=${this.mobileCheck()}&session_id=${sessionId}`,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                rejectUnauthorized: false,
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            // Add better error logging
            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
                this.showConnectionError(`Connection failed: ${error.message}. Please check if the server is running on ${this.serverUrl}`);
            });

            this.socket.on('connect_timeout', () => {
                console.error('Socket connection timeout');
                this.showConnectionError('Connection timed out. Please try again.');
            });

            this.socket.on("connect", () => {
                this.isConnected = true;
                console.log('Viewer socket connected:', {
                    socketId: this.socket.id,
                    isConnected: this.isConnected
                });
                if (this.onSocketConnect) {
                    this.onSocketConnect();
                }
                this.regsiterWaitingViewer();
            });

            // Add cursor position receiver for debugging
            this.socket.on('cursorPosition', (data) => {
                console.log('Received cursor position:', data);
            });

            this.socket.on("disconnect", () => {
                this.isConnected = false;
                this.presenterStatus = 'offline';
                this.isSharing = false;
                this.onStatusChanged();
            })

            this.socket.on("presenterAvailable", () => {
                this.presenterStatus = 'online';
                this.onStatusChanged();
            });

            this.socket.on("presenterUnavailable", () => {
                this.presenterStatus = 'offline';
                this.isSharing = false;
                if (this.streams) {
                    this.streams[0].getTracks().forEach(track => {
                        track.enabled = false;
                    });
                }
                this.stop();
                this.regsiterWaitingViewer();
                this.onStatusChanged();
            });

            this.socket.on("sendPresenterOffer", async (data) => {
                console.log(data.offer.sdp);
                this.createPeerConnection();
                this.peerConnection.setRemoteDescription(data.offer);
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                this.socket.emit("setViewerOffer", { id: this.socket.id, offer: answer });
            });

            this.socket.on("sendPresenterCandidate", async (data) => {
                if (!this.peerConnection) {
                    setTimeout(() => {
                        this.peerConnection.addIceCandidate(data.candidate);
                    }, 1000);
                }
                else {
                    this.peerConnection.addIceCandidate(data.candidate);
                }
            });

            this.socket.on("senderCreatePeerConnection", (data) => {
                this.viewers[data.id] = data;
                this.viewers[data.id].senders = [];
                this.createPeerConnection(this.viewers[data.id]);
            });

            this.socket.on("sendViewerOffer", (data) => {
                if (!this.viewers[data.id]) {
                    setTimeout(() => {
                        this.viewers[data.id].peerConnection.setRemoteDescription(data.offer);
                    }, 1000);
                }
                else {
                    this.viewers[data.id].peerConnection.setRemoteDescription(data.offer);
                }
            });

            this.socket.on("sendViewerCandidate", (data) => {
                if (!this.viewers[data.id]) {
                    setTimeout(() => {
                        this.viewers[data.id].peerConnection.addIceCandidate(data.candidate);
                    }, 1000);
                }
                else {
                    this.viewers[data.id].peerConnection.addIceCandidate(data.candidate);
                }
            });

            this.socket.on("senderDisconnected", (data) => {
                if (data) {
                    this.socket.senderId = data.newSenderId;
                }
                else {
                    if (this.peerConnection) {
                        this.peerConnection.close();
                        this.peerConnection = null;
                    }
                    this.socket.senderId = null;
                }
                this.onStatusChanged();
            });

            this.socket.on("sharingStopped", () => {
                this.isSharing = false;
                if (this.streams) {
                    this.streams[0].getTracks().forEach(track => {
                        track.enabled = false;
                    });
                }
                this.stop();
                this.regsiterWaitingViewer();
                this.onStatusChanged();
            });

            this.socket.on("sharingStarted", () => {
                this.isSharing = true;
                if (this.streams) {
                    this.streams[0].getTracks().forEach(track => {
                        track.enabled = true;
                    });
                }
                this.onStatusChanged();
            });

            this.socket.on("message", (message) => {
                var parsedMessage = JSON.parse(message);

                switch (parsedMessage.id) {
                    case 'viewerResponse':
                        this.viewerResponse(parsedMessage);
                        break;
                    case 'stopCommunication':
                        this.dispose();
                        break;
                    case 'iceCandidate':
                        this.webRtcPeer.addIceCandidate(parsedMessage.candidate)
                        break;
                    default:
                        console.error('Unrecognized message', parsedMessage);
                }
            });
        } catch (err) {
            console.error('Failed to initialize socket:', err);
            this.showConnectionError('Failed to initialize connection: ' + err.message);
        }
    }

    showConnectionError(message) {
        const existingError = document.querySelector('.connection-error');
        if (!existingError) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'connection-error';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);
        }
    }

    registerViewer() {
        if (!this.isWaitingViewer) {
            return;
        }
        this.socket.emit("registerViewer", (data) => {
            this.streamMechanism = data.streamMechanism;
            this.isWaitingViewer = false;

            this.presenterStatus = 'online';
            this.isSharing = data.sharingStatus == "start";
            if (this.streamMechanism == 'streamserver') {
                this.viewer();
            }
            else {
                this.socket.senderId = data.senderId;
                this.autoConnect();
            }

            this.onStatusChanged();
        });
    };

    regsiterWaitingViewer() {
        this.isWaitingViewer = true;
        this.socket.emit("registerWaitingViewer", (data) => {
            if (data && data.presenterStatus == 'online') {
                this.presenterStatus = 'online';
            }
            else {
                this.presenterStatus = 'offline';
            }
            if (data && data.sharingStatus == 'start') {
                this.isSharing = true;
            }
            else {
                this.isSharing = false;
            }
            this.onStatusChanged();
        });
    }

    autoConnect() {
        setTimeout(() => {
            if (!this.played) {
                this.registerViewer();
            }
        }, 5000);
    }

    createPeerConnection(viewer) {
        if (this.streamMechanism == 'streamserver') {
            return;
        }
        if (!this.iceServers) {
            this.iceServers = [
                { urls: "stun:stun.l.google.com:19302" },
            ]
        }
        const pc = new RTCPeerConnection({
            sdpSemantics: "unified-plan",
            iceServers: this.iceServers
        });
        if (viewer) {
            viewer.peerConnection = pc;
            pc.onnegotiationneeded = async () => {
                const offer = await viewer.peerConnection.createOffer();
                await viewer.peerConnection.setLocalDescription(offer);
                this.socket.emit("setPresenterOffer", { id: viewer.id, offer: offer });
            };
        }
        else {
            this.peerConnection = pc;
        }

        pc.onicecandidate = (iceEvent) => {
            if (iceEvent && iceEvent.candidate) {
                this.socket.emit("setViewerCandidate", { id: viewer ? viewer.id : null, candidate: iceEvent.candidate });
            }
        };

        if (this.streams && viewer) {
            this.streams[0].getTracks().forEach(track => {
                viewer.senders.push(viewer.peerConnection.addTrack(track, this.streams[0]));
            });
        }

        pc.ontrack = async (event) => {
            if (viewer) {
                let sendersLength = viewer.senders.length;
                event.streams[0].getTracks().forEach(track => {
                    if (sendersLength) {
                        viewer.senders.find(sender => sender.track.kind === track.kind).replaceTrack(track);
                    }
                    else {
                        viewer.senders.push(viewer.peerConnection.addTrack(track, event.streams[0]));
                    }
                });
            }
            else {
                this.streams = event.streams;
                this.player.autoplay = true;
                this.player.muted = true;
                this.player.srcObject = event.streams[0];
                this.player.src = event.streams[0];
                Object.keys(this.viewers).forEach(id => {
                    if (!this.viewers[id].sharedStream && this.viewers[id].peerConnection) {
                        this.viewers[id].sharedStream = true;
                        this.viewers[id].senders = this.viewers[id].senders ? this.viewers[id].senders : [];
                        let sendersLength = this.viewers[id].senders.length;
                        event.streams[0].getTracks().forEach(track => {
                            if (sendersLength) {
                                this.viewers[id].senders.find(sender => sender.track.kind === track.kind).replaceTrack(track);
                            }
                            else {
                                this.viewers[id].senders.push(this.viewers[id].peerConnection.addTrack(track, event.streams[0]));
                            }
                        });
                    }
                });
            }
            this.onStatusChanged();
        };
    }

    onStatusChanged() {
    }

    mobileCheck() {
        let check = false;
        (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    };

    viewerResponse(message) {
        if (message.response != 'accepted') {
            var errorMsg = message.message ? message.message : 'Unknow error';
            console.warn('Call not accepted for the following reason: ' + errorMsg);
            this.dispose();
        }
        else {
            this.webRtcPeer.processAnswer(message.sdpAnswer);
        }
    }

    viewer() {
        if (!this.webRtcPeer) {
            if (!this.iceServers) {
                this.iceServers = [
                    { urls: "stun:stun1.l.google.com:1930" }
                ]
            }
            var options = {
                remoteVideo: document.getElementById('plrVideo'),
                onicecandidate: this.onIceCandidate.bind(this),
                configuration: {
                    iceServers: this.iceServers
                }
            }
            options.remoteVideo.autoplay = true;
            options.remoteVideo.muted = true;
            let _this = this;
            this.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
                if (error) return _this.onError(error);
                this.generateOffer(_this.onOfferViewer.bind(_this));
            });
        }
    }

    onOfferViewer(error, offerSdp) {
        if (error) return this.onError(error)

        var message = {
            id: 'viewer',
            sdpOffer: offerSdp
        }
        this.sendMessage(message);
    }

    onIceCandidate(candidate) {
        var message = {
            id: 'onIceCandidate',
            candidate: candidate
        }
        this.sendMessage(message);
    }

    stop() {
        if (this.webRtcPeer) {
            var message = {
                id: 'stop'
            }
            this.sendMessage(message);
            this.dispose();
        }
    }

    dispose() {
        if (this.webRtcPeer) {
            this.webRtcPeer.dispose();
            this.webRtcPeer = null;
        }
    }

    sendMessage(message) {
        var jsonMessage = JSON.stringify(message);
        this.socket.send(jsonMessage);
    }

    initLocalCursor() {
        // Each viewer handles their own cursor locally
        const screenArea = document.getElementById('viewerScreen');
        if (screenArea) {
            screenArea.style.cursor = 'default';
        }
    }
};