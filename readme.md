# 📹 WebRTC Complete Guide: From Basics to App

This README is designed as a learning resource + mini-doc for building a WebRTC-based peer-to-peer video calling application. It includes:

- ✅ WebRTC Fundamentals
- 🔁 Connection Flow: Signaling → SDP → ICE → Media
- 🧠 Key Concepts: SDP, NAT, STUN/TURN, ICE
- 🔧 Setup Guide for Dev
- 💡 Flow to Build a WebRTC App (with and without signaling server)
- 📁 File Structure for Practice
- 📚 Resources to Deep Dive

---

## 📘 What is WebRTC?

**WebRTC (Web Real-Time Communication)** is an open-source project that enables **real-time communication** (audio, video, and data) between browsers and mobile apps.

✔ Peer-to-peer  
✔ Low-latency  
✔ No plugins required  

---

## 🧠 Core Concepts

### 1. **SDP (Session Description Protocol)**

- Used to describe **media capabilities** (video/audio codecs, resolution, ports, etc.).
- Two main parts:
  - **Offer**: Sent by initiator
  - **Answer**: Sent by receiver

🔁 Exchanged via a **signaling server** (like Socket.IO or WebSockets).

### 2. **NAT (Network Address Translation)**

- NAT hides private IPs behind a public IP (like your router does).
- Makes P2P hard — peers can’t easily know each other’s IP.
- Solution: **ICE + STUN + TURN**

### 3. **ICE (Interactive Connectivity Establishment)**

- Tries different "candidates" (local IPs, STUN-reflected IPs, TURN relays) to establish connection.

### 4. **STUN / TURN**

- **STUN** (Session Traversal Utilities for NAT): Helps get public IP address.
- **TURN** (Traversal Using Relays around NAT): Relays media if P2P fails.

```mermaid
flowchart TD
  A[Browser 1] -->|Offer| B[Signaling Server]
  B -->|Offer| C[Browser 2]
  C -->|Answer| B
  B -->|Answer| A
  A -->|ICE Candidates| B
  C -->|ICE Candidates| B
  B -->|Relay ICE| A & C
  A -->|STUN/TURN| D[STUN/TURN Servers]
  C -->|STUN/TURN| D
  A <--> C

 ```
 ### 📁 File Structure

```mermaid
webrtc-learn/
│
├── server.js              # Node.js + Socket.IO signaling server
├── public/
│   ├── index.html         # UI for user 1
│   ├── script.js          # WebRTC logic
│   └── style.css
│
├── stun_turn_servers.json # STUN/TURN config
└── README.md
```

## ⚙️ Setup Instructions

### 1. Create Project

```mermaid
mkdir webrtc-video-chat && cd webrtc-video-chat
npm init -y
npm install express socket.io
```
---

### 2. Setup Signaling Server

```
// server.js
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data.offer);
        console.log('Offer Received: ', data);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data.answer);
        console.log('Answer Received: ', data);
    });

    socket.on('ice-candidate', (data) => {
        console.log('Candidate Received: ', data.candidate)
        socket.to(data.roomId).emit('ice-candidate', data.candidate);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

```

### 3. Setup Frontend

```
import React from 'react';
import io from 'socket.io-client';
import { useRef } from 'react';
import { useEffect } from 'react';

const socket = io('http://localhost:3000', {
    transports: ['websocket'], // helps avoid CORS issues
    secure: true,
});

const App = () => {
    let myVideoRef = useRef(null);
    let remoteVideoRef = useRef(null);
    let roomId = '123';
    let localStream = useRef(null);
    let remoteStream = useRef(new MediaStream());
    let peerConnection = useRef(null);
    let servers = {
        iceServers: [
            {
                urls: [
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302',
                ],
            },
        ],
    };

    // LOCAL VIDEO INITIALISATION
    useEffect(() => {
        let init = async () => {
            localStream.current = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            if (myVideoRef.current) {
                myVideoRef.current.srcObject = localStream.current;
            }
        };
        init();
    }, []);

    // USE EFFECT FOR SOCKET EVENTS
    useEffect(() => {
        socket.on('connect', () => {
            console.log('Socket Connected');
        });

        // JOIN ROOM
        socket.emit('join-room', roomId);

        socket.on('user-joined', (socketId) => {
            console.log('New User: ', socketId);
        });

        // OFFER EVENT
        socket.on('offer', async (offer) => {
            console.log('offer', offer);

            // SETUP PEER-CONNECTION
            peerConnection.current = new RTCPeerConnection(servers);

            remoteVideoRef.current.srcObject = remoteStream.current;

            localStream.current.getTracks().forEach((track) => {
                peerConnection.current.addTrack(track, localStream.current);
            });

            peerConnection.current.ontrack = (event) => {
                event.streams[0].getTracks().forEach((track) => {
                    remoteStream.current.addTrack(track);
                });
            };

            // SEND ICE-CANDIDATE
            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        roomId,
                    });
                }
            };

            // STORE OFFER
            await peerConnection.current.setRemoteDescription(
                new RTCSessionDescription(offer)
            );
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.emit('answer', { roomId, answer });
        });

        // ANSWER EVENT
        socket.on('answer', async (answer) => {
            console.log('answer received');
            await peerConnection.current.setRemoteDescription(
                new RTCSessionDescription(answer)
            );
        });

        socket.on('ice-candidate', async (candidate) => {
            if (candidate && peerConnection.current) {
                try {
                    await peerConnection.current.addIceCandidate(
                        new RTCIceCandidate(candidate)
                    );
                } catch (err) {
                    console.error('Error adding ice candidate', err);
                }
            }
        });

        return () => {
            socket.off('connect');
            socket.off('join-room');
            socket.off('user-joined');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
        };
    }, []);

    // SEND OFFER
    let createOffer = async () => {
        peerConnection.current = new RTCPeerConnection(servers);
        remoteStream.current = new MediaStream();

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream.current;
        }

        localStream.current.getTracks().forEach((track) => {
            peerConnection.current.addTrack(track, localStream.current);
        });

        peerConnection.current.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.current.addTrack(track);
            });
        };

        // SEND ICE-CANDIDATE
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    roomId,
                });
            }
        };

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit('offer', { roomId, offer });
    };

    // LAYOUT
    return (
        <>
            <div className="bg-zinc-800 h-screen flex justify-center items-center gap-4">
                <video ref={myVideoRef} autoPlay muted className="w-1/2" />
                <video ref={remoteVideoRef} autoPlay className="w-1/2" />
                <button
                    onClick={createOffer}
                    className="absolute bottom-10 p-4 bg-white text-black rounded-3xl"
                >
                    Call to 123
                </button>
            </div>
        </>
    );
};

export default App;


```