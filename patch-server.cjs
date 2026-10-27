const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const wsImport = `import { WebSocketServer } from "ws";\n`;
if (!code.includes('WebSocketServer')) {
  code = code.replace(`import { createServer as createViteServer } from "vite";`, `import { createServer as createViteServer } from "vite";\n${wsImport}`);
}

const wssSetup = `
  const server = require('http').createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs) => {
    try {
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction,
          tools: [{
            functionDeclarations: [
              generateImageDecl,
              generateWebsiteDecl,
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
             clientWs.send(JSON.stringify({ type: "open" }));
          },
          onmessage: (message) => {
             clientWs.send(JSON.stringify({ type: "message", data: message }));
          },
          onclose: () => {
             clientWs.send(JSON.stringify({ type: "close" }));
          },
          onerror: (err) => {
             console.error("Gemini Error:", err);
             clientWs.send(JSON.stringify({ type: "error", error: err.message }));
          }
        }
      });

      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.realtimeInput) {
            session.sendRealtimeInput(msg.realtimeInput);
          } else if (msg.toolResponse) {
            session.sendToolResponse(msg.toolResponse);
          } else if (msg.close) {
            session.close();
          }
        } catch (e) {
          console.error("Client WS Message Error:", e);
        }
      });

      clientWs.on("close", () => {
        try { session.close(); } catch(e) {}
      });

    } catch (err) {
      console.error("Failed to connect to Live API", err);
      clientWs.send(JSON.stringify({ type: "error", error: "Failed to connect" }));
      clientWs.close();
    }
  });
`;

code = code.replace(`app.listen(PORT, "0.0.0.0", () => {`, `${wssSetup}\n  server.listen(PORT, "0.0.0.0", () => {`);

fs.writeFileSync('server.ts', code);
