const fs = require('fs');
let code = fs.readFileSync('src/services/liveService.ts', 'utf8');

// remove @google/genai import
code = code.replace(/import\s*\{[^}]*\}\s*from\s*["']@google\/genai["'];/g, '');

// remove GoogleGenAI class property
code = code.replace(/private\s+ai:\s+any;/g, 'private ws: WebSocket | null = null;');

// remove this.ai initialization
code = code.replace(/this\.ai\s*=\s*new\s*GoogleGenAI[^;]*;/g, '');

// update connect
const connectRegex = /this\.sessionPromise\s*=\s*this\.ai\.live\.connect\(\{[\s\S]*?\}\);/g;
const newConnect = `
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = \`\${protocol}//\${window.location.host}/live\`;
      this.ws = new WebSocket(wsUrl);

      this.sessionPromise = new Promise((resolve, reject) => {
        this.ws.onopen = () => {
          // Connected, wait for server 'open' message
        };

        this.ws.onmessage = (event) => {
          const payload = JSON.parse(event.data);
          if (payload.type === "open") {
            console.log("Live API Connected");
            this.onStateChange("listening");
            resolve({
              sendRealtimeInput: (input) => {
                this.ws.send(JSON.stringify({ realtimeInput: input }));
              },
              sendToolResponse: (resp) => {
                this.ws.send(JSON.stringify({ toolResponse: resp }));
              },
              close: () => {
                this.ws.send(JSON.stringify({ close: true }));
              }
            });
          } else if (payload.type === "message") {
            const message = payload.data;
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }
            const userText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (userText) { 
               this.onMessage("zoya", userText);
            }
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = \`https://www.youtube.com/results?search_query=\${encodeURIComponent(args.query)}\`;
                  } else if (args.actionType === "spotify") {
                    url = \`https://open.spotify.com/search/\${encodeURIComponent(args.query)}\`;
                  } else if (args.actionType === "whatsapp") {
                    url = \`https://web.whatsapp.com/send?phone=\${args.target || ''}&text=\${encodeURIComponent(args.query)}\`;
                  } else {
                    let website = args.query.replace(/\\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = \`https://www.\${website}\`;
                  }
                  
                  this.onCommand(url);
                  
                  this.ws?.send(JSON.stringify({
                     toolResponse: {
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     }
                  }));
                } else if (call.name === "generateImage") {
                  const args = call.args;
                  this.onMediaGenerate("image", args.prompt);
                  
                  this.ws?.send(JSON.stringify({
                     toolResponse: {
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Generating image..." }
                       }]
                     }
                  }));
                } else if (call.name === "generateWebsite") {
                  const args = call.args;
                  this.onMediaGenerate("website", args.prompt);
                  
                  this.ws?.send(JSON.stringify({
                     toolResponse: {
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Generating website..." }
                       }]
                     }
                  }));
                }
              }
            }
          } else if (payload.type === "close") {
            console.log("Live API Closed");
            this.stop();
          } else if (payload.type === "error") {
            console.error("Live API Error:", payload.error);
            reject(new Error(payload.error));
            this.stop();
          }
        };

        this.ws.onerror = (err) => {
          console.error("WebSocket Error:", err);
          reject(err);
          this.stop();
        };

        this.ws.onclose = () => {
          console.log("WebSocket Closed");
          this.stop();
        };
      });
`;
code = code.replace(connectRegex, newConnect);

// update stop
code = code.replace(/if\s*\(this\.sessionPromise\)\s*\{[\s\S]*?\}/, `
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.sessionPromise = null;
`);

fs.writeFileSync('src/services/liveService.ts', code);
