'use strict';

class Signaling extends CustomEventTarget {
  constructor() {
    super();
    this.socket;
    this.room;
    this.name;
    this.members={};
    this.eventobj=document.createElement('s');
    //this.init();
  }

  init() {
    let socket=io.connect();
    this.socket=socket;

    socket.on('room_reject',(msg) => {
      console.log('rejected:',msg);
      this.emitEvent('room_reject',msg);
    });

    socket.on('room_accept', (info) => {
      console.log(`entered room ${info.room} as ${info.name}`);
      this.room=info.room;
      this.name=info.name;
      this.members=info.members;
      this.emitEvent('room_accept',info);
    });

    socket.on('member_join', (info) => {
      this.members[info.id]=info.name;
      this.emitEvent('member_join',info);
    });

    socket.on('member_leave', (info) => {
      info.name=signaling.members[info.id];
      delete this.members[info.id];
      this.emitEvent('member_leave',info);
      // delete peers[info.id];
    });

    socket.on('log', (msg) => {
      this.emitEvent('log',msg);
    });

    socket.on('message', (msg) => {
      this.emitEvent('message',msg);
    });

    socket.on('peer_message', (msg) => {
      if (socket.id!=msg.to) return;
      this.emitEvent('peer_message',msg);
      /*
      */
    });
  }

  join(room) {
    if (room !== '') {
      this.socket.emit('join', room);
      console.log('try to join room', room);
    }
  }

  sendPeerMessage(peerId,msg) {
    msg={
      from:this.socket.id,
      to:peerId,
      body:msg
    };
    //console.log('sendPeerMessage:', msg);
    this.socket.emit('peer_message', msg);
  }

  sendMessage(msg) {
    // console.log('sendMessage:', msg);
    this.socket.emit('message', msg);
  }
  
  leave(room) {
    // console.log('leave room.');
    this.stop();
    this.socket.emit('leave',room);
    this.emitEvent('leave');
  }

  stop() {
    this.emitEvent('stop');
  }

}
