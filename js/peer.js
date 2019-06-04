'use strict';

const configs={
  rtcConfiguration:{
    'iceServers': [{
      'urls': [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        ]
    }]
  }
}

class Peer extends CustomEventTarget {
  constructor(signaling,remoteId) {
    super();
    try {
      this.conn=new RTCPeerConnection(configs.rtcConfiguration);
      this.conn.onnegotiationneeded= (event) => this.onNegotiationNeeded(event);
      this.conn.onicecandidate= (event) => this.onIceCandidate(event);
      this.conn.onconnectionstatechange= (event) => this.onConnectionStateChange(event);
      this.conn.ondatachannel= (event) => this.onDataChannel(event);
      //this.sch=this.conn.createDataChannel('datachannel');
      this.signaling=signaling;
      this.remoteId=remoteId;
      this.peerNickname=signaling.members[remoteId];
      this.eventobj=document.createElement('s');
      this.registerEventListener(this.signaling,'peer_message', e => {
        this.handleSignalingEvent(e);
      });
      //this.freqlist={};
    } catch (e) {
      console.log(e);
    }
  }

  onDataChannelOpen(){}
  onDataChannelClose(){}

  onDataChannelMessage(event) {
    this.emitEvent('message',JSON.parse(event.data));
  }

  onConnectionStateChange(event) {
    let state=event.currentTarget.connectionState;
    console.log(`connection with ${this.peerNickname} state: ${state}`);
    if (state=='disconnected') {
      this.close();
      //delete peers[this.remoteId];
    }
  }

  //----------------- send functions
  sendMessage(message) {
    //console.log(`message to ${this.peerNickname}`,message);
    this.mainchannel.send(JSON.stringify(message));
  }

  onNegotiationNeeded(event) {
    //console.log('onNegotiationNeeded',event);
  }

  //----------------- ice related
  onIceCandidate(event) {
    //console.log('icecandidate event: ', event);
    if (event.candidate) {
      this.signaling.sendPeerMessage(this.remoteId,{
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      //console.log('End of candidates.');
    }
  }

  handleIceCandidateMessage(msg) {
    let candidate = new RTCIceCandidate({
      sdpMLineIndex: msg.label,
      candidate: msg.candidate
    });
    this.conn.addIceCandidate(candidate);
  }

  //-------------  start a session 
  initiateSession(options=null) {
    console.log(`send offer to ${this.peerNickname}.`);
    this.mainchannel=this.conn.createDataChannel('main');
    this.mainchannel.onopen= () => this.onDataChannelOpen();
    this.mainchannel.onclose= () => this.onDataChannelClose();
    this.mainchannel.onmessage= (event) => this.onDataChannelMessage(event);
    this.conn.createOffer(options)
      .then(offer => {
        this.conn.setLocalDescription(offer);
        this.signaling.sendPeerMessage(this.remoteId,offer);
      })
      .catch(e => {console.log('createOffer() error:', e);});
  }

  acceptSession(offer) {
    this.conn.setRemoteDescription(new RTCSessionDescription(offer));
    console.log(`send answer to ${this.peerNickname}.`);
    this.conn.createAnswer()
      .then(answer => {
        this.conn.setLocalDescription(answer);
        this.signaling.sendPeerMessage(this.remoteId,answer);
      })
      .catch(e => console.log('createAnswer() error:',e));
  }

  onDataChannel(event) {
    let ch=event.channel;
    if (ch.label=='main') {
      this.mainchannel=event.channel;
      this.mainchannel.onopen= () => this.onDataChannelOpen();
      this.mainchannel.onclose= () => this.onDataChannelClose();
      this.mainchannel.onmessage= (event) => this.onDataChannelMessage(event);
    }
    this.emitEvent('datachannel',ch);
  }
  
  handleAnswerMessage(answer) {
    console.log(`received answer from ${this.peerNickname}`);
    this.conn.setRemoteDescription(new RTCSessionDescription(answer));
  }

  handleSignalingEvent(event) {
    const msg=event.detail;
    if (msg.from != this.remoteId) return;
    const body=msg.body;
    switch (body.type) {
      case 'answer':
        this.handleAnswerMessage(body);
        break;
      case 'candidate':
        this.handleIceCandidateMessage(body);
        break;
    }
  }

  cleanup() {
    this.unregisterAllInternalEventListener();
  }

  close() {
    this.cleanup();
    this.conn.close();
    this.emitEvent('close');
  }

}
