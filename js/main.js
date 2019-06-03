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

let sendTextButton=document.getElementById('sendTextButton');
let fileSelect=document.getElementById('fileSelect');
let shareFileButton=document.getElementById('shareFileButton');
let msgDiv=document.getElementById('msgframe');
let msgInput=document.getElementById('textinput');
let nameNode=document.getElementById('nickname');
let peers={};
let sharedFiles={};


//----------- text messages
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

sendTextButton.onclick=function() {
  sendText();
  msgInput.focus();
}

//------------- file sharing
//fileSelect.addEventListener('change',onFileSelectChange,false);
function onFileSelectChange(event) {
  //console.log('onFileSelectChange',event);
}

fileSelect.onchange=onFileSelectChange;

function randStr(len) {
  const t='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s='';
  for (let i=0;i<len;i++) {
    s+=t[Math.floor(Math.random()*62)];
  }
  return s;
}

function shareFile() {
  let f=fileSelect.files[0];
  if (f.length==0) return;
  let id=randStr(8);
  while (sharedFiles.hasOwnProperty(id)) {
    id=randStr(8);
  }
  sharedFiles[id]=f;
  let fileinfo={
    id:id,
    name:f.name,
    size:f.size,
    type:f.type,
    lastModified:f.lastModified
  }
  for (let i in peers) {
    peers[i].sendFileInfo(fileinfo);
  }
  appendFileInfo(signaling.name,fileinfo,() => {
    document.getElementById(`${signaling.name}:${id}`).remove();
  },'Cancel')
}

shareFileButton.addEventListener('click', () => {
  shareFile();
  shareFileButton.value=null;}
  ,false);

function appendFileInfo(name,info,func,buttonText='Download') {
  let b=(msgDiv.scrollTop+msgDiv.offsetHeight+20>=msgDiv.scrollHeight);
  let t=new Date();
  let div=document.createElement('div');
  div.setAttribute('class','msgentry');
  div.setAttribute('id',`${name}:${info.id}`);
  div.innerHTML=`
    <div class='msgnickname'>${name}</div>
    <div class='msgtime'>${t.toLocaleTimeString()}</div>
    <div class='msgfileinfo'>
      <div class='info_filename'>${info.name}</div>
      <div class='info_filename'>${info.size}</div>
    </div>`;
  let button=document.createElement('button');
  button.addEventListener('click',func,false);
  button.innerText=buttonText;
  div.append(button);
  msgDiv.append(div);
  if (b) msgDiv.scrollTop=msgDiv.scrollHeight;
}

shareFileButton.addEventListener('click',null);

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
      this.freqlist={};
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

  //------------------ data channel
  onDataChannelOpen() {
  }

  onDataChannelClose() {
  }

  onDataChannel(event) {
    let ch=event.channel;
    if (this.freqlist.hasOwnProperty(ch.label)) {
      this.receiveFile(this.freqlist[ch.label],ch);
      return;
    }
    this.rch=event.channel;
    this.rch.onmessage= (event) => this.onDataChannelMessage(event);
    //console.log('onDataChannel',event);
  }

  onDataChannelMessage(event) {
    let msg=JSON.parse(event.data);
    switch (msg.type) {
      case 'text':
        appendMessage(this.peerNickname,msg.text);
        break;
      case 'fileinfo':
        appendFileInfo(this.peerNickname,msg.fileinfo,() => {
          this.requestFile(msg.fileinfo);
          //console.log('Download clicked.');
          //clicked func
        });
        break;
      case 'filereq':
        if (!sharedFiles.hasOwnProperty(msg.fileid)) {
          this.sendMessage({type:'filerep',error:'not found'});
        } else if (sharedFiles[msg.fileid].size==0) {
          this.sendMessage({type:'filerep',error:'file is empty'});
        }else {
          this.sendFile(msg);
        }
      case 'filerep':
        break;
    }
    //console.log('onDataChannelMessage',event);
  }

  receiveFile(fileinfo,channel) {
    let receiveBuffer=[],receivedSize=0;
    function saveBlob(blob,filename) {
      let a=document.createElement('a');
      document.body.appendChild(a);
      let url=window.URL.createObjectURL(blob);
      a.href=url;
      a.download=filename;
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    }
    channel.onmessage= (event) => {
      receiveBuffer.push(event.data);
      receivedSize+=event.data.byteLength;
      if (receivedSize==fileinfo.size) {
        const received=new Blob(receiveBuffer);
        receiveBuffer=[];
        saveBlob(received,fileinfo.name);
      }
    };

  }

  sendData(file,channel) {
    const chunkSize = 16384;
    console.log('start sending file',file);
    let fr=new FileReader();
    let offset=0;
    fr.addEventListener('error', error => console.error('error reading file:', error));
    fr.addEventListener('abort', event => console.log('file reading aborted:', event));
    fr.addEventListener('load', e => {
      console.log('FileRead.onload ', e);
      channel.send(e.target.result);
      offset += e.target.result.byteLength;
      if (offset < file.size) {
        readSlice(offset);
      }
    });
    const readSlice = o => {
      //console.log('readSlice ', o);
      const slice = file.slice(o, o + chunkSize);
      fr.readAsArrayBuffer(slice);
    };
    readSlice(0);
  }

  sendFile(req) {
    let tempch=this.conn.createDataChannel(req.reqid);
    tempch.addEventListener('error',
      error => console.error('error in tempch:', error));
    tempch.addEventListener('open', () => {
      this.sendData(sharedFiles[req.fileid],tempch);
    });
  }

  requestFile(fileinfo) {
    let f=this.freqlist,id=randStr(8);
    while (f.hasOwnProperty(id)) {
      id=randStr(8);
    }
    f[id]=fileinfo;
    let msg={
      type:'filereq',
      fileid:fileinfo.id,
      reqid:id
    };
    this.sendMessage(msg);
  }
  //----------------- send functions
  sendText(text) {
    let message={
      type:'text',
      text:text
    }
    this.sendMessage(message);
  }

  sendFileInfo(fileinfo) {
    let message={
      type:'fileinfo',
      fileinfo:fileinfo
    }
    this.sendMessage(message);
  }

  sendMessage(message) {
    this.sch.send(JSON.stringify(message));
  }

  onNegotiationNeeded(event) {
    //console.log('onNegotiationNeeded',event);
  }

  //----------------- ice related
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

  //-------------  start a session 
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
      const msg=`${info.id} joined room ${info.room} as ${info.name}`;
      appendMessage('server',msg)
      console.log(msg);
      this.members[info.id]={name:info.name};
      let peer=new Peer(info.id,info.name);
      peers[info.id]=peer;
      peer.initiateSession();
    });

    socket.on('leave', (info) => {
      msg=`${this.members[info.id]} left room ${info.room}.`;
      appendMessage('server',msg)
      console.log(msg);
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
