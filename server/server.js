import express from "express";
import { Server } from "socket.io";
import { createServer } from "node:http";

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://webrtc-test-nitin.onrender.com",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        socket.to(roomId).emit("user-joined", socket.id);
    });

    socket.on("offer", (data) => {
        socket.to(data.roomId).emit("offer", data.offer);
        console.log("Offer Received: ", data);
    });

    socket.on("answer", (data) => {
        socket.to(data.roomId).emit("answer", data.answer);
        console.log("Answer Received: ", data);
    });

    socket.on("ice-candidate", (data) => {
        console.log("Candidate Received: ", data.candidate);
        socket.to(data.roomId).emit("ice-candidate", data.candidate);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
