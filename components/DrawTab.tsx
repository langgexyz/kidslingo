import React, { useState, useEffect, useRef } from 'react';
import { generateKidImage, LiveVoiceSession, generateSpeech } from '../services/geminiService';
import { Palette, Sparkles, RefreshCw } from 'lucide-react';
import { Type, FunctionDeclaration } from "@google/genai";
import { VoiceState } from '../App';

interface ChatMessage {
    role: 'user' | 'ai';
    text: string;
    id: string;
}

interface DrawTabProps {
    onStateChange: (state: VoiceState) => void;
}

// Random prompts for kids to keep it fresh
const SCENARIOS = [
    { text: "可以说 'Apple' 或者 'Car'！", speakText: "小朋友，我们来画画吧！你可以说 Apple，或者 Car！" },
    { text: "可以说 'Big Lion'！", speakText: "小朋友，试试说 Big Lion！大狮子！" },
    { text: "可以说 'Red Flower'！", speakText: "你可以说 Red Flower！红色的花！" },
    { text: "可以说 'Blue Bird'！", speakText: "试试说 Blue Bird！蓝色的小鸟！" },
    { text: "可以说 'Yummy Banana'！", speakText: "你可以说 Yummy Banana！好吃的香蕉！" },
    { text: "可以说 'Huge Dinosaur'！", speakText: "哇，试试说 Huge Dinosaur！大恐龙！" },
];

