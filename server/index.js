const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, '../public')));

io.on('connection', (socket) => {
  console.log('Có client kết nối:', socket.id);

  socket.on('create-room', () => {
    const roomId = crypto.randomBytes(3).toString('hex'); 
    socket.join(roomId);
    socket.emit('room-created', roomId);
    console.log(`Đã tạo phòng: ${roomId} bởi ${socket.id}`);
  });

  socket.on('join-room', (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room && room.size > 0) {
      socket.join(roomId);
      socket.emit('room-joined', roomId);
      socket.to(roomId).emit('peer-joined', socket.id);
      console.log(`Client ${socket.id} đã vào phòng ${roomId}`);
    } else {
      socket.emit('room-error', 'Phòng không tồn tại!');
    }
  });

  socket.on('signal', (data) => {
    io.to(data.targetId).emit('signal', {
      senderId: socket.id,
      signalData: data.signalData
    });
  });

  socket.on('disconnect', () => {
    console.log('Client ngắt kết nối:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});