import { useRef, useState } from "react";

export default function RealtimeVoicePanel({
  customerType,
  difficulty,
  scenario,
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Ready for live voice.");
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  async function startRealtimeCall() {
    try {
      setStatus("Creating live AI customer session...");

      const sessionResponse = await fetch("/api/realtime-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerType,
          difficulty,
          scenario,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error("Could not create realtime session.");
      }

      const sessionData = await sessionResponse.json();
      const clientSecret = sessionData.clientSecret;

      if (!clientSecret) {
        throw new Error("No realtime client secret returned.");
      }

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;

      peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
      };

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      localStreamRef.current = localStream;

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        setStatus("Live voice connected. Start talking.");
        setIsConnected(true);

        dataChannel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions:
                "Open the call as the customer. Greet the rep briefly and begin the sales scenario.",
            },
          })
        );
      };

      dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Realtime event:", message);
        } catch {
          console.log("Realtime message:", event.data);
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const realtimeResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls?model=gpt-realtime",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
            Accept: "application/sdp",
          },
          body: offer.sdp,
        }
      );

      if (!realtimeResponse.ok) {
        const errorText = await realtimeResponse.text();
        throw new Error(errorText);
      }

      const answerSdp = await realtimeResponse.text();

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      setStatus("Connecting audio...");
    } catch (error) {
      console.error(error);
      setStatus(`Realtime voice failed: ${error.message}`);
      stopRealtimeCall();
    }
  }

  function stopRealtimeCall() {
    dataChannelRef.current?.close();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    peerConnectionRef.current = null;
    dataChannelRef.current = null;
    localStreamRef.current = null;
    remoteAudioRef.current = null;

    setIsConnected(false);
    setStatus("Live voice stopped.");
  }

  return (
    <section className="simulator-panel realtime-voice-panel">
      <h2>Full Real-Time Voice</h2>
      <p>{status}</p>

      <div className="realtime-voice-actions">
        <button onClick={startRealtimeCall} disabled={isConnected}>
          Start Live Voice Call
        </button>

        <button onClick={stopRealtimeCall} disabled={!isConnected}>
          Stop Live Voice Call
        </button>
      </div>
    </section>
  );
}