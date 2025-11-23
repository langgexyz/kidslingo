import { GoogleGenAI, Modality, Type, LiveServerMessage, FunctionDeclaration, Tool } from "@google/genai";
import { FlashCardData } from "../types";

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- 1. Photo Analysis (Vision) ---
export const analyzeImageForKids = async (base64Image: string): Promise<FlashCardData> => {
  const ai = getAiClient();
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      targetWord: { type: Type.STRING, description: "The main object in the image in English" },
      nativeWord: { type: Type.STRING, description: "The main object in Chinese (Simplified)" },
      pronunciation: { type: Type.STRING, description: "Phonetic pronunciation guide for the English word" },
      simpleSentence: { type: Type.STRING, description: "A very simple, cute sentence in English about the object (max 6 words)" },
      emoji: { type: Type.STRING, description: "A relevant emoji" }
    },
    required: ["targetWord", "nativeWord", "pronunciation", "simpleSentence", "emoji"]
  };

  const prompt = "Look at this image. Identify the single most prominent object. Generate a flashcard for a 3-year-old child to learn English.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "You are a preschool teacher. Keep words extremely simple and safe for children."
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as FlashCardData;
    }
    throw new Error("No data returned");
  } catch (error) {
    console.error("Analysis failed", error);
    throw error;
  }
};

// --- 2. Audio Generation (TTS) ---
export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) return null;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return await audioContext.decodeAudioData(bytes.buffer);

  } catch (error) {
    console.error("TTS failed", error);
    return null;
  }
};

// --- 3. Image Generation (Imagen) ---
export const generateKidImage = async (prompt: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: `A cute, colorful, cartoon style illustration for a children's book. ${prompt}`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64ImageBytes) {
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image gen failed", error);
    throw error;
  }
};

// --- 4. Live Voice Chat (Realtime - Multi-purpose) ---

interface LiveSessionOptions {
    systemInstruction: string;
    tools?: Tool[];
    onToolCall?: (name: string, args: any) => Promise<any>;
}

export class LiveVoiceSession {
    private ai = getAiClient();
    private inputContext: AudioContext | null = null;
    private outputContext: AudioContext | null = null;
    private session: any = null;
    private nextStartTime = 0;
    private currentSources = new Set<AudioBufferSourceNode>();
    private isMuted = true; 
    private cleanup: (() => void) | null = null;
    
    // Buffers for transcription
    private currentInputTranscription = "";
    private currentOutputTranscription = "";

    constructor(
        private onAiSpeaking: (speaking: boolean) => void,
        private onError: (msg: string) => void,
        private onTranscription?: (userText: string, aiText: string, isFinal: boolean) => void
    ) {}

    setListening(isListening: boolean) {
        this.isMuted = !isListening;
        if (isListening) {
            if (this.inputContext?.state === 'suspended') this.inputContext.resume();
            if (this.outputContext?.state === 'suspended') this.outputContext.resume();
        } else {
            this.stopAudioOutput();
        }
    }
    
    // Trigger method to force the model to recognize a user turn (as text)
    // useful for initial greetings
    sendText(text: string) {
        if (!this.session) return;
        this.session.then((s: any) => {
            // Using the low-level send method to inject a client content turn
            if (typeof s.send === 'function') {
                s.send({
                    clientContent: {
                        turns: [{
                            role: 'user',
                            parts: [{ text: text }]
                        }],
                        turnComplete: true
                    }
                });
            }
        });
    }

    // Send an image to the live context
    sendImage(base64Data: string) {
        if (!this.session) return;
        this.session.then((s: any) => {
             s.sendRealtimeInput({
                media: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            });
            // We nudge the model to acknowledge the image immediately
            this.sendText("I just sent you a photo. Look at it, describe it excitedly to the child, and then use the drawing tool to turn it into a magic scene!");
        });
    }

    private stopAudioOutput() {
        this.currentSources.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        this.currentSources.clear();
        this.nextStartTime = this.outputContext?.currentTime || 0;
        this.onAiSpeaking(false);
    }

