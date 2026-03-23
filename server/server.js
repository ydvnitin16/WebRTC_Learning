import express from "express";
import { Server } from "socket.io";
import { createServer } from "node:http";

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Send own socket id to client
    socket.emit("me", socket.id);

    // Forward offer
    socket.on("offer", ({ to, offer }) => {
        socket.to(to).emit("offer", {
            from: socket.id,
            offer,
        });
    });

    // Forward answer
    socket.on("answer", ({ to, answer }) => {
        socket.to(to).emit("answer", {
            from: socket.id,
            answer,
        });
    });

    // Forward ICE candidates
    socket.on("ice-candidate", ({ to, candidate }) => {
        socket.to(to).emit("ice-candidate", {
            from: socket.id,
            candidate,
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});
