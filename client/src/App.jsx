import React from "react";
import io from "socket.io-client";
import { useRef } from "react";
import { useEffect } from "react";

const socket = io("http://192.168.31.59:3000", {
    transports: ["websocket"], // helps avoid CORS issues
    secure: true,
});

const App = () => {
    let myVideoRef = useRef(null);
    let remoteVideoRef = useRef(null);
    let roomId = "123";
    let localStream = useRef(null);
    let remoteStream = useRef(new MediaStream());
    let peerConnection = useRef(null);
    let servers = {
        iceServers: [
            {
                urls: [
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
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
        socket.on("connect", () => {
            console.log("Socket Connected");
        });

        // JOIN ROOM
        socket.emit("join-room", roomId);

        socket.on("user-joined", (socketId) => {
            console.log("New User: ", socketId);
        });

        // OFFER EVENT
        socket.on("offer", async (offer) => {
            console.log("offer", offer);

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
                    socket.emit("ice-candidate", {
                        candidate: event.candidate,
                        roomId,
                    });
                }
            };

            // STORE OFFER
            await peerConnection.current.setRemoteDescription(
                new RTCSessionDescription(offer),
            );
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.emit("answer", { roomId, answer });
        });

        // ANSWER EVENT
        socket.on("answer", async (answer) => {
            console.log("answer received");
            await peerConnection.current.setRemoteDescription(
                new RTCSessionDescription(answer),
            );
        });

        socket.on("ice-candidate", async (candidate) => {
            if (candidate && peerConnection.current) {
                try {
                    await peerConnection.current.addIceCandidate(
                        new RTCIceCandidate(candidate),
                    );
                } catch (err) {
                    console.error("Error adding ice candidate", err);
                }
            }
        });

        return () => {
            socket.off("connect");
            socket.off("join-room");
            socket.off("user-joined");
            socket.off("offer");
            socket.off("answer");
            socket.off("ice-candidate");
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

        remoteVideoRef.current.srcObject = remoteStream.current;

        // SEND ICE-CANDIDATE
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", {
                    candidate: event.candidate,
                    roomId,
                });
            }
        };

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("offer", { roomId, offer });
    };

    // LAYOUT
    return (
        <>
            <div className='bg-zinc-800 h-screen flex justify-center items-center gap-4'>
                <video ref={myVideoRef} autoPlay muted className='w-1/2' />
                <video ref={remoteVideoRef} autoPlay className='w-1/2' />
                <button
                    onClick={createOffer}
                    className='absolute bottom-10 p-4 bg-white text-black rounded-3xl'
                >
                    Call to 123
                </button>
            </div>
        </>
    );
};

export default App;
