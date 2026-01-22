import React, { useState } from 'react';
import { generateStudyMaterial } from '../services/geminiService';
import { Dialogue } from '../types';
import { Wand2, Loader2, X, Plus, Star, Zap } from 'lucide-react';

interface ContentGeneratorProps {
  onClose: () => void;
  onGenerate: (dialogue: Dialogue) => void;
}

export const ContentGenerator: React.FC<ContentGeneratorProps> = ({ onClose, onGenerate }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (overrideInput?: string) => {
    const finalInput = overrideInput || input;
    if (!finalInput.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const dialogue = await generateStudyMaterial(finalInput, 'topic', 'Beginner', 'dialogue');
      onGenerate(dialogue);
      onClose();
    } catch (err: any) {
      setError(err.message === "MISSING_API_KEY" ? "请先在主页设置 API Key" : "生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wand2 className="text-indigo-400" size={20} /> 内容生成器
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">快速启动</label>
             <button 
                onClick={() => handleGenerate('Daily Recite: Master & Recite')}
                disabled={loading}
                className="w-full p-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-between group active:scale-95 transition-all shadow-xl shadow-indigo-950/20"
             >
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-white/20 rounded-lg shadow-inner">
                      <Star size={20} fill="currentColor" className="text-yellow-300" />
                   </div>
                   <div className="text-left">
                      <p className="text-sm">50-70词 精准背诵模式</p>
                      <p className="text-[10px] opacity-80 font-normal">生成 2-3 段极简生活对话，适合精准背诵</p>
                   </div>
                </div>
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="text-yellow-300" />}
             </button>
          </div>

          <div className="relative flex items-center justify-center">
             <div className="absolute inset-x-0 h-px bg-slate-800"></div>
             <span className="relative bg-slate-900 px-4 text-[10px] font-bold text-slate-600 uppercase tracking-tighter">或者自定义话题</span>
          </div>

          <div className="space-y-3">
             <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="例如：在咖啡馆、面试自我介绍..."
                className="w-full p-4 bg-slate-950 text-white rounded-2xl border border-slate-800 focus:border-indigo-500 outline-none text-sm transition-all placeholder:text-slate-600"
             />
             <button 
               onClick={() => handleGenerate()}
               disabled={loading || !input.trim()}
               className="w-full py-4 bg-slate-800 text-slate-300 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-all disabled:opacity-50"
             >
               {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
               生成自定义话题
             </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
               <p className="text-red-400 text-xs text-center font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};