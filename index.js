'use strict';

const os = require('os');
const fs = require('fs');
const nodeStatic = require('node-static');
const https = require('https');
const socketIO = require('socket.io');

const privkey='./key.pem';
const cert='./cert.pem';

const https_options= {
  key:fs.readFileSync(privkey),
  cert:fs.readFileSync(cert),
  passphrase: 'aaaa'
};

let fileServer = new(nodeStatic.Server)();

let app = https.createServer(https_options,(req, res) => {
  fileServer.serve(req, res);
}).listen(8080);

const nicknames=[
  '博麗',
  '霧雨',
  '十六夜',
  '八雲',
  '魂魄',
  '西行寺',
  '上白沢',
  '因幡',
  '八意',
  '蓬莱山',
  '藤原',
  '射命丸',
  '風見',
  '小野塚',
  '四季',
  '鍵山',
  '河城',
  '犬走',
  '東風谷',
  '八坂',
  '洩矢',
//  '',
];

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


let rooms={};

class Room {
  constructor(name) {
    this.members={};
    this.mids={};
    this.name=name;
    let id_pool=this.id_pool=[...Array(nicknames.length).keys()];
    for (let i=id_pool.length-1;i>0;i--) {
      let n=getRandomInt(0,i);
      let t=id_pool[i];
      id_pool[i]=id_pool[n];
      id_pool[n]=t;
    }
  }

  pickid() {
    if (this.id_pool.length>0)
      return this.id_pool.pop();
    else return -1;
  }

  dropid(id) {
    let id_pool=this.id_pool;
    if (id>=0 && id<nicknames.length && id_pool.indexOf(id)==-1)
      id_pool.splice(getRandomInt(0,id_pool.length-1),0,id);
  }

  join(socketId) {
    let id=this.pickid();
    if (id==-1) {
      return null;
    }
    this.mids[socketId]=id;
    let n=nicknames[id];
    this.members[socketId]=n;
    return n;
  }

  leave(socketId) {
    if (this.members.hasOwnProperty(socketId)) {
      this.dropid(this.mids[socketId]);
      delete this.mids[socketId];
      delete this.members[socketId];
    }
    if (Object.keys(this.members)==0)
      delete rooms[this.name];
  }

  getnickname(socketId) {
    return this.members[socketId];
  }
}

let io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    let array = ['server log:'];
    array.push.apply(array, arguments);
    //socket.emit('log', array);
    console.log(array);
  }

  /*
  socket.on('message', function(msg) {
    let name=socket.nickname || socket.id;
    log(`'message from ${name}:${msg}`);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', msg);
  });//*/

  socket.on('peerMsg', function(msg) {
    //log(`peer message from ${socket.id} to ${msg.to}: ${JSON.stringify(msg.body)}`);
    io.to(`${msg.to}`).emit('peerMsg', msg);
  });

  socket.on('join', function(room) {
    log(`${socket.id} asks to join room ${room}`);
    if (!(room in rooms)) {
      rooms[room]=new Room(room);
    }
    let r=rooms[room];
    let nickname=r.join(socket.id);
    if (nickname==null) {
      socket.emit('room_reject','room full.');
      return;
    }
    socket.join(room);
    socket.emit('room_accept',{
      name:nickname,
      room:room,
      members:rooms[room].members
    });

    let clientsInRoom = io.sockets.adapter.rooms[room];
    let numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    socket.to(room).emit('join',{
      room:room,
      name:nickname,
      total:numClients,
      id:socket.id
    });

    log(`client ${socket.id} joined room ${room} as ${nickname}`);
  });

  function disconnect() {
    for (let room in rooms) {
      leave(room);
    }
    console.log(socket.id,'disconnected');
  }

  function leave(room) {
    let clientsInRoom = io.sockets.adapter.rooms[room];
    let numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    rooms[room].leave(socket.id);
    socket.to(room).emit('leave',{
      room:room,
      id:socket.id,
      total:numClients
    });
    log(`client ${socket.id} left room ${room}.`);
  }

  socket.on('leave',function(room) {
    leave(room);
  });

  socket.on('disconnect',disconnect);

  socket.on('ipaddr', function() {
    let ifaces = os.networkInterfaces();
    for (let dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

});