const DrawTab: React.FC<DrawTabProps> = ({ onStateChange }) => {
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentScenario, setCurrentScenario] = useState(SCENARIOS[0]);
  
  const sessionRef = useRef<LiveVoiceSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const introAudioCtxRef = useRef<AudioContext | null>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize Random Scenario and Speak it using AI Model
  useEffect(() => {
    const random = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    setCurrentScenario(random);

    const speakIntro = async () => {
        try {
            const buffer = await generateSpeech(random.speakText);
            if (buffer) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                introAudioCtxRef.current = ctx;
                
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(0);
            }
        } catch (e) {
            console.error("Intro speech failed", e);
        }
    };

    // Small delay to ensure component is mounted
    const timer = setTimeout(speakIntro, 500);
    
    return () => {
        clearTimeout(timer);
        if (introAudioCtxRef.current) {
            introAudioCtxRef.current.close();
            introAudioCtxRef.current = null;
        }
    };
  }, []);

  // Tool Definition
  const drawTool: FunctionDeclaration = {
    name: 'draw_kid_image',
    description: 'Draws a complete scene based on a full English visual description.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            english_prompt: { type: Type.STRING, description: 'The FULL description of the scene, including all previous objects and the new addition.' }
        },
        required: ['english_prompt']
    }
  };

  useEffect(() => {
    onStateChange('connecting');

    const session = new LiveVoiceSession(
        (speaking) => {
            onStateChange(speaking ? 'speaking' : 'listening');
        },
        (err) => {
            console.error(err);
            onStateChange('error');
        },
        (userText, aiText, isFinal) => {
            if (isFinal) {
                if (userText.trim()) {
                    setMessages(prev => [...prev, { role: 'user', text: userText, id: Date.now() + 'u' }]);
                }
                if (aiText.trim()) {
                    setMessages(prev => [...prev, { role: 'ai', text: aiText, id: Date.now() + 'a' }]);
                }
            }
        }
    );
    sessionRef.current = session;

    const magicArtistPrompt = `
      你是一位神奇的魔法画师，正在和3-4岁的小朋友一起**创作一幅完整的画**。
      
      **核心逻辑 - 场景累加**:
      1.  你必须在心中维护一个【当前场景描述】。初始为空白。
      2.  当小朋友提到一个新物体（例如 "Car"）时，不要只画这个物体！
      3.  **必须**将新物体**融合**到【当前场景描述】中。
      4.  **调用工具**时，\`english_prompt\` 参数必须包含**整个场景**的所有元素。
          - 例子：
            - 第一轮：孩子说 "Apple"。场景："One red apple on a table". -> 画图。
            - 第二轮：孩子说 "Banana"。场景："One red apple AND a yellow banana on a table". -> 画图。
            - 第三轮：孩子说 "Bird"。场景："One red apple and a yellow banana on a table, with a cute bird flying above". -> 画图。

      **行为指南**:
      1.  **入场引导 (中文)**: 连接后，请等待几秒钟（让小朋友听完界面提示音），然后热情打招呼：“你好呀！我是魔法画板。你想画什么？我们开始吧！”
      2.  **互动与确认**:
          - 听到单词后，先用中文确认，并重复英文单词。
          - 确认后，**立刻**调用 \`draw_kid_image\`。
          - 话术：“哇！是 Red Car！红色的车！我把它画到我们的画里去！”
      3.  **引导完善场景 (重要)**:
          - 画完后，不要停！根据当前画面提问，引导孩子添加更多细节。
          - 例子：“车车画好了！但是马路上空空的。车车要去哪里呢？需不需要画一个 House（房子）或者 Traffic Light（红绿灯）？”
          - 例子：“天空好蓝啊，要不要加个 Sun（太阳）或者 Cloud（云朵）？”

      **Tone**: 充满童趣，超级热情，像幼儿园老师一样鼓励孩子。总是用“我们”来指代创作过程。
    `;

    session.connect({
        systemInstruction: magicArtistPrompt,
        tools: [{ functionDeclarations: [drawTool] }],
        onToolCall: async (name, args) => {
            if (name === 'draw_kid_image') {
                setLoading(true);
                try {
                    const url = await generateKidImage(args.english_prompt);
                    setGeneratedUrl(url);
                    setLoading(false);
                    return "Image drawn. Now enthusiastically describe the NEW full scene to the child and ask what to add next to make it even better.";
                } catch (e) {
                    setLoading(false);
                    return "Failed to draw. Tell the child magic hiccuped.";
                }
            }
        }
    }).then(() => {
        onStateChange('listening');
        session.setListening(true); 
        session.sendText("System: User connected. Wait 2 seconds then greet.");
    });

    return () => {
        session.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-purple-50 relative overflow-hidden">
      
      {/* Top Area: Image Canvas - Maximized */}
      <div className="h-[60%] bg-white p-4 shadow-sm z-10 rounded-b-[3rem] flex flex-col items-center justify-center relative overflow-hidden border-b-4 border-purple-100 transition-all duration-500">
        
        <div className="w-full h-full relative flex items-center justify-center p-2">
            {generatedUrl ? (
            <img src={generatedUrl} alt="Generated" className="w-full h-full object-cover rounded-2xl shadow-inner animate-in fade-in zoom-in duration-700" />
            ) : loading ? (
            <div className="flex flex-col items-center justify-center text-purple-400">
                <div className="relative">
                    <RefreshCw size={64} className="animate-spin mb-4 text-purple-500" />
                    <Sparkles size={32} className="absolute -top-2 -right-2 text-yellow-400 animate-bounce" />
                </div>
                <p className="font-bold text-2xl animate-pulse text-purple-500">正在施展魔法...</p>
            </div>
            ) : (
            <div className="text-center text-purple-200">
                <Palette size={80} className="mx-auto mb-4 opacity-40" />
                <p className="font-bold text-xl opacity-50 transition-all duration-500">{currentScenario.text}</p>
            </div>
            )}
        </div>
        
      </div>

      {/* Bottom Area: Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth pb-24">
        {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                    px-5 py-3 rounded-3xl text-xl font-bold shadow-sm max-w-[90%]
                    ${msg.role === 'user' 
                        ? 'bg-purple-500 text-white rounded-tr-none' 
                        : 'bg-white text-gray-600 border-2 border-purple-100 rounded-tl-none'}
                `}>
                    {msg.text}
                </div>
            </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default DrawTab;