'use strict';

function randStr(len) {
  const t='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s='';
  for (let i=0;i<len;i++) {
    s+=t[Math.floor(Math.random()*62)];
  }
  return s;
}

function hhmmssnow() {
  return (new Date).toTimeString().slice(0,8);
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

class CustomEventTarget extends EventTarget {
  constructor() {
    super()
    this.listenerList={};
  }

  registerEventListener(target,type,listener) {
    target.addEventListener(type,listener);
    let id=randStr(8);
    while (this.listenerList.hasOwnProperty(id)) {
      id=randStr(8);
    }
    this.listenerList[id]={
      target:target,
      type:type,
      listener,listener
    };
    return id;
  }

  unregisterInternalEventListener(id) {
    let l=this.listenerList[id];
    if (l) {
      l.target.removeEventListener(l.type,l.listener);
      delete this.listenerList[id];
    }
  }

  emitEvent(type,eventInit) {
    let event= new CustomEvent(type,{detail:eventInit});
    this.dispatchEvent(event);
  }

  unregisterAllInternalEventListener() {
    for (let id in this.listenerList) {
      this.unregisterInternalEventListener(id);
    }
  }
}