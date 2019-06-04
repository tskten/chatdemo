'use strict';

class FileShare extends CustomEventTarget {
  constructor(file,pool) {
    super();
    try {
      this.file=file;
      //this.peers=peers;
      this.pool=pool;
      let id=randStr(8);
      while (id in pool) {
        id=randStr(8);
      }
      this.id=id;
      pool[id]=this;
      this.fileinfo={
        fileid:this.id,
        name:file.name,
        size:file.size,
        type:file.type,
        lastModified:file.lastModified
      }
    } catch (e) {
      console.log('FileShare constructor error:',e);
    }
  }

  sendFileInfo(peers) {
    for (let p in peers) {
      peers[p].sendMessage({
        type:'fileshare',
        fileinfo:this.fileinfo
      });
    }
  }

  cancel(peers) {
    for (let p in peers) {
      peers[p].sendMessage({
        type:'cancelshare',
        fileid:this.id
      });
    }
    this.emitEvent('cancel',this);
    delete this.pool[this.id];
  }
}

class FileSender extends CustomEventTarget {
  constructor(fileshare,peer) {
    super();
    this.file=fileshare.file;
    this.offset=0;
    this.peer=peer;
    this.id=fileshare.id;
    this.state='new';
  }

  start() {
    let channel=this.channel=this.peer.conn.createDataChannel(this.id);
    channel.addEventListener('error', error => {
        this.state='error';
        console.error('error occured transfering file:', error)
      });
    channel.addEventListener('open', () => this.send());
  }

  send() {
    this.state='sending';
    const chunkSize = 16384,file=this.file;
    console.log('start sending file',file);
    let fr=this.fr=new FileReader();
    this.emitEvent('progress',this);
    fr.addEventListener('error', error => console.error('error reading file:', error));
    fr.addEventListener('abort', event => console.log('file reading aborted:', event));
    const readSlice = o => {
      const slice = file.slice(o, o + chunkSize);
      fr.readAsArrayBuffer(slice);
    };
    fr.addEventListener('load', e => {
      this.channel.send(e.target.result);
      let offset=this.offset;
      this.offset = offset += e.target.result.byteLength;
      this.emitEvent('progress',this);
      if (offset < file.size) {
        readSlice(offset);
      } else {
        this.state='done';
        this.emitEvent('done',this);
      }
    });
    readSlice(0);
  }

  abort() {
    this.emitEvent('abort',this);
  }
}

class FileReceiver extends CustomEventTarget {
  constructor(fileinfo,peer,options={
    autostart:true,
    timeout:30
    }) {
    super()
    this.fileinfo=fileinfo;
    this.peer=peer;
    this.state='new';
    this.timeout=options.timeout;
    this.received=0;
    if (options.autostart==true) this.request();
  }

  abort() {
    this.unregisterAllInternalEventListener();
    this.emitEvent('abort');
  }

  request() {
    this.registerEventListener(this.peer,'datachannel',
      event => this.onDataChannel(event));
    this.peer.sendMessage({
      type:'requestfile',
      fileid:this.fileinfo.fileid
    });
    this.state='sentrequest';
    if (this.timeout>0) {
      this._timeout=setTimeout(() => {
        this.abort();
      }, this.timeout*1000);
    }
  }

  onDataChannel(e) {
    clearTimeout(this._timeout);
    const ch=e.detail;
    if (ch.label==this.fileinfo.fileid)
      this.receive(ch);
  }

  receive(channel) {
    this.state='receiving'
    let receiveBuffer=[];
    this.emitEvent('progress',this);
    channel.onmessage= (event) => {
      receiveBuffer.push(event.data);
      this.received+=event.data.byteLength;
      this.emitEvent('progress',this);
      if (this.received==this.fileinfo.size) {
        const blob=new Blob(receiveBuffer);
        receiveBuffer=[];
        let a=document.createElement('a');
        document.body.appendChild(a);
        let url=window.URL.createObjectURL(blob);
        a.href=url;
        a.download=this.fileinfo.name;
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        this.state='done';
        this.emitEvent('done',this);
        this.unregisterAllInternalEventListener();
        channel.close();
      }
    };
  }
}

