import { learnerFetch } from "../../lib/learnerFetch";
import { useEffect, useRef, useState } from "react";

export default function RealtimeVoicePanel({
  customerType,
  difficulty,
  scenario,
  products,
  addMessage,
  onCallEnded,
  onStart,
  onFailure,
  disabled,
  onConnectedChange,
}) {
  const startingRef = useRef(false);
  const activeRef = useRef(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Ready for live voice.");
  const [recordingUrl, setRecordingUrl] = useState(null);

  useEffect(() => {
    onConnectedChange?.(isConnected);
  }, [isConnected, onConnectedChange]);

  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const transcriptRef = useRef([]);

  async function startRealtimeCall() {
    if (startingRef.current || disabled) return;
    startingRef.current = true;
    setIsStarting(true);
    try {
      if (!await onStart()) return;
      activeRef.current = true;
      setStatus("Creating live AI customer session...");
      setRecordingUrl(null);
      recordedChunksRef.current = [];
      transcriptRef.current = [];

      const sessionResponse = await learnerFetch("/api/realtime-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerType,
          difficulty,
          scenario,
          products,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error("Could not create realtime session.");
      }

      const sessionData = await sessionResponse.json();
      const clientSecret = sessionData.clientSecret;

      if (typeof clientSecret !== "string" || !clientSecret.startsWith("ek_") ||
          !Number.isSafeInteger(sessionData.expiresAt) || sessionData.expiresAt <= Math.floor(Date.now() / 1000)) {
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

      startRecording(localStream);

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.onerror = () => stopRealtimeCall(true);
      peerConnection.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(peerConnection.connectionState)) stopRealtimeCall(true);
      };
      dataChannel.onopen = () => {
        setStatus("Live voice connected. Start talking.");
        setIsConnected(true);

        dataChannel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions:
                "Answer the phone briefly as the dealer, consistent with the session instructions. Let the caller speak; do not launch a pitch or list of concerns.",
            },
          })
        );
      };

      dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (
            message.type ===
              "conversation.item.input_audio_transcription.completed" &&
            message.transcript
          ) {
            const item = {
              speaker: "Sales Rep",
              text: message.transcript,
              timestamp: new Date().toISOString(),
            };
            transcriptRef.current.push(item);
            addMessage?.("Sales Rep", message.transcript);
          } else if (
            ["response.output_audio_transcript.done", "response.audio_transcript.done"].includes(message.type) &&
            message.transcript
          ) {
            const item = {
              speaker: "AI Customer",
              text: message.transcript,
              timestamp: new Date().toISOString(),
            };
            transcriptRef.current.push(item);
            addMessage?.("AI Customer", message.transcript);
          }

          if (message.type === "error") stopRealtimeCall(true);
        } catch {
          stopRealtimeCall(true);
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const realtimeResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
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
        throw new Error("Voice connection unavailable.");
      }

      const answerSdp = await realtimeResponse.text();

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      setStatus("Connecting audio...");
    } catch {
      stopRealtimeCall(true);
    } finally { startingRef.current = false; setIsStarting(false); }
  }

  function startRecording(stream) {
    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) return;

        const blob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });

        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Recording failed:", error);
    }
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  function downloadRecording() {
    if (!recordingUrl) return;

    const a = document.createElement("a");
    a.href = recordingUrl;
    a.download = `sales-call-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.webm`;
    a.click();
  }

  function stopRealtimeCall(failed = false) {
    const wasActive = activeRef.current;
    activeRef.current = false;
    const finalTranscript = transcriptRef.current.slice();

    stopRecording();

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
    mediaRecorderRef.current = null;

    setIsConnected(false);

    if (wasActive) {
      if (failed === true) { setStatus("Live voice is unavailable. Continue with text simulation. This attempt is unscored."); onFailure?.(); }
      else { setStatus("Live voice stopped."); onCallEnded?.(finalTranscript); }
    }
  }

  useEffect(() => () => {
    activeRef.current = false;
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  return (
    <section className="simulator-panel realtime-voice-panel">
      <h2>Full Real-Time Voice</h2>
      <p role="status">{status}</p>

      <div className="realtime-voice-actions">
        <button onClick={startRealtimeCall} disabled={isConnected || isStarting || disabled}>
          Start Live Voice Call
        </button>

        <button onClick={() => stopRealtimeCall(false)} disabled={!isConnected}>
          Stop Live Voice Call
        </button>

        {recordingUrl && (
          <button onClick={downloadRecording}>
            Download Call Recording
          </button>
        )}
      </div>

      {recordingUrl && (
        <div className="realtime-recording-preview">
          <p>Call recording ready:</p>
          <audio controls src={recordingUrl} />
        </div>
      )}
    </section>
  );
}