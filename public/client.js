const socket = io();

const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const btnSendMsg = document.getElementById('btnSendMsg');
const myRoomIdEl = document.getElementById('myRoomId');
const inputRoomId = document.getElementById('inputRoomId');
const statusEl = document.getElementById('status');
const msgReceivedEl = document.getElementById('msgReceived');

let currentRoomId = null;
let peerConnection = null;
let dataChannel = null;
let targetPeerId = null; 

const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

btnCreateRoom.onclick = () => { socket.emit('create-room'); };

socket.on('room-created', (roomId) => {
    currentRoomId = roomId;
    myRoomIdEl.innerText = roomId;
    statusEl.innerText = 'Đã tạo phòng. Đang chờ người vào...';
    createPeerConnection(); 
});

btnJoinRoom.onclick = () => {
    const roomId = inputRoomId.value.trim();
    if (roomId) socket.emit('join-room', roomId);
};

socket.on('room-joined', (roomId) => {
    currentRoomId = roomId;
    statusEl.innerText = 'Đã vào phòng. Đang chờ kết nối...';
    createPeerConnection();
});

socket.on('room-error', (msg) => { alert(msg); });

socket.on('peer-joined', (peerId) => {
    targetPeerId = peerId;
    statusEl.innerText = 'Đã có người vào phòng. Đang thiết lập kết nối...';
    createOffer();
});

function createPeerConnection() {
    if (peerConnection) return; 
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ondatachannel = (event) => {
        setupDataChannel(event.channel);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && targetPeerId) {
            socket.emit('signal', {
                targetId: targetPeerId,
                signalData: { candidate: event.candidate }
            });
        }
    };
}

async function createOffer() {
    dataChannel = peerConnection.createDataChannel('fileTransfer', { ordered: true });
    setupDataChannel(dataChannel);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('signal', {
        targetId: targetPeerId,
        signalData: { offer: offer }
    });
}

socket.on('signal', async (data) => {
    const { senderId, signalData } = data;
    targetPeerId = senderId;

    if (signalData.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', {
            targetId: targetPeerId,
            signalData: { answer: answer }
        });
    } else if (signalData.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.answer));
    } else if (signalData.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
    }
});

function setupDataChannel(channel) {
    dataChannel = channel;
    dataChannel.onopen = () => {
        statusEl.innerText = 'Kết nối P2P THÀNH CÔNG!';
        statusEl.style.color = 'green';
        btnSendMsg.disabled = false; 
    };
    dataChannel.onmessage = (event) => {
        msgReceivedEl.innerText = event.data;
    };
    dataChannel.onclose = () => {
        statusEl.innerText = 'Mất kết nối P2P';
        statusEl.style.color = 'red';
        btnSendMsg.disabled = true;
    };
}

btnSendMsg.onclick = () => {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send("Hello World P2P!");
    }
};