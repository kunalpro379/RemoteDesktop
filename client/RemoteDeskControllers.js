import { query } from "express";

export default class Controller{
    constructor(optionns={}){
        this.played = false;
        this.isWaitingController=true;
        this.player=optionns.player;
        this.HostStatus='offline';
        this.nodePort=window.location.port;
        this.socket=null;
        this.peerConnection=null;
        this.controllers={};
        this.streams=null;
        this.isSharing=false;
        this.isConnected=false;
        this.iceServers=optionns.iceServers;
        this.webRtcPeer=null;
        this.autoPlay=false;
        this.init();

        
    }
    async init(){
        this.autoPlay = (new URLSearchParams(window.location.search)).get("auto");
    if (this.autoPlay === "1" || this.autoPlay === "true") {
        this.autoPlay = true;
    }
    else {
        this.autoPlay = false;
    }
    if (this.autoPlay) {
        this.player.muted = true;
    }
    var script = document.createElement('script');
    script.setAttribute("src", window.location.protocol + "//" + window.location.hostname + ":" + this.nodePort + "/socket.io/socket.io.js");
    script.onload-('play',()=>{
        this.played=true;
    }  );
    document.head.appendChild(script);
    }
    
    registerNodeEvents(){
        let sessionId = (new URLSearchParams(window.location.search)).get("session_id");
        this.socket=this.isConnected.connect(window.location.protocol+'//'+window.location.hostname+':'+this.nodePort,{query:"mobile="+this.mobileCheck()+"&session_id="+sessionId});
        this.socket.on("connect",()=>{
            this.isConnected=true;
            this.registerWaitingControllers();
        });
        this.socket.on("disconnect",()=>{
            this.isConnected=true;
            this.HostStatus='offline';
            this.isSharing=false;
            this.onStatusChanged();
        });
        this.socket.on("hostUnavailable",()=>{
            this.HostStatus='offline';
            this.isSharing=false;
            if(this.streams){
                this.streams[0].getTracks().forEach(track=>{
                    track.enabled=false;
                });//stoppingnthe stream and removing the audio video treacks from stream
            }this.stop();
            this.registerWaitingControllers();
            this.onStatusChanged();
        });
        this.socket,on("sendHostOffer", async (data)=>{
            console.log(data.offer.sdp);//sdp offer
            this.createPeerConnection();//create new WebRTC peer connectn
            //setting Hosts Offer
            this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            //create answer
            const answer=await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.socket.emit("setHostOffer", {
                id: this.socket.id,
                offer: answer
            });
        });
            this.socket.on("sendHostCandidate", async(data)=>{
                if(!this.peerConnection){
                    setTimeout(() => {
                        this.peerConnection.addIceCandidate(data.candidate);
                    }, 1000);
                }else{
                    this.peerConnection.addIceCandidate(data.candidate);
                }
                this.socket.on('senderCreatePeerConnection', (data)=>{
                    this.controllers[data.id]=data;
                    this.controllers[data.id].senders=[];
                    this.createPeerConnection(this.controllers[data.id]);
                });

                this.socket.on('sendControllerOffer', (data)=>{
                    if(!this.controllers[data.id]){
                        setTimeout(() => {
                            this.controllers[data.id].peerConnection.setRemoteDescription(data.offer);
                        }, 1000);
                    }
                    else {
                        this.controllers[data.id].peerConnection.setRemoteDescription(data.offer);
                    }
                });
                this.socket.on('sendControllerCandidate', (data)=>{
                    if(!this.controllers[data.id]){
                        setTimeout(() => {
                            this.controllers[data.id].peerConnection.addIceCandidate(data.candidate);
                        }, 1000);
                    }
                    else {
                        this.controllers[data.id].peerConnection.addIceCandidate(data.candidate);
                    }
                });
                this.socket.on('senderDisconnected', (data)=>{
                    if(data)this.socket.senderId=data.newSenderId;
                    else{
                        if(this.peerConnection){
                            this.peerConnection.close();
                            this.peerConnection=null;
                        }this.socket.senderId=null;
                    }this.onStatusChanged();
                });
                this.socket.on('sharingStopped',()=>{
                    this.isSharing=false;
                    if(this.streams){
                        this.streams[0].getTracks().forEach(track=>{
                            track.enabled=false;
                        });
                    }
                    this.stop();
                    this.registerWaitingController();
                    this.onStatusChanged();

                });

                this.socket.on('sharingStarted',()=>{
                    this.isSharing=true;
                    if(this.streams){
                        this.streams[0].getTracks().forEach(track => {
                            track.enabled = true;
                        });
                    }
                    this.onStatusChanged();
                });

                this.socket.on('message',(message)=>{
                    var parsedMessage=JSON.parse(message);
                    switch(parsedMessage.id){
                        case 'controllerResponse':
                            this.controllerResponse(parsedMessage);
                            break;
                        case 'stopCommunication':
                            this.dispose();
                            break;
                        case 'iceCandidate':
                            this.webRtcPeer.addIceCandidate(parsedMessage.candidate);
                            break;    
                        default:
                            console.error('Unrecognized message',parsedMessage);
                    }
                });
            

            });
            

    }
    registerController() {
        if(!this.isWaitingController)return;

        this.socket.emit('registerController',(data)=>{
            this.streamMechanism=data.streamMechanism;
            this.isWaitingController=false;
            this.HostStatus='online';
            this.isSharing=data.sharingStatus=="start";
            if(this.streamMechanism=='streamserver') this.viewer();
            else{
                this.socket.senderId=data.senderId;
                this.autoConnect();
            }
            this.onStatusChanged();

        });
    }
    registerWaitingControllers(){
        this.isWaitingController=true;
        this.socket.emit('registerWaitingController', (data)=>{
            if(data&&data.hostStatus=='online'){
                this.HostStatus='online';
            }else{
                this.HostStatus='offline';
            }if(data&&data.sharingStatus=='start'){
                this.isSharing=true;
            }else this.isSharing=false;

            this.onStatusChanged();
        });    
    }
            autoConnect(){
                setTimeout(() => {
                    if (!this.played) {
                        this.registerViewer();
                    }   
                }, 5000);
            }
    createPeerConnection(controller){
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
        if (controller) {
            controller.peerConnection = pc;
            pc.onnegotiationneeded = async () => {
                const offer = await controller.peerConnection.createOffer();
                await viewer.peerConnection.setLocalDescription(offer);
                this.socket.emit("setHostOffer", { id: controller.id, offer: offer });
            };
        }
        else {
            this.peerConnection = pc;
        }

        pc.onicecandidate = (iceEvent) => {
            if (iceEvent && iceEvent.candidate) {
                this.socket.emit("setControllerCandidate", { id: controller ? controller.id : null, candidate: iceEvent.candidate });
            }
        };

        if (this.streams && controller) {
            this.streams[0].getTracks().forEach(track => {
                controller.senders.push(controller.peerConnection.addTrack(track, this.streams[0]));
            });
        
        }

        pc.ontrack=async(event)=>{
            if(controller){
                let sendersLength=controller.senders.length;
                event.streams[0].getTracks().forEach(track=>{
                    if (sendersLength) {
                        controller.senders.find(sender => sender.track.kind === track.kind).replaceTrack(track);
                    }
                    else {
                        controller.senders.push(controller.peerConnection.addTrack(track, event.streams[0]));
                    }
                });//adding the tracks to the stream

            }else{
                this.streams=event.streams;
                this.player.autoPlay=true;
                this.player.muted=true;
                this.player.srcObject=event.streams[0];
                this.player.src=event.streams[0];
                Object.keys(this.controllers).forEach(id=>{
                    if(!this.controllers[id].sharedStream&&this.controllers[id].peerConnection){
                        this.controllers[id].sharedStream=true;
                        this.controllers[id].senders=this.controllers[id].senders?this.controllers[id].senders:[];
                        let sendersLength=this.controllers[id].senders.length;
                        event.streams[0].getTracks().forEach(track=>{
                            if (sendersLength) {
                                this.controllers[id].senders.find(sender => sender.track.kind === track.kind).replaceTrack(track);
                            }
                            else {
                                this.controllers[id].senders.push(this.controllers[id].peerConnection.addTrack(track, event.streams[0]));
                            }
                        });


                    }
                });
            }
            this.onStatusChanged();

        };
    }
    onStatusChanged() {}
    mobileCheck() {
        let check = false;
        (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    };
    controllerResponse(message){
        if(message.response!='accepted'){
            var errorMsg=message.message?message.message:'Unknown error';
            console.warn('Call not accepted for the following reason: '+errorMsg);
            this.dispose();
        }else{
            this.webRtcPeer.processAnswer(message.sdpAnswer);
        }
    }
    controller(){
        if(!this.webRtcPeer){
            this.iceServers = [
                { urls: "stun:stun1.l.google.com:19302" }
            ]
        }
        var options={
            remoteVideo: document.getElementById('plrVideo'),
            onicecandidate: this.onIceCandidate.bind(this),
            configuration:{
                iceServers:this.iceServers
            }
        }
        options.remoteVideo.autoplay = true;
        options.remoteVideo.muted = true;
        let _this=this;
        this.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
            if (error) return _this.onError(error);
            this.generateOffer(_this.onOfferViewer.bind(_this));
        });
    }
    sendMessage(message) {
        var jsonMessage = JSON.stringify(message);
        this.socket.send(jsonMessage);
    }
    dispose() {
        if (this.webRtcPeer) {
            this.webRtcPeer.dispose();
            this.webRtcPeer = null;
        }
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
    onIceCandidate(candidate) {
        var message = {
            id: 'onIceCandidate',
            candidate: candidate
        }
        this.sendMessage(message);
    }
    
    onOfferController(error, offerSdp) {
        if (error) return this.onError(error)

        var message = {
            id: 'controller',
            sdpOffer: offerSdp
        }
        this.sendMessage(message);
    }
}