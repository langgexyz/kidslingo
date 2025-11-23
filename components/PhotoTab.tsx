import React, { useState, useRef } from 'react';
import { analyzeImageForKids, generateSpeech } from '../services/geminiService';
import { FlashCardData } from '../types';
import { Camera, Volume2, Upload, Sparkles, RefreshCw } from 'lucide-react';

const PhotoTab: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlashCardData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setImage(base64);
      // Strip prefix for API
      const base64Data = base64.split(',')[1];
      
      try {
        const data = await analyzeImageForKids(base64Data);
        setResult(data);
        // Auto play audio on result if possible, or prep it
        playAudio(data.targetWord);
      } catch (err) {
        alert("Oops! Can't see clearly. Try another photo!");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const playAudio = async (text: string) => {
    const buffer = await generateSpeech(text);
    if (buffer) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center p-4 space-y-6 w-full max-w-md mx-auto h-full overflow-y-auto pb-24">
      <h1 className="text-3xl font-black text-orange-500 drop-shadow-sm">拍照学英语</h1>
      
      {/* Main Card Area */}
      <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-yellow-400 relative min-h-[300px] flex flex-col items-center justify-center">
        
        {!image && !loading && (
          <div className="text-center p-8">
            <div className="bg-blue-100 p-6 rounded-full inline-block mb-4 animate-bounce-slow">
              <Camera size={48} className="text-blue-500" />
            </div>
            <p className="text-gray-500 text-lg font-bold">拍一张照片<br/>看看是什么？</p>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-10">
            <div className="animate-spin text-yellow-500 mb-4">
              <RefreshCw size={48} />
            </div>
            <p className="text-xl font-bold text-yellow-600 animate-pulse">Thinking...</p>
          </div>
        )}

        {image && (
          <img src={image} alt="Uploaded" className="w-full h-64 object-cover" />
        )}

        {result && (
          <div className="p-6 w-full text-center bg-gradient-to-b from-white to-yellow-50">
            <div className="flex justify-center items-center gap-2 mb-2">
               <span className="text-6xl">{result.emoji}</span>
            </div>
            
            <h2 className="text-4xl font-black text-blue-600 mb-1">{result.targetWord}</h2>
            <p className="text-gray-400 text-lg italic mb-2">/{result.pronunciation}/</p>
            <h3 className="text-2xl font-bold text-orange-500 mb-4">{result.nativeWord}</h3>
            
            <div className="bg-orange-100 p-4 rounded-2xl mb-4">
              <p className="text-lg text-orange-800 font-bold leading-tight">"{result.simpleSentence}"</p>
            </div>

            <button 
              onClick={() => playAudio(result.targetWord + ". " + result.simpleSentence)}
              className="bg-green-400 hover:bg-green-500 text-white p-4 rounded-full shadow-lg transition-transform active:scale-90"
            >
              <Volume2 size={32} fill="currentColor" />
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4 w-full justify-center">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" // Prefer rear camera on mobile
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange} 
        />
        
        <button 
          onClick={triggerCamera}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl p-4 font-bold text-xl shadow-lg flex items-center justify-center gap-2 transition-all active:translate-y-1"
        >
          <Camera /> 拍照片
        </button>
      </div>
    </div>
  );
};

export default PhotoTab;
