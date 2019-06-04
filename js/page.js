'use strict';

let sendTextButton=document.getElementById('sendTextButton');
let fileSelect=document.getElementById('fileSelect');
let shareFileButton=document.getElementById('shareFileButton');
let msgDiv=document.getElementById('msgframe');
let msgInput=document.getElementById('textinput');
let nameNode=document.getElementById('nickname');
let peers={};
let sharedFiles={};

//----------- text messages
function appendMessage(name,msg) {
  let b=(msgDiv.scrollTop+msgDiv.offsetHeight+20>=msgDiv.scrollHeight);
  let html=`<div class='msgentry'>
      <div class='msgnickname'>${name}</div>
      <div class='msgtime'>${hhmmssnow()}</div>
      <div class='msgcontent'>${msg}</div>
    </div>`;
  msgDiv.innerHTML+=html;
  if (b) msgDiv.scrollTop=msgDiv.scrollHeight;
}

function sendText() {
  let msg=msgInput.value;
  if (msg.length>0) {
    appendMessage(signaling.name,msg);
    //signaling.sendMessage(msg);
    for (let i in peers) {
      peers[i].sendMessage({
        type:'text',
        text:msg});
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

sendTextButton.onclick=function() {
  sendText();
  msgInput.focus();
}

//------------------- file share
function appendFileInfo(name,info,func,buttonText='Download') {
  let b=(msgDiv.scrollTop+msgDiv.offsetHeight+20>=msgDiv.scrollHeight);
  let div=document.createElement('div');
  div.setAttribute('class','msgentry');
  div.setAttribute('id',`${info.peerid}:${info.fileid}`);
  div.innerHTML=
    `<div class='msgnickname'>${name}</div>
    <div class='msgtime'>${hhmmssnow()}</div>
    <div class='msgcontent'>
      <div class='msgfileinfo'>
        <div class='fi_name'>${info.name}</div>
        <div class='fi_size'>${formatBytes(info.size)}</div>
        <div class='dl_prog'><span style='width:0%'></span></div>
        <button>${buttonText}</button>
      </div>
    </div>`;
  let button=div.querySelector('button');
  button.addEventListener('click',func,false);
  msgDiv.append(div);
  if (b) msgDiv.scrollTop=msgDiv.scrollHeight;
}

//fileSelect.addEventListener('change', e => {});

function shareFile() {
  let f=fileSelect.files[0];
  if (!f || f.length==0) return;
  let fs=new FileShare(f,sharedFiles);
  fs.sendFileInfo(peers);
  let info=fs.fileinfo;
  info.peerid='[self]'
  appendFileInfo(signaling.name,info,(e) => {
    fs.cancel(peers);
    let node=e.target.parentElement;
    e.target.remove();
    node.innerHTML+=`<div class='darkred'>share canceled.</div>`;
  },'Cancel')
}

shareFileButton.addEventListener('click', () => {
  shareFile();
  fileSelect.value=null;}
  ,false);
