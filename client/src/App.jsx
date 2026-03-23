import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3000");

const App = () => {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const localStream = useRef(null);
    const remoteStream = useRef(null);
    const peerConnection = useRef(null);

    const [myId, setMyId] = useState("");
    const [callTo, setCallTo] = useState("");

    const servers = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    // Get local video
    useEffect(() => {
        const init = async () => {
            localStream.current = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            localVideoRef.current.srcObject = localStream.current;
        };

        init();
    }, []);

    // Socket events
    useEffect(() => {
        socket.on("me", (id) => {
            console.log("My ID:", id);
            setMyId(id);
        });

        socket.on("offer", async ({ from, offer }) => {
            console.log("Incoming Offer from:", from);

            peerConnection.current = new RTCPeerConnection(servers);

            // Create remote stream
            remoteStream.current = new MediaStream();
            remoteVideoRef.current.srcObject = remoteStream.current;

            // Add local tracks
            localStream.current.getTracks().forEach((track) => {
                peerConnection.current.addTrack(track, localStream.current);
            });

            // Receive remote tracks
            peerConnection.current.ontrack = (event) => {
                event.streams[0].getTracks().forEach((track) => {
                    remoteStream.current.addTrack(track);
                });
            };

            // Send ICE candidates
            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("ice-candidate", {
                        to: from,
                        candidate: event.candidate,
                    });
                }
            };

            await peerConnection.current.setRemoteDescription(offer);

            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);

            socket.emit("answer", {
                to: from,
                answer,
            });
        });

        socket.on("answer", async ({ from, answer }) => {
            console.log("Answer received from:", from);

            await peerConnection.current.setRemoteDescription(answer);
        });

        socket.on("ice-candidate", async ({ from, candidate }) => {
            try {
                await peerConnection.current.addIceCandidate(candidate);
            } catch (err) {
                console.error("ICE error:", err);
            }
        });

        return () => {
            socket.off("me");
            socket.off("offer");
            socket.off("answer");
            socket.off("ice-candidate");
        };
    }, []);

    const callUser = async () => {
        peerConnection.current = new RTCPeerConnection(servers);

        // Create remote stream
        remoteStream.current = new MediaStream();
        remoteVideoRef.current.srcObject = remoteStream.current;

        // Add local tracks
        localStream.current.getTracks().forEach((track) => {
            peerConnection.current.addTrack(track, localStream.current);
        });

        // Receive remote tracks
        peerConnection.current.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.current.addTrack(track);
            });
        };

        // Send ICE candidates
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", {
                    to: callTo,
                    candidate: event.candidate,
                });
            }
        };

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        socket.emit("offer", {
            to: callTo,
            offer,
        });
    };

    return (
        <div className='h-screen flex flex-col items-center justify-center gap-4 bg-zinc-900 text-white'>
            <h2>Your ID: {myId}</h2>

            <div className='flex gap-4'>
                <video ref={localVideoRef} autoPlay muted className='w-1/3' />
                <video ref={remoteVideoRef} autoPlay className='w-1/3' />
            </div>

            <input
                type='text'
                placeholder='Enter ID to call'
                value={callTo}
                onChange={(e) => setCallTo(e.target.value)}
                className='p-2 text-black'
            />

            <button
                onClick={callUser}
                className='bg-green-500 px-4 py-2 rounded'
            >
                Call
            </button>
        </div>
    );
};

export default App;
