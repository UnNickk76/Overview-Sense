// Streaming chat over SSE using XMLHttpRequest (RN-friendly incremental read).
import { api } from "./api";

export function streamChat(
  sessionId: string,
  message: string,
  context: string | null,
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): () => void {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", api.chatUrl());
  xhr.setRequestHeader("Content-Type", "application/json");
  let seen = 0;

  const parse = (buffer: string) => {
    const lines = buffer.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.delta) onDelta(obj.delta);
        if (obj.error) onError(obj.error);
      } catch {
        // partial line, ignore
      }
    }
  };

  xhr.onprogress = () => {
    const chunk = xhr.responseText.slice(seen);
    // only process complete SSE events (terminated by \n\n)
    const lastBreak = chunk.lastIndexOf("\n\n");
    if (lastBreak === -1) return;
    const ready = chunk.slice(0, lastBreak);
    seen += lastBreak + 2;
    parse(ready);
  };
  xhr.onload = () => {
    parse(xhr.responseText.slice(seen));
    onDone();
  };
  xhr.onerror = () => onError("connection failed");
  xhr.send(JSON.stringify({ session_id: sessionId, message, context }));

  return () => xhr.abort();
}