    async connect(options: LiveSessionOptions) {
        try {
            this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.inputContext.createMediaStreamSource(stream);
            const processor = this.inputContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (this.isMuted || !this.session) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = this.floatTo16BitPCM(inputData);
                const uint8 = new Uint8Array(pcm16.buffer);
                const base64Data = this.arrayBufferToBase64(uint8);
                
                this.session.then((s: any) => {
                    s.sendRealtimeInput({
                        media: {
                            mimeType: 'audio/pcm;rate=16000',
                            data: base64Data
                        }
                    });
                });
            };

            source.connect(processor);
            processor.connect(this.inputContext.destination);

            const sessionPromise = this.ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                    },
                    systemInstruction: options.systemInstruction,
                    tools: options.tools,
                    inputAudioTranscription: {}, 
                    outputAudioTranscription: {} 
                },
                callbacks: {
                    onopen: () => { console.log("Live session connected"); },
                    onmessage: async (msg: LiveServerMessage) => {
                         // Handle Transcription
                         const serverContent = msg.serverContent;
                         if (serverContent?.outputTranscription) {
                             this.currentOutputTranscription += serverContent.outputTranscription.text;
                             this.onTranscription?.(this.currentInputTranscription, this.currentOutputTranscription, false);
                         } else if (serverContent?.inputTranscription) {
                             this.currentInputTranscription += serverContent.inputTranscription.text;
                             this.onTranscription?.(this.currentInputTranscription, this.currentOutputTranscription, false);
                         }

                         if (serverContent?.turnComplete) {
                             // Turn is complete, flush transcription
                             this.onTranscription?.(this.currentInputTranscription, this.currentOutputTranscription, true);
                             this.currentInputTranscription = "";
                             this.currentOutputTranscription = "";
                         }

                         // Handle Audio
                         const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                         if (audioData && this.outputContext) {
                             const audioBytes = this.base64ToUint8Array(audioData);
                             const audioBuffer = await this.decodeAudioData(audioBytes, this.outputContext);
                             this.playAudioBuffer(audioBuffer);
                         }

                         // Handle Tool Calls (Function Calling)
                         if (msg.toolCall && options.onToolCall) {
                            for (const fc of msg.toolCall.functionCalls) {
                                console.log("Tool call received:", fc.name, fc.args);
                                const result = await options.onToolCall(fc.name, fc.args);
                                
                                // Send result back to model
                                this.session.then((s: any) => {
                                    s.sendToolResponse({
                                        functionResponses: {
                                            id: fc.id,
                                            name: fc.name,
                                            response: { result: result } 
                                        }
                                    });
                                });
                            }
                         }
                    },
                    onclose: () => { console.log("Live session closed"); },
                    onerror: (e) => { 
                        console.error(e);
                        this.onError("Connection error. Please restart."); 
                    }
                }
            });
            
            this.session = sessionPromise;

            this.cleanup = () => {
                source.disconnect();
                processor.disconnect();
                stream.getTracks().forEach(t => t.stop());
                this.inputContext?.close();
                this.outputContext?.close();
                sessionPromise.then(s => s.close());
            };
            
        } catch (error) {
            this.onError("Microphone access denied");
            console.error(error);
        }
    }

    disconnect() {
        this.cleanup?.();
        this.session = null;
    }
    
    private floatTo16BitPCM(input: Float32Array) {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output;
    }

    private arrayBufferToBase64(buffer: Uint8Array): string {
        let binary = '';
        const len = buffer.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(buffer[i]);
        }
        return btoa(binary);
    }

    private base64ToUint8Array(base64: string) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    private async decodeAudioData(data: Uint8Array, ctx: AudioContext) {
        const dataInt16 = new Int16Array(data.buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }
        return buffer;
    }

    private playAudioBuffer(buffer: AudioBuffer) {
        if (!this.outputContext) return;
        
        this.nextStartTime = Math.max(this.nextStartTime, this.outputContext.currentTime);
        const source = this.outputContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.outputContext.destination);
        
        source.onended = () => {
            this.currentSources.delete(source);
            if (this.currentSources.size === 0) {
                this.onAiSpeaking(false);
            }
        };
        
        this.onAiSpeaking(true);
        source.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;
        this.currentSources.add(source);
    }
}

// --- 5. Story Generation (Multimodal) ---
export const generateStoryFromImage = async (base64Image: string): Promise<string> => {
  const ai = getAiClient();
  const prompt = "You are a warm, enthusiastic storyteller for a 3-year-old child. Look at this image from a picture book. Tell a short, fun story (max 3-4 simple sentences) in English based on what you see. Keep it easy to understand.";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      }
    });
    return response.text || "I couldn't see the picture well enough to tell a story.";
  } catch (e) {
    console.error(e);
    throw new Error("Story generation failed");
  }
};