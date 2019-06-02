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

let sendButton=document.getElementById('sendButton');
let msgDiv=document.getElementById('msgframe');
let msgInput=document.getElementById('textinput');
let nameNode=document.getElementById('nickname');
let peers={};

function sendText() {
  let msg=msgInput.value;
  if (msg.length>0) {
    appendMessage(signaling.name,msgInput.value);
    for (let i in peers) {
      peers[i].sendText(msgInput.value);
    }
    msgInput.value='';
  }
}

msgInput.onkeyup=function() {
  if (event.key==='Enter') {
    sendText();
    msgInput.focus();
  }
}

function appendMessage(name,msg) {
  let b=(msgDiv.scrollTop+msgDiv.offsetHeight+20>=msgDiv.scrollHeight);
  let t=new Date();
  let html=`<div class='msgentry'>
      <div class='msgnickname'>${name}</div>
      <div class='msgtime'>${t.toLocaleTimeString()}</div>
      <div class='msgcontent'>${msg}</div>
    </div>`;
  msgDiv.innerHTML+=html;
  if (b) msgDiv.scrollTop=msgDiv.scrollHeight;
}

sendButton.onclick=function() {
  sendText();
  msgInput.focus();
}

class Peer {
  constructor(remoteId,peerNickname) {
    try {
      this.conn=new RTCPeerConnection(configs.rtcConfiguration);
      this.conn.onnegotiationneeded= (event) => this.onNegotiationNeeded(event);
      this.conn.onicecandidate= (event) => this.onIceCandidate(event);
      this.conn.ondatachannel= (event) => this.onDataChannel(event);
      this.conn.onconnectionstatechange= (event) => this.onConnectionStateChange(event);
      //this.sch=this.conn.createDataChannel('datachannel');
      this.sch=this.conn.createDataChannel(peerNickname);
      this.sch.onopen= () => this.onDataChannelOpen();
      this.sch.onclose= () => this.onDataChannelClose();
      this.peerNickname=peerNickname;
      this.remoteId=remoteId;
    } catch (e) {
      console.log(e);
    }
  }

  onConnectionStateChange(event) {
    let state=event.currentTarget.connectionState;
    console.log(`connection with ${this.peerNickname} state: ${state}`);
    if (state=='disconnected') {
      this.conn.close();
      delete peers[this.remoteId];
    }
  }

  onDataChannelOpen() {
  }

  sendText(text) {
    this.sch.send(text);
  }

  onDataChannelClose() {
  }

  onDataChannel(event) {
    this.rch=event.channel;
    this.rch.onmessage= (event) => this.onDataChannelMessage(event);
    //console.log('onDataChannel',event);
  }

  onDataChannelMessage(event) {
    appendMessage(this.peerNickname,event.data);
    //console.log('onDataChannelMessage',event);
  }

  onNegotiationNeeded(event) {
    //console.log('onNegotiationNeeded',event);
  }

  onIceCandidate(event) {
    //console.log('icecandidate event: ', event);
    if (event.candidate) {
      signaling.sendPeerMessage(this.remoteId,{
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

  initiateSession(options=null) {
    console.log('send offer');
    this.conn.createOffer(options)
      .then(offer => {
        this.conn.setLocalDescription(offer);
        signaling.sendPeerMessage(this.remoteId,offer);
      })
      .catch(e => {console.log('createOffer() error:', e);});
  }

  acceptSession(offer) {
    this.conn.setRemoteDescription(new RTCSessionDescription(offer));
    console.log('send answer');
    this.conn.createAnswer()
      .then(answer => {
        this.conn.setLocalDescription(answer);
        signaling.sendPeerMessage(this.remoteId,answer);
      })
      .catch(e => console.log('createAnswer() error:',e));
  }

  handleAnswerMessage(answer) {
    console.log('answer received')
    this.conn.setRemoteDescription(new RTCSessionDescription(answer));
  }
}
/*
function sessionId(sdp) {
  return sdp.split('\r\n')[1];
}//*/

let signaling = {
  socket:null,
  room:'',
  name:'',
  members:null,
  init: function() {
    let socket=io.connect();
    this.socket=socket;

    socket.on('room_reject',(msg) => {
      console.log('rejected:',msg);
    });

    socket.on('room_accept', (info) => {
      console.log(`accepted by room ${info.room} as ${info.name}`);
      this.room=info.room;
      this.name=info.name;
      this.members=info.members;
      nameNode.innerText=info.name;
    });

    socket.on('join', (info) => {
      console.log(`${info.id} joined room ${info.room} as ${info.name}`);
      this.members[info.id]={name:info.name};
      let peer=new Peer(info.id,info.name);
      peers[info.id]=peer;
      peer.initiateSession();
    });

    socket.on('leave', (info) => {
      console.log(`${this.members[info.id].name} left room ${info.room}.`);
      delete this.members[info.id];
    });

    socket.on('log', (array) => {
      console.log.apply(console, array);
    });

    socket.on('message', (msg) => {
      console.log('message:', msg);
    });

    socket.on('peerMsg', (msg) => {
      if (socket.id!=msg.to) return;
      let body=msg.body;
      switch (body.type) {
        case 'offer':
          let m=this.members[msg.from];
          if (m==undefined) return;
          console.log('offer received')
          let peer=new Peer(msg.from,m);
          peers[msg.from]=peer;
          peer.acceptSession(body);
          break;
        case 'answer':
          peers[msg.from].handleAnswerMessage(body);
          break;
        case 'candidate':
          peers[msg.from].handleIceCandidateMessage(body);
          break;
      }
    });
  },
  join: function(room) {
    if (room !== '') {
      this.socket.emit('join', room);
      console.log('try to join room', room);
    }
  },
  sendPeerMessage: function(peerId,msg) {
    msg={
      from:this.socket.id,
      to:peerId,
      body:msg
    };
    //console.log('sendPeerMessage:', msg);
    this.socket.emit('peerMsg', msg);
  },
  sendMessage: function(msg) {
    console.log('sendMessage:', msg);
    this.socket.emit('message', msg);
  },
  leave(room) {
    console.log('leave room.');
    this.stop();
    this.socket.emit('leave',room);
  },
  stop() {
    for (let i in peers) {
      peers[i].close();
    }
  }
}

let room='MEOWOEM';

window.onbeforeunload = () => {
  signaling.leave(room);
};

signaling.init();
signaling.join(room);

function trace(text) {
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    let now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
  }
}
