
import React, { useState, useEffect } from 'react';
import { DIALOGUES, STORAGE_KEYS } from './constants';
import { DialogueCard } from './components/DialogueCard';
import { ContentGenerator } from './components/ContentGenerator';
import { generateContentByFilter } from './services/geminiService';
import { AppState, Dialogue, ContentCategory } from './types';
import { Sparkles, Plus, PlayCircle, Clock, Filter, Globe, Mic, Video, Tv, Coffee, Wand2, Loader2, RefreshCw, AlertCircle, Key, Settings, X } from 'lucide-react';

type Language = 'en' | 'zh';
type DifficultyFilter = 'All' | 'Beginner' | 'Intermediate' | 'Advanced';
type DurationFilter = 'All' | '< 3 min' | '3-5 min' | '> 5 min';

const App: React.FC = () => {
  const [dialogues, setDialogues] = useState<Dialogue[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DIALOGUES_LIST);
      return saved ? JSON.parse(saved) : DIALOGUES;
    } catch (e) { return DIALOGUES; }
  });

  const [activeDialogue, setActiveDialogue] = useState<Dialogue | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  
  // API Key Setup
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');
  const hasInternalKey = !!process.env.API_KEY;

  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
    return (saved as Language) || 'en';
  });
  
  const [activeCategory, setActiveCategory] = useState<ContentCategory | 'All'>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('All');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('All');

  useEffect(() => {
    const lastActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_DIALOGUE_ID);
    if (lastActiveId) {
      const found = dialogues.find(d => d.id === lastActiveId);
      if (found) setActiveDialogue(found);
    }
    // Auto show key modal if no key exists
    if (!hasInternalKey && !localStorage.getItem('GEMINI_API_KEY')) {
      setShowKeyModal(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DIALOGUES_LIST, JSON.stringify(dialogues));
  }, [dialogues]);

  useEffect(() => {
    if (activeDialogue) localStorage.setItem(STORAGE_KEYS.ACTIVE_DIALOGUE_ID, activeDialogue.id);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_DIALOGUE_ID);
  }, [activeDialogue]);

  const saveApiKey = () => {
    localStorage.setItem('GEMINI_API_KEY', tempKey);
    setShowKeyModal(false);
    window.location.reload(); // Reload to re-init services
  };

  const handleLanguageToggle = () => {
    const newLang = language === 'en' ? 'zh' : 'en';
    setLanguage(newLang);
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, newLang);
  };

  const handleNewDialogue = (newDialogue: Dialogue) => {
    setDialogues(prev => [newDialogue, ...prev]);
    setActiveDialogue(newDialogue);
  };

  const handleAutoGenerate = async () => {
    if (activeCategory === 'All') return;
    setIsAutoGenerating(true);
    try {
      const newContent = await generateContentByFilter(activeCategory, difficultyFilter, durationFilter);
      handleNewDialogue(newContent);
    } catch (e: any) {
      if (e.message === "MISSING_API_KEY") setShowKeyModal(true);
      else setGlobalError("Generation failed. Please check your API key.");
    } finally { setIsAutoGenerating(false); }
  };

  const checkDuration = (d: string, filter: DurationFilter) => {
    if (!d || filter === 'All') return true;
    const mins = parseInt(d.split(' ')[0]) || 0;
    if (filter === '< 3 min') return mins < 3;
    if (filter === '3-5 min') return mins >= 3 && mins <= 5;
    if (filter === '> 5 min') return mins > 5;
    return true;
  };

  const filteredDialogues = dialogues.filter(d => {
    const catMatch = activeCategory === 'All' || d.category === activeCategory;
    const diffMatch = difficultyFilter === 'All' || d.difficulty === difficultyFilter;
    const durMatch = checkDuration(d.duration, durationFilter);
    return catMatch && diffMatch && durMatch;
  });

  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'BBC News': return <Globe size={14} />;
      case 'TED Talk': return <Mic size={14} />;
      case 'Interview': return <Tv size={14} />;
      case 'Life Vlog': return <Video size={14} />;
      default: return <Coffee size={14} />;
    }
  };
  const categories: (ContentCategory | 'All')[] = ['All', 'BBC News', 'TED Talk', 'Interview', 'Life Vlog', 'Daily'];

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {globalError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <AlertCircle size={20} />
          <span className="text-sm font-bold">{globalError}</span>
        </div>
      )}

      {activeDialogue ? (
        <div className="fixed inset-0 z-50 bg-slate-950 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <DialogueCard dialogue={activeDialogue} onStateChange={setAppState} onBack={() => setActiveDialogue(null)} />
        </div>
      ) : (
        <div className="max-w-xl mx-auto min-h-screen flex flex-col relative pb-24">
          <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl pt-10 pb-2 px-6 border-b border-white/5">
             <div className="flex items-start justify-between mb-6">
                <div>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{todayDate}</p>
                   <h1 className="text-3xl font-extrabold text-white tracking-tight">LinguaFlow</h1>
                </div>
                <div className="flex gap-2">
                   {!hasInternalKey && (
                     <button onClick={() => setShowKeyModal(true)} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all">
                        <Key size={18} />
                     </button>
                   )}
                   <button onClick={handleLanguageToggle} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-bold text-xs flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all">
                     {language === 'en' ? '中' : 'EN'}
                   </button>
                   <button onClick={() => setIsGeneratorOpen(true)} className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-500 transition-all">
                     <Plus size={20} />
                   </button>
                </div>
             </div>

             <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6 mask-linear-fade">
               {categories.map(cat => (
                 <button key={cat} onClick={() => setActiveCategory(cat)} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeCategory === cat ? 'bg-white text-slate-900 shadow-lg scale-105' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'}`}>
                   {cat !== 'All' && getCategoryIcon(cat)}
                   {cat}
                 </button>
               ))}
             </div>

             <div className="flex items-center gap-3 py-2">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
                   <Filter size={12} className="text-slate-500" />
                   <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as DifficultyFilter)} className="bg-transparent text-xs font-bold text-slate-300 outline-none">
                      <option value="All">Any Level</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                   </select>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
                   <Clock size={12} className="text-slate-500" />
                   <select value={durationFilter} onChange={(e) => setDurationFilter(e.target.value as DurationFilter)} className="bg-transparent text-xs font-bold text-slate-300 outline-none">
                      <option value="All">Any Time</option>
                      <option value="< 3 min">&lt; 3 min</option>
                      <option value="3-5 min">3-5 min</option>
                      <option value="> 5 min">&gt; 5 min</option>
                   </select>
                </div>
             </div>
          </header>

          <div className="px-6 py-6 space-y-8">
             {filteredDialogues.length > 0 ? (
               filteredDialogues.map((d) => (
                 <div key={d.id} onClick={() => setActiveDialogue(d)} className="group relative h-[420px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 ring-1 ring-white/10">
                    {d.imageUrl && (
                      <div className="absolute inset-0">
                         <img src={d.imageUrl} alt={d.title} className="w-full h-full object-cover grayscale brightness-90 group-hover:scale-110 transition-transform duration-1000" />
                         <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90"></div>
                      </div>
                    )}
                    <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
                       <span className="px-3 py-1 bg-slate-950/50 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-wider border border-white/10 self-start flex items-center gap-1.5">
                         {getCategoryIcon(d.category)} {d.category}
                       </span>
                       <div className="space-y-6">
                          <div>
                             <h2 className="text-4xl font-black text-white leading-tight tracking-tight mb-3">{d.title}</h2>
                             <p className="text-white/80 text-sm font-medium line-clamp-2 leading-relaxed">{d.scenario}</p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/10">
                             <div className="flex items-center gap-2 text-white/70 text-xs font-bold uppercase tracking-wider mt-4">
                                <Clock size={14} /> <span>{d.duration}</span>
                             </div>
                             <div className="w-14 h-14 rounded-full bg-white text-slate-950 flex items-center justify-center mt-2 group-hover:scale-110 transition-transform shadow-xl">
                                <PlayCircle size={30} fill="currentColor" className="ml-0.5" />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
               ))
             ) : (
               <div onClick={handleAutoGenerate} className="relative h-[420px] w-full rounded-[2.5rem] overflow-hidden cursor-pointer transition-all hover:scale-[1.02] bg-slate-900 group flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-700">
                  {isAutoGenerating ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 size={48} className="text-indigo-400 animate-spin" />
                      <h3 className="text-2xl font-bold text-white">Generating...</h3>
                    </div>
                  ) : (
                    <>
                      <div className="w-20 h-20 rounded-full bg-indigo-900/30 text-indigo-400 flex items-center justify-center mb-6"><Wand2 size={36} /></div>
                      <h3 className="text-3xl font-black text-white mb-3">AI Auto-Fill</h3>
                      <p className="text-slate-400 text-sm max-w-xs mb-6">Tap to instantly generate a lesson for this category.</p>
                      <div className="px-6 py-3 rounded-full bg-indigo-600 text-white font-bold text-sm shadow-lg flex items-center gap-2"><RefreshCw size={16} /> Generate Now</div>
                    </>
                  )}
               </div>
             )}
          </div>
        </div>
      )}

      {isGeneratorOpen && <ContentGenerator onClose={() => setIsGeneratorOpen(false)} onGenerate={handleNewDialogue} />}

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl p-8 border border-slate-800 shadow-2xl animate-in zoom-in-95">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"><Key size={24} /></div>
                <h2 className="text-2xl font-black text-white">API Key Needed</h2>
             </div>
             <p className="text-slate-400 text-sm mb-6 leading-relaxed">
               This app is deployed on GitHub Pages. To use AI features, please provide your <b>Google Gemini API Key</b>. 
               It will be saved locally in your browser.
             </p>
             <input 
               type="password" 
               value={tempKey} 
               onChange={(e) => setTempKey(e.target.value)}
               placeholder="Enter your Gemini API Key..."
               className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-indigo-500 transition-all mb-6"
             />
             <div className="flex gap-3">
               <button onClick={saveApiKey} className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all">Save & Start</button>
             </div>
             <p className="text-[10px] text-slate-500 text-center mt-6 uppercase tracking-widest">Your key is never sent to any server except Google Gemini.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
