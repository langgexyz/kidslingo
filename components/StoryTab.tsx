import React, { useState, useRef } from 'react';
import { generateStoryFromImage, generateSpeech } from '../services/geminiService';
import { Camera, BookOpen, Play, Pause, RotateCcw, Sparkles, Upload } from 'lucide-react';

const StoryTab: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopAudio();
    setStory(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImage(base64);
      const base64Data = base64.split(',')[1];
      
      try {
        const storyText = await generateStoryFromImage(base64Data);
        setStory(storyText);
        // Pre-fetch audio
        const buffer = await generateSpeech(storyText);
        audioBufferRef.current = buffer;
        if (buffer) playAudio(buffer);
      } catch (err) {
        alert("Oops! Couldn't read the story. Try again!");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const playAudio = async (buffer: AudioBuffer) => {
    stopAudio();
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => setIsPlaying(false);
    
    sourceRef.current = source;
    source.start(0);
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else if (audioBufferRef.current) {
      playAudio(audioBufferRef.current);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 space-y-6 w-full max-w-md mx-auto h-full overflow-y-auto pb-24">
      <h1 className="text-3xl font-black text-rose-500 drop-shadow-sm flex items-center gap-2">
        <BookOpen className="text-rose-400" /> 绘本故事
      </h1>

      <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-rose-200 relative flex flex-col">
        
        {/* Image Area */}
        <div className="relative w-full h-64 bg-rose-50 flex items-center justify-center overflow-hidden">
          {!image && (
            <div className="text-center p-8">
              <BookOpen size={48} className="mx-auto text-rose-300 mb-2" />
              <p className="text-gray-500 font-bold">拍下绘本的一页<br/>我来讲故事</p>
            </div>
          )}
          {image && (
            <img src={image} alt="Story Book" className="w-full h-full object-cover" />
          )}
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-sm z-10">
              <Sparkles className="animate-spin text-rose-500 mb-2" size={40} />
              <p className="text-rose-500 font-bold animate-pulse">Thinking of a story...</p>
            </div>
          )}
        </div>

        {/* Story Content */}
        <div className="p-6 flex-1 flex flex-col">
           {story ? (
             <>
                <div className="bg-rose-50 p-4 rounded-2xl mb-6 flex-1">
                  <p className="text-lg text-rose-900 font-bold leading-relaxed font-['Nunito']">
                    {story}
                  </p>
                </div>
                
                <button 
                  onClick={togglePlay}
                  disabled={!audioBufferRef.current}
                  className={`w-full p-4 rounded-2xl font-bold text-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 
                    ${isPlaying ? 'bg-rose-100 text-rose-600' : 'bg-rose-500 text-white hover:bg-rose-600'}`}
                >
                  {isPlaying ? <><Pause fill="currentColor" /> 暂停</> : <><Play fill="currentColor" /> 听故事</>}
                </button>
             </>
           ) : (
             !loading && (
               <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-rose-500 text-white p-4 rounded-2xl font-bold text-xl shadow-lg flex items-center justify-center gap-2 hover:bg-rose-600 transition-all active:translate-y-1 mt-auto"
               >
                 <Camera /> 拍照片
               </button>
             )
           )}
        </div>
      </div>

      {/* Hidden Input & Retry Button if story exists */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange} 
      />
      
      {story && (
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="text-rose-400 font-bold flex items-center gap-2 hover:text-rose-600"
        >
          <RotateCcw size={18} /> 换一页
        </button>
      )}
    </div>
  );
};

export default StoryTab;