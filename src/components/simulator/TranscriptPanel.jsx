import { useRef, useState } from "react";

export default function TranscriptPanel({
  messages,
  isLive,
  sendRepMessage,
  customerReply,
}) {
  const [repInput, setRepInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  function handleSend() {
    if (!repInput.trim()) return;
    sendRepMessage(repInput);
    setRepInput("");
  }

  function startVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcriptText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcriptText += event.results[i][0].transcript;
      }

      setRepInput(transcriptText);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }

  function stopVoiceInput() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }

  return (
    <article className="simulator-panel simulator-transcript-panel">
      <div className="simulator-panel-header">
        <h2>Live Conversation</h2>

        <button onClick={customerReply} disabled={!isLive}>
          Nudge AI Customer
        </button>
      </div>

      <div className="simulator-transcript">
        {messages.length === 0 ? (
          <p className="simulator-placeholder">
            Start the call. The AI Customer will open the conversation.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.timestamp}-${index}`}
              className={`simulator-message ${
                message.speaker === "AI Customer" ? "customer" : "rep"
              }`}
            >
              <span>{message.speaker}</span>
              {message.text}
            </div>
          ))
        )}
      </div>

      <div className="simulator-rep-input-row">
        <input
          value={repInput}
          onChange={(event) => setRepInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSend();
          }}
          placeholder={
            isListening
              ? "Listening..."
              : "Speak or type your response. AI will reply automatically."
          }
          disabled={!isLive}
        />

        <button
          type="button"
          onClick={isListening ? stopVoiceInput : startVoiceInput}
          disabled={!isLive}
        >
          {isListening ? "Stop" : "🎤 Talk"}
        </button>

        <button onClick={handleSend} disabled={!isLive || !repInput.trim()}>
          Send
        </button>
      </div>
    </article>
  );
}