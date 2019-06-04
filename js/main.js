'use strict';

function setupPeerListeners(peer) {
  peer.addEventListener('message', e => {
    const msg=e.detail;
    switch (msg.type) {
      case 'text':
        appendMessage(peer.peerNickname,msg.text);
        break;
      case 'fileshare':
        let info=msg.fileinfo;
        info.peerid=peer.remoteId;
        appendFileInfo(peer.peerNickname,info, (be) => {
          let prog=be.target.parentElement.querySelector('.dl_prog > span');
          let fr=new FileReceiver(info,peer);
          fr.addEventListener('progress',(fre) => {
            let d=fre.detail;
            prog.style.width=`${100*d.received/d.fileinfo.size}%`;
            //console.log(`receive progress ${e.detail.received}/${e.detail.fileinfo.size}`);
          });
        });
        break;
      case 'cancelshare':
        let node=document.getElementById(`${peer.remoteId}:${msg.fileid}`);
        let button=node.querySelector('button');
        let bp=button.parentElement;
        button.remove();
        bp.innerHTML+=`<div class='darkred'>file owner has canceled this share.</div>`;
        break;
      case 'requestfile':
        let fid=msg.fileid;
        let fs=new FileSender(sharedFiles[fid],peer);
        fs.addEventListener('progress',(e) => {
          //console.log(`send progress ${e.detail.offset}/${e.detail.file.size}`);
        });
        fs.start();
        break;
    }
  });
  peer.addEventListener('close', e => {
    delete peers[peer.remoteId];
  });
}

let signaling = new Signaling();
signaling.init();

signaling.addEventListener('room_accept', e => {
  //console.log(event);
  nameNode.innerText=e.detail.name;
});

signaling.addEventListener('member_join', e => {
  //console.log(event);
  const info=e.detail;
  appendMessage('server',`${info.name} joined.`)
  let peer=new Peer(signaling,info.id);
  setupPeerListeners(peer);
  peers[info.id]=peer;
  peer.initiateSession();
});

signaling.addEventListener('member_leave', e => {
  //console.log(event);
  const info=e.detail;
  appendMessage('server',`${info.name} left.`);
  if (peers[info.id]) {
    peers[info.id].close();
    //delete peers[info.id];
  }
});

signaling.addEventListener('peer_message', e => {
  const msg=e.detail;
  const body=msg.body;
  if (body.type=='offer') {
    console.log(`received offer from ${signaling.members[msg.from]}.`);
    let peer=new Peer(signaling,msg.from);
    setupPeerListeners(peer);
    peers[msg.from]=peer;
    peer.acceptSession(body);
  }
});

signaling.addEventListener('message', e => {
  const m=e.detail;
  appendMessage(`${signaling.members[m.from]}`,m.msg);
});

signaling.join('hahahoho');

