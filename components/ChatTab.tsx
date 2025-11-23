import React, { useState, useEffect, useRef } from 'react';
import { LiveVoiceSession } from '../services/geminiService';
import { Mic, MicOff, Volume2, Loader2, Ear } from 'lucide-react';

const ChatTab: React.FC = () => {
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const sessionRef = useRef<LiveVoiceSession | null>(null);

  useEffect(() => {
    const session = new LiveVoiceSession(
        (speaking) => setIsAiSpeaking(speaking),
        (err) => setError(err)
    );
    sessionRef.current = session;

    // Companion Mode System Instruction
    const companionPrompt = `
      You are "Gemi", a friendly, invisible English tutor.
      
      Context:
      You are listening to a parent (speaking mostly Chinese) and a 3-4 year old child (learning English).
      
      Your Rule:
      - Do NOT respond to everything. Be a "sidekick".
      - LISTEN patiently.
      - INTERJECT ONLY IF:
        1. The parent asks "How do you say... in English?" or "What is this?".
        2. The parent is teaching a word and you can provide a fun sound effect or the correct pronunciation.
        3. There is a long pause and you want to offer a quick, 1-sentence fun fact in English about the topic they were discussing.
      
      Style:
      - Friendly, warm, slightly high-pitched (like a cartoon character).
      - Keep responses SHORT (under 5 seconds mostly).
    `;

    session.connect({ systemInstruction: companionPrompt }).then(() => {
        setIsReady(true);
        // Start muted by default
        session.setListening(false); 
    });

    return () => {
        session.disconnect();
    };
  }, []);

  const toggleSession = () => {
    if (!isReady) return;
    const newState = !isSessionActive;
    setIsSessionActive(newState);
    sessionRef.current?.setListening(newState);
  };

  return (
    <div className="flex flex-col h-full pb-24 bg-amber-50 relative overflow-hidden">
      <div className="p-4 bg-white/50 backdrop-blur-sm shadow-sm z-10 text-center border-b border-amber-100">
        <h1 className="text-2xl font-black text-orange-500 flex items-center justify-center gap-2">
          <Volume2 className="text-orange-400" /> 伴读小助手
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative p-4">
        {error && (
            <div className="absolute top-4 bg-red-100 text-red-600 px-4 py-2 rounded-full font-bold text-sm animate-pulse">
                {error}
            </div>
        )}

        {!isReady && !error && (
             <div className="flex flex-col items-center text-gray-400">
                <Loader2 size={48} className="animate-spin mb-2 text-amber-400" />
                <p className="font-bold">正在呼叫 Gemi...</p>
             </div>
        )}

        {isReady && (
            <div className="relative flex flex-col items-center">
                <div className={`relative transition-all duration-500 ${isSessionActive ? 'scale-100' : 'opacity-50 grayscale'}`}>
                    {isAiSpeaking && (
                        <>
                            <div className="absolute inset-0 rounded-full bg-orange-400 opacity-30 animate-ping"></div>
                            <div className="absolute -inset-6 rounded-full bg-orange-300 opacity-20 animate-pulse"></div>
                        </>
                    )}

                    {isSessionActive && !isAiSpeaking && (
                        <div className="absolute inset-0 rounded-full border-4 border-blue-300/50 animate-[ping_3s_infinite]"></div>
                    )}
                    
                    <div className={`w-56 h-56 bg-white rounded-full shadow-2xl flex items-center justify-center border-8 transition-colors duration-300 relative z-10
                        ${isAiSpeaking ? 'border-orange-400' : isSessionActive ? 'border-green-400' : 'border-gray-200'}
                    `}>
                        <span className="text-8xl filter drop-shadow-sm" role="img" aria-label="bot">
                            {isAiSpeaking ? '🦁' : isSessionActive ? '👂' : '💤'}
                        </span>
                    </div>
                </div>
                
                <div className="mt-10 text-center px-6 h-24">
                     {isSessionActive ? (
                         isAiSpeaking ? (
                            <p className="text-2xl font-black text-orange-600 animate-bounce">Gemi 正在说话...</p>
                         ) : (
                            <>
                                <p className="text-xl font-bold text-green-600 mb-2">我正在听哦...</p>
                                <p className="text-gray-500 text-sm bg-white/50 p-2 rounded-lg">妈妈继续讲绘本吧，需要我的时候直接问我！</p>
                            </>
                         )
                     ) : (
                        <>
                            <p className="text-xl font-bold text-gray-400 mb-2">Gemi 休息中</p>
                            <p className="text-gray-400 text-sm">点击下方按钮开始伴读</p>
                        </>
                     )}
                </div>
            </div>
        )}
      </div>

      <div className="p-8 flex justify-center items-center pb-12">
        <button
            onClick={toggleSession}
            disabled={!isReady}
            className={`
                flex items-center gap-3 px-8 py-4 rounded-full shadow-xl transition-all duration-200 font-black text-xl min-w-[200px] justify-center
                ${!isReady ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 
                  isSessionActive 
                    ? 'bg-red-50 text-red-500 border-2 border-red-100 hover:bg-red-100' 
                    : 'bg-blue-500 text-white hover:bg-blue-600 hover:-translate-y-1'}
            `}
        >
            {isSessionActive ? (
                <>
                    <MicOff size={24} /> 暂停伴读
                </>
            ) : (
                <>
                    <Mic size={24} /> 开启伴读
                </>
            )}
        </button>
      </div>
    </div>
  );
};

export default ChatTab;
