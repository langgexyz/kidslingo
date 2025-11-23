import React, { useState } from 'react';
import { AppTab } from './types';
import DrawTab from './components/DrawTab';
import ChatTab from './components/ChatTab';
import StoryTab from './components/StoryTab';
import { Palette, MessageCircle, BookOpen, Mic, Volume2, Loader2, Sparkles } from 'lucide-react';

export type VoiceState = 'connecting' | 'listening' | 'speaking' | 'error';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DRAW);
  // State to track the voice status specifically for the Draw Tab animation
  const [drawVoiceState, setDrawVoiceState] = useState<VoiceState>('connecting');

  return (
    <div className="h-screen w-full bg-yellow-50 flex flex-col overflow-hidden relative">
      
      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-hidden relative">
        {activeTab === AppTab.STORY && <StoryTab />}
        {activeTab === AppTab.DRAW && (
          <DrawTab onStateChange={setDrawVoiceState} />
        )}
        {activeTab === AppTab.CHAT && <ChatTab />}
      </main>

      {/* Persistent Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-yellow-100 pb-6 pt-2 px-4 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-around items-center max-w-md mx-auto">
          
          {/* 1. Story Tab (绘本) */}
          <button 
            onClick={() => setActiveTab(AppTab.STORY)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === AppTab.STORY ? '-translate-y-4 scale-110' : 'opacity-60'}`}
          >
             <div className={`p-3 rounded-full shadow-lg ${activeTab === AppTab.STORY ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <BookOpen size={24} strokeWidth={2.5} />
            </div>
            <span className={`text-[10px] font-bold ${activeTab === AppTab.STORY ? 'text-rose-500' : 'text-gray-400'}`}>
              绘本
            </span>
          </button>

          {/* 2. Draw Tab (魔法画板) */}
          <button 
            onClick={() => setActiveTab(AppTab.DRAW)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${activeTab === AppTab.DRAW ? '-translate-y-4 scale-125' : 'opacity-60'}`}
          >
             {/* Active State Animations Overlay */}
             {activeTab === AppTab.DRAW && (
                <>
                  {/* Listening Pulse */}
                  {drawVoiceState === 'listening' && (
                    <div className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-20"></div>
                  )}
                  {/* Speaking Bounce Background */}
                  {drawVoiceState === 'speaking' && (
                    <div className="absolute inset-0 rounded-full bg-pink-400 animate-pulse opacity-40"></div>
                  )}
                </>
             )}
             
             <div className={`p-3 rounded-full shadow-lg relative z-10 transition-colors duration-300 
                ${activeTab === AppTab.DRAW 
                    ? (drawVoiceState === 'speaking' ? 'bg-pink-500' : 'bg-purple-600') 
                    : 'bg-gray-100 text-gray-500'
                } text-white`}>
               
               {/* Dynamic Icon Switching based on Voice State */}
               {activeTab === AppTab.DRAW ? (
                  (() => {
                    switch (drawVoiceState) {
                      case 'connecting':
                        return <Loader2 size={24} className="animate-spin" />;
                      case 'speaking':
                        return <Volume2 size={24} className="animate-bounce" />;
                      case 'listening':
                        return <Mic size={24} />; // Stable mic implies listening
                      case 'error':
                        return <Sparkles size={24} />;
                      default:
                        return <Palette size={24} />;
                    }
                  })()
               ) : (
                 <Palette size={24} strokeWidth={2.5} />
               )}
            </div>
            <span className={`text-[10px] font-bold ${activeTab === AppTab.DRAW ? 'text-purple-600' : 'text-gray-400'}`}>
              魔法画板
            </span>
          </button>

          {/* 3. Chat Tab (旁听) */}
          <button 
            onClick={() => setActiveTab(AppTab.CHAT)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === AppTab.CHAT ? '-translate-y-4 scale-110' : 'opacity-60'}`}
          >
             <div className={`p-3 rounded-full shadow-lg ${activeTab === AppTab.CHAT ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <MessageCircle size={24} strokeWidth={2.5} />
            </div>
            <span className={`text-[10px] font-bold ${activeTab === AppTab.CHAT ? 'text-green-500' : 'text-gray-400'}`}>
              旁听
            </span>
          </button>

        </div>
      </nav>
    </div>
  );
};

export default App;