
export const syncUser = async () => {
  const res = await fetch("/api/auth/sync", {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to sync user");
  return res.json();
};

export const getMessages = async () => {
  const res = await fetch("/api/messages");
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
};

export const saveMessage = async (sender: string, text: string) => {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sender, text })
  });
  if (!res.ok) throw new Error("Failed to save message");
  return res.json();
};

export const clearMessages = async () => {
  const res = await fetch("/api/messages", {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Failed to clear messages");
  return res.json();
};

export const sendChatCommand = async (prompt: string, history: any[], imageBase64?: string | null) => {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt, history, imageBase64 })
  });
  if (!res.ok) throw new Error("Failed to send chat command");
  return res.json();
};

export const getTtsAudio = async (text: string) => {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error("Failed to get TTS audio");
  const data = await res.json();
  return data.audio;
};
