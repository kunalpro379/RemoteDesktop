// Move the existing Host class implementation here without changes
export default class Host {
    constructor(options = {}) {
        this.sharingStream = {};
        this.sharingOptions = {
            mechanism: 'distributed',
            maxFrameRate: 20,
            microphone: 'muted',
            screenSize: [800, 600],
        };
        this.socket = null;
        this.nodePort = window.location.port;
        this.peerConnection = null;
        this.controllers = {};
        this.isConnected = false;
        this.iceServers = options.iceServers;
        if (options.mechanism) {
            this.sharingOptions.mechanism = options.mechanism;
        }
        this.validPresenter = true;
        this.status = {};
        this.webRtcPeer = null;
        this.init();
    }

    init() {
        this.registerNodeEvents();
    }

    registerNodeEvents() {
        let sessionId = (new URLSearchParams(window.location.search)).get("session_id");
        this.socket = io(window.location.origin, {
            query: { session_id: sessionId }
        });

        this.socket.on("connect", () => {
            this.viewers = {};
            this.socket.emit("registerHost", (result) => {
                this.socket.emit("setMechanism", this.sharingOptions.mechanism);
                if (!result) {
                this.socket.emit("setMechanism", this.sharingOptions.mechanism);
                if(!result){
                    this.validHost=false;
                    console.error("Another presenter running");
                    this.onStatusChanged();
                    return;
                }if(this.status.pauseonDisconnect){
                    let tracks=this.getTracks();
                        if(tracks[0]){
                            this.statusOnDisconnect=false;
                            tracks[0].enabled=true;
                            this.socket.emit("HostStartSharing");
                        }
                    }this.isConnected = true;
                    this.onStatusChanged();
                }
            });
        
        });

        this.socket.on("disconnect", ()=>{
            this.isConnected=false;
            let tracks=this.getTracks();
            if(tracks[0]){
                if(tracks[0].enabled){
                    this.status.pauseOnDisconnect=true;
                    tracks[0].enabled=false;
                }
            }this.onStatusChanged();
        });
        this.socket.on("sendExistingControllers", (controllers)=>{
            if(this.sharingOptions.mechanism=="streamserver")return;
            controllers.forEach(controller => {
                this.controllers[controller.id] = controller;
                this.createPeerConnection(controller);
            });
            this.onStatusChanged();
        });
        this.socket.on("controllerRegistered", (controller)=>{
            this.controllers[controller.id]=controller;//add controller to controllers
            if(this.sharingOptions.mechanism=='streamserver'){
                this.onStatusChanged();
                return;
            }
            if(controller.sender==this.socket.id){
                this.createPeerConnection(controller);
            }
            else{
                this.socket.emit("senderCreatePeerConnection", {
                    controller: controller.id, 
                    sender:controller.sender
                });
            }this.onStatusChanged();

        });
        this.socket.on("controllerLeave", (controller)=>{
            delete this.controllers[controller.id];
            this.onStatusChanged();
        });
        this.socket.on("sendcontrollerOffer", (data)=>{
            if(this.sharingOptions.mechanism=='streamserver')return;
            // this.controllers[data.id].peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            this.controllers[data.id].peerConnection.setRemoteDescription(data.offer);

        });
        this.socket.on("sendcontrollerCandidate", (data)=>{
            if(this.sharingOptions.mechanism=='streamserver')return;
            this.controllers[data.id].peerConnection.addIceCandidate(data.candidate);
        });
        this.socket.on("streamserverPresenterAvailable", ()=>{
            this.socket.emit("hostStartSharing");
        });

        this.socket.on("message", (message)=>{
            var parsedMessage=JSON.parse(message);
            switch (parsedMessage.id) {
                case 'hostResponse':
                    this.presenterResponse(parsedMessage);
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
    }

        async startSharing(options, startEvent, stopEvent, failedEvent) {
            if(!options){
                options={};
            }
            if(options.screenSize){
                options.screenSize=options.screenSize.split('*');
            }
            this.sharingOptions={...this.sharingOptions, ...options};//merge options
            let displayMediaOptions={
                video:{
                    width: { max: this.sharingOptions.screenSize[0] },
                    height: { max: this.sharingOptions.screenSize[1] },
                    frameRate: {
                        max: this.sharingOptions.maxFrameRate
                    }
                },
                audio: true
            };
            let audioMediaOptions={
                audio: true,
                video: false
            };
            try {
                this.sharingStream.display = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            } catch (error) {
                if(failedEvent)failedEvent.call(error.toString());
                console.error("Error accessing display media", error);
                this.socket.emit("hostStopSharing");
                this.stop();
                return false;
            }
            if(!this.sharingOptions.display){
                failedEvent.call("Display media not available");
                this.socket.emit("hostStopSharing");
                this.stop();
                return false;
            }
            try{
                this.sharingStream.audio=await navigator.mediaDevices.getUserMedia(audioMediaOptions);
            }
            catch (err) {
                console.error("Error accessing audio media", err);
                this.socket.emit("hostStopSharing");
                this.stop();
                return false;
            }if (startEvent) {
                startEvent.call();
            }
            let tracks = this.getTracks();
            tracks.forEach(track => {
                if(track.kind=="video"){
                    track.addEventListener('ended', ()=>{
                        Object.keys(this.controllers).forEach(id=>{
                            this.controllers[id].sharedStream=false;//set shared stream to false    
                        });
                        let tracks=this.getTracks();
                        tracks.forEach(track=>{
                            if(track.kind=='audio'){
                                track.enabled=false;
                                track.stop();
                            }

                        });
                        this.sharingStream.display=null;
                        this.sharingStream.audio=null;
                        this.socket.emit("hostStopSharing");
                        if(stopEvent){
                            stopEvent.call();
                        }this.stop();
                    });
                }
            });
            if (this.sharingOptions.mechanism == 'streamserver') {
                this.Host();
            }
            else{
                // this.socket.emit("hostStartSharing");
                Object.keys(this.controllers).forEach(id=>{
                    if(!this.controllers[id].sharedStream && this.controllers[id].peerConnection){
                        this.controllers[id].sharedStream=true;
                        this.controllers[id].senders=this.controllers[id].senders?this.controllers[id].senders:[];//if senders not present create empty array   
                        let sendersLength=this.controllers[id].senders.length;
                        tracks.forEach(track=>{
                            if(sendersLength) this.controllers[id].senders.find(
                                sender=>sender.track.kind===track.kind
                            ).replaceTrack(track);
                            else this.controllers[id],senders.push(this.controllers[id].peerConnection.addTrack(track, this.sharingStream.display));
                        });
                    }
                });
                this.socket.emit("presenterStartSharing");

            }
            this.onStatusChanged();
            return true;

        }

        async stopSharing(stopEvent) {
            Object.keys(this.controllers).forEach(id=>{
                this.contrllers[id].sharedStream=false;
            });
            if(!this.sharingStream.display)return;
            let tracks=this.getTracks();
            tracks.forEach(track=>{
                track.enabled=false;
                track.stop();
            });
            this.sharingStream.display=null;
            if(stopEvent){
                stopEvent.call();
            }
            this.stop();
            this.socket.emit("hostStopSharing");
            this.onStatusChanged();
        }

    getTracks() {
        if (!this.sharingStream.display) {
            return [];
        }
        let tracks = [];
        if (!this.sharingStream.audio) {
            tracks = this.sharingStream.display.getTracks();
        }
        else {
            tracks = new MediaStream([this.sharingStream.audio.getTracks()[0], this.sharingStream.display.getTracks()[0]]).getTracks();
        }
        if (this.sharingOptions.microphone == "muted") {
            tracks.forEach(track => {
                if (track.kind == "audio") {
                    track.enabled = false;
                }
            });
        }
        return tracks;
    }
    setOptions(options = {}) {
        let tracks = this.getTracks();
        tracks.forEach(track => {
            if (track.kind == "audio") {
                track.enabled = options.microphone != "muted";
            }
        });
    }
        createPeerConnection(viewer) {
            if(this.sharingOptions.mechanism=='streamserver')return;
            if(!this.iceServers){
                this.iceServers=[{
                    urls:"stun:stun.l.google.com:19302"
                }];

            }
            const pc = new RTCPeerConnection({
                sdpSemantics: "unified-plan",
                iceServers: this.iceServers
            });
            pc.onnegotiationneeded=async()=>{
                // this.setCodecPreferences(pc, this.sharingOptions.codecs);
                const offer=await this.controllers.peerConnection.createOffer();
                await controller.peerConnection.setLocalDescription(offer);
                this.socket.emit("setHostOffer",{
                    id: controller.id, 
                    offer: offer
                });
            }
            pc.onicecandidate=(iceEvent)=>{
                if(iceEvent&&iceEvent.candidate){
                    this.socket.emit("setHostCandidate", {
                        id: viewer.id,
                        candidate: iceEvent.candidate
                    });
                }
            }
            controller.sharedStream=false;
            controller.senders=[];
            if(this.sharingStream.display){
                controller.sharedStream=true;
                let tracks=this.getTracks();
                tracks.forEach(track=>{
                    controller.senders.push(pc.addTrack(track, this.sharingStream.display));
                });
            }
            controller.peerConnection=pc;
        }
        async setCodecPreferences(pc, codecs) {
            const capabilityCodecs=RTCRtpSender.getCapabilities('video').codecs;
            let preferredCodecs=[]; 
            let otherCodecs=[];
            for(let i=0;i<capabilityCodecs.length;i++){
                const mimeType=capabilityCodecs[i].mimeType;
                let isPreferred=false;
                for(let j=0;j<codecs.length;j++){
                    if(mimeType.includes(codecs[j])){
                        isPreferred=true;
                        break;
                    }
                }
                if(isPreferred)preferredCodecs.push(capabilityCodecs[i]);
                else otherCodecs.push(capabilityCodecs[i]);
            }
            let finalCodecs=[...preferredCodecs, ...otherCodecs];
            const transceivers=pc.getTransceivers();
            transceivers.forEach(transceiver=>{
                if(transceiver.sender.track.kind=='video'){
                    transceiver.setCodecPreferences(finalCodecs);
                }
            });
        }


        setMechanism(mechanism) {
            this.socket.emit("setMechanism", mechanism);
        }
        onStatusChanged() {}
        hostResponse(message) {
            if (message.response != 'accepted') {
                var errorMsg = message.message ? message.message : 'Unknow error';
                console.warn('Call not accepted for the following reason: ' + errorMsg);
                this.dispose();
            }
            else {
                this.webRtcPeer.processAnswer(message.sdpAnswer);
            }
        }
        Host() {
            if (!this.webRtcPeer) {
                if(!this.iceServers){
                    this.iceServers=[{
                        urls:"stun:stun.l.google.com:19302"
                    }];
                }var options={
                    videoStream: this.sharingStream.display,
                    audioStream: this.sharingStream.audio,
                    onicecandidate: this.onIceCandidate.bind(this),
                    configuration: {
                        iceServers: this.iceServers
                    }
                }
                let _this=this;
                this.webRtcPeer=kurentoUtils.webRtcPeer.WrbRtcPeerSendonly(options, function(error){
                    if(error)return _this.onError(error);
                    this.generateOffer();
                });

            }
        }
        onOfferHost(error, offerSdp) {
            if(error)return this.onError(error);
            var message={
                id: 'host',
                sdpAnswer: offerSdp
            }
            this.sendMessage(message);
        }
        onIceCandidate(candidate) {
            var message={
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

    }

