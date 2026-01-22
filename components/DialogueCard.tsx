import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialogue, AppState, FeedbackResult } from '../types';
import { fetchTtsAudio, PCMPlayer, analyzeRecitation, getWordDefinition, blobToAudioBuffer, rawPcmToAudioBuffer, getSharedAudioContext } from '../services/geminiService';
import { Mic, Play, Loader2, AlertCircle, Ear, PenTool, Check, RotateCcw, BookOpen, Eye, EyeOff, Pause, Square, ChevronLeft, Volume2, Search, X, Grid2X2, Activity, RefreshCw, CheckCircle2, Hash, Award, Lightbulb, MessageSquareQuote } from 'lucide-react';
import { STORAGE_KEYS } from '../constants';

interface DialogueCardProps {
  dialogue: Dialogue;
  onStateChange: (state: AppState) => void;
  onBack?: () => void;
}

type LearningStep = 'blind' | 'dictation' | 'read' | 'recite';
type VisibilityMode = 'visible' | 'cloze' | 'hidden';

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface DiffToken {
  text: string;
  status: 'correct' | 'incorrect' | 'missing' | 'extra';
  expected?: string;
}

const getDictationDiff = (userText: string, masterText: string): { tokens: DiffToken[], score: number } => {
  const normalize = (s: string) => s.toLowerCase().replace(/[.,!?;:"()]/g, '').trim();
  const masterWords = masterText.split(/\s+/).filter(Boolean);
  const userWords = userText.split(/\s+/).filter(Boolean);
  const tokens: DiffToken[] = [];
  let masterIdx = 0;
  let userIdx = 0;
  let correctCount = 0;

  while (masterIdx < masterWords.length || userIdx < userWords.length) {
    const masterWord = masterWords[masterIdx];
    const userWord = userWords[userIdx];
    if (masterWord && userWord && normalize(masterWord) === normalize(userWord)) {
      tokens.push({ text: userWord, status: 'correct' });
      masterIdx++; userIdx++; correctCount++;
    } else if (masterWord && userWord) {
      const nextUserWord = userWords[userIdx + 1];
      const nextMasterWord = masterWords[masterIdx + 1];
      if (nextUserWord && normalize(masterWord) === normalize(nextUserWord)) {
        tokens.push({ text: userWord, status: 'extra' }); userIdx++;
      } else if (nextMasterWord && normalize(nextMasterWord) === normalize(userWord)) {
        tokens.push({ text: '', status: 'missing', expected: masterWord }); masterIdx++;
      } else {
        tokens.push({ text: userWord, status: 'incorrect', expected: masterWord }); masterIdx++; userIdx++;
      }
    } else if (masterWord) {
      tokens.push({ text: '', status: 'missing', expected: masterWord }); masterIdx++;
    } else if (userWord) {
      tokens.push({ text: userWord, status: 'extra' }); userIdx++;
    }
  }
  return { tokens, score: Math.round((correctCount / Math.max(1, masterWords.length)) * 100) };
};

const WaveformVisualizer: React.FC<{ buffer: AudioBuffer | null, color: string, label: string, height?: number }> = ({ buffer, color, label, height = 64 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(buffer.duration * 50, 300);
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, width, height);
    ctx.beginPath(); ctx.strokeStyle = '#334155'; ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    const rawData = buffer.getChannelData(0); const step = Math.ceil(rawData.length / width); const amp = height / 2;
    ctx.fillStyle = color;
    for (let i = 0; i < width; i++) {
      let min = 1.0; let max = -1.0;
      for (let j = 0; j < step; j++) {
        const index = (i * step) + j; if (index >= rawData.length) break;
        const datum = rawData[index]; if (datum < min) min = datum; if (datum > max) max = datum;
      }
      const h = Math.max(1, (max - min) * amp);
      if (h > 1) ctx.fillRect(i, (height/2) - (h/2), 2, h);
    }
  }, [buffer, color, height]);
  return !buffer ? (
    <div className="w-full bg-slate-900 border border-dashed border-slate-800 rounded-lg flex items-center justify-center" style={{ height: `${height}px` }}>
      <span className="text-xs text-slate-500 font-medium">No audio data</span>
    </div>
  ) : (
    <div className="relative overflow-x-auto no-scrollbar rounded-lg border border-slate-800 bg-slate-900">
      <div className="absolute top-1 left-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800/80 px-1 rounded z-10">{label} ({buffer.duration.toFixed(1)}s)</div>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};

export const DialogueCard: React.FC<DialogueCardProps> = ({ dialogue, onStateChange, onBack }) => {
  const [step, setStep] = useState<LearningStep>('blind');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const pcmPlayer = useRef<PCMPlayer | null>(null);
  const [referenceAudioBuffer, setReferenceAudioBuffer] = useState<AudioBuffer | null>(null);
  const [userAudioBuffer, setUserAudioBuffer] = useState<AudioBuffer | null>(null);
  const [cachedRawPcm, setCachedRawPcm] = useState<Uint8Array | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [userDictation, setUserDictation] = useState('');
  const [showDictationResult, setShowDictationResult] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('hidden');
  const [selectedWord, setSelectedWord] = useState<{ word: string, context: string, definition?: string } | null>(null);
  const [isDefining, setIsDefining] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const sessionKey = `${STORAGE_KEYS.SESSION_PREFIX}${dialogue.id}`;

  const masterText = useMemo(() => dialogue.lines.map(l => l.text).join(' '), [dialogue]);
  const wordCount = useMemo(() => masterText.split(/\s+/).filter(Boolean).length, [masterText]);
  const dictationResult = useMemo(() => showDictationResult ? getDictationDiff(userDictation, masterText) : null, [showDictationResult, userDictation, masterText]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(sessionKey);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.step) setStep(data.step);
        if (data.userDictation) setUserDictation(data.userDictation);
        if (data.visibilityMode) setVisibilityMode(data.visibilityMode);
      }
    } catch (e) {}
    pcmPlayer.current = new PCMPlayer();
    return () => { pcmPlayer.current?.stop(); pcmPlayer.current = null; };
  }, [dialogue.id, sessionKey]);

  useEffect(() => { localStorage.setItem(sessionKey, JSON.stringify({ step, userDictation, visibilityMode, timestamp: Date.now() })); }, [step, userDictation, visibilityMode, sessionKey]);

  useEffect(() => {
    if (pcmPlayer.current) pcmPlayer.current.stop();
    setAppState(AppState.IDLE); setIsPlaying(false); setAudioProgress(0); setPlaybackError(null); setShowDictationResult(false); setPlaybackSpeed(1.0); setFeedback(null);
  }, [step]);

  useEffect(() => { onStateChange(appState); }, [appState, onStateChange]);

  const loadAudioIfNeeded = async (): Promise<boolean> => {
    if (cachedRawPcm && referenceAudioBuffer) return true;
    setIsLoadingAudio(true); setPlaybackError(null);
    try {
      const fullText = dialogue.lines.map(l => l.speaker && !['Narrator', 'Text', 'Article'].includes(l.speaker) ? `${l.speaker} says: ${l.text}` : l.text).join('. ');
      const { rawPcm } = await fetchTtsAudio(fullText.trim() || "No content.");
      setCachedRawPcm(rawPcm);
      const ctx = getSharedAudioContext();
      if (pcmPlayer.current) { pcmPlayer.current.load(rawPcm); setReferenceAudioBuffer(rawPcmToAudioBuffer(rawPcm, ctx)); }
      return true;
    } catch (e: any) { setPlaybackError("Failed to fetch audio."); return false; } finally { setIsLoadingAudio(false); }
  };

  const handlePlayToggle = async () => {
    const ctx = getSharedAudioContext(); if (ctx.state === 'suspended') await ctx.resume();
    if (isPlaying) { pcmPlayer.current?.pause(); setIsPlaying(false); setAppState(AppState.IDLE); } else {
      setAppState(AppState.PLAYING_AUDIO); if (!await loadAudioIfNeeded()) { setAppState(AppState.IDLE); return; }
      try {
        await pcmPlayer.current?.play((c, d) => setAudioProgress(d > 0 ? (c / d) * 100 : 0), () => { setIsPlaying(false); setAppState(AppState.IDLE); }, step === 'blind');
        setIsPlaying(true);
      } catch (err) { setAppState(AppState.IDLE); setIsPlaying(false); }
    }
  };

  const activeLineIndex = useMemo(() => {
    if ((appState !== AppState.PLAYING_AUDIO && !isPlaying && audioProgress === 0) || audioProgress >= 99.9) return -1;
    const totalChars = dialogue.lines.reduce((sum, l) => sum + l.text.length + 5, 0);
    const currentPos = (audioProgress / 100) * totalChars;
    let acc = 0;
    return dialogue.lines.findIndex(l => {
      const start = acc; const end = acc + l.text.length + 5;
      acc = end; return currentPos >= start && currentPos <= end;
    });
  }, [audioProgress, dialogue.lines, appState, isPlaying]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAppState(AppState.ANALYZING); try { const res = await analyzeRecitation(blob, masterText); setFeedback(res); setUserAudioBuffer(await blobToAudioBuffer(blob)); } catch(e) {} finally { setAppState(AppState.IDLE); }
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.start(); setAppState(AppState.RECORDING);
    } catch (err) { alert("Mic access denied."); }
  };

  const handleWordClick = async (word: string, context: string) => {
    const clean = word.replace(/[.,!?;:"()]/g, ''); if (!clean || clean.length < 2) return;
    setSelectedWord({ word: clean, context }); setIsDefining(true);
    try { const d = await getWordDefinition(clean, context); setSelectedWord(p => p ? { ...p, definition: d } : null); } catch (e) { setSelectedWord(p => p ? { ...p, definition: "Lookup failed." } : null); } finally { setIsDefining(false); }
  };

  const ClickableText: React.FC<{ text: string }> = ({ text }) => (
    <span>{text.split(/(\s+)/).map((p, i) => p.trim() === '' ? <span key={i}>{p}</span> : <span key={i} onClick={(e) => { e.stopPropagation(); handleWordClick(p, text); }} className="cursor-pointer hover:bg-indigo-900/50 hover:text-indigo-300 rounded px-0.5 underline-offset-4 decoration-indigo-700 decoration-1">{p}</span>)}</span>
  );

  const ClozeText: React.FC<{ text: string }> = ({ text }) => (
    <span>{text.split(/(\s+)/).map((p, i) => p.trim() === '' ? p : (p.replace(/[.,!?;:"()]/g, '').length > 3 && i % 3 === 0 ? <span key={i} className="inline-block min-w-[3ch] border-b-2 border-indigo-700 text-transparent bg-indigo-900/30 rounded px-1 mx-0.5">{p}</span> : <span key={i}>{p}</span>))}</span>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between z-30">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:text-indigo-400 rounded-full transition-colors"><ChevronLeft size={24} /></button>
        <div className="text-center">
          <h2 className="font-bold text-white text-sm line-clamp-1">{dialogue.title}</h2>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{dialogue.difficulty}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 font-bold ${wordCount >= 50 && wordCount <= 70 ? 'text-emerald-400 bg-emerald-900/30 border-emerald-500/30' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>
               <Hash size={10} /> {wordCount} Words {wordCount >= 50 && wordCount <= 70 && '(Goal)'}
            </span>
          </div>
        </div>
        <div className="w-8"></div>
      </div>

      <div className="flex bg-slate-900 border-b border-slate-800 shadow-sm z-20">
        {([['blind', <Ear size={20} />, 'Blind'], ['dictation', <PenTool size={20} />, 'Dictation'], ['read', <BookOpen size={20} />, 'Read'], ['recite', <Mic size={20} />, 'Recite']] as const).map(([s, icon, label]) => (
          <button key={s} onClick={() => setStep(s)} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-all relative ${step === s ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
            <div className={`${step === s ? 'scale-110' : ''}`}>{icon}</div>
            <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
            {step === s && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full mx-4"></div>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto relative bg-slate-950">
        {step === 'blind' && (
          <div className="flex flex-col min-h-full pb-20">
            <div className="p-6 md:p-8 flex flex-col items-center justify-center space-y-6 bg-slate-900 border-b border-slate-800">
               <div className="text-center space-y-2"><h3 className="text-2xl font-bold text-white">Blind Listening</h3><p className="text-slate-400 text-sm">Focus on the sounds. Text is hidden.</p></div>
               <div className="flex flex-col items-center gap-4 w-full max-w-md">
                 <div className="flex items-center gap-4">
                    <button onClick={() => pcmPlayer.current?.seek(Math.max(0, pcmPlayer.current.getCurrentTime() - 10))} className="p-3 text-slate-400 hover:text-white"><RotateCcw size={24} /></button>
                    <button onClick={handlePlayToggle} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-slate-800 border-2 border-indigo-500 text-indigo-400' : 'bg-indigo-600 text-white'}`}>{isLoadingAudio ? <Loader2 className="animate-spin" size={36} /> : isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" className="ml-2" />}</button>
                    <div className="w-12"></div>
                 </div>
                 <input type="range" value={audioProgress} onChange={(e) => { const p = parseFloat(e.target.value); setAudioProgress(p); pcmPlayer.current?.seek((p/100) * pcmPlayer.current.getDuration()); }} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
               </div>
            </div>
            <div className="flex-1 p-4 space-y-6 max-w-2xl mx-auto w-full">
               {dialogue.lines.map((l, i) => (
                 <div key={i} className={`transition-all duration-500 border-l-4 p-6 rounded-2xl ${activeLineIndex === i ? 'border-indigo-500 bg-slate-800 shadow-xl' : 'border-transparent bg-slate-800/40 opacity-60'}`}>
                    {l.speaker && !['Narrator', 'Text', 'Article'].includes(l.speaker) && <div className="text-xs font-bold mb-2 uppercase text-slate-500">{l.speaker}</div>}
                    <p className={`text-lg md:text-xl leading-loose font-medium text-slate-200 blur-[6px] select-none ${activeLineIndex === i ? 'blur-[4px]' : ''}`}>{l.text}</p>
                 </div>
               ))}
            </div>
          </div>
        )}

        {step === 'dictation' && (
          <div className="p-6 pb-24 space-y-6 max-w-2xl mx-auto min-h-full">
             <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
               <div className="flex items-center justify-between">
                 <div><h3 className="font-bold text-white text-lg">Audio Dictation</h3><p className="text-xs text-slate-500">Transcribe what you hear.</p></div>
                 <div className="flex gap-1 bg-slate-950/50 rounded-xl p-1 border border-slate-800">
                   {[0.75, 1.0].map(r => <button key={r} onClick={() => { setPlaybackSpeed(r); pcmPlayer.current?.setRate(r); }} className={`text-[10px] font-black px-3 py-1.5 rounded-lg ${playbackSpeed === r ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{r}x</button>)}
                 </div>
               </div>
               <div className="flex items-center gap-4">
                 <button onClick={handlePlayToggle} className={`w-14 h-14 rounded-full flex items-center justify-center ${isPlaying ? 'bg-indigo-500/20 text-indigo-400 ring-2 ring-indigo-500/50' : 'bg-indigo-600 text-white'}`}>{isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}</button>
                 <div className="flex-1"><input type="range" value={audioProgress} className="w-full h-2 bg-slate-800 rounded-lg accent-indigo-500" readOnly /></div>
               </div>
             </div>
             {!showDictationResult ? (
               <textarea value={userDictation} onChange={(e) => setUserDictation(e.target.value)} placeholder="Type exactly..." className="w-full h-80 p-6 rounded-3xl border border-slate-300 text-slate-900 bg-white shadow-2xl outline-none focus:border-indigo-500 transition-all text-lg leading-relaxed font-medium" />
             ) : (
               <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl animate-in zoom-in-95">
                 <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
                   <h4 className="font-black text-white text-sm uppercase tracking-wider">Analysis: {dictationResult?.score}% Accurate</h4>
                 </div>
                 <div className="flex flex-wrap gap-x-2 gap-y-4 leading-relaxed">
                   {dictationResult?.tokens.map((t, i) => t.status === 'correct' ? <span key={i} className="text-lg text-slate-200">{t.text}</span> : (t.status === 'missing' ? <span key={i} className="text-emerald-400 bg-emerald-900/30 px-1 rounded border border-emerald-500/30">{t.expected}</span> : <span key={i} className="text-red-400 bg-red-400/10 px-1 rounded border border-red-400/20 line-through">{t.text}</span>))}
                 </div>
               </div>
             )}
             <button onClick={() => setShowDictationResult(!showDictationResult)} className={`w-full py-4 rounded-2xl font-bold ${showDictationResult ? 'bg-slate-800 text-slate-300' : 'bg-indigo-600 text-white'}`}>{showDictationResult ? 'Back to Editor' : 'Check Errors'}</button>
          </div>
        )}

        {(step === 'read' || step === 'recite') && (
          <div className="p-6 pb-20 space-y-6 max-w-2xl mx-auto min-h-full">
            {step === 'read' && (
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                 <WaveformVisualizer buffer={referenceAudioBuffer} color="#6366f1" label="Target" />
                 <WaveformVisualizer buffer={userAudioBuffer} color="#f43f5e" label="You" />
              </div>
            )}

            {step === 'recite' && (
              <div className="text-center mb-6">
                <h3 className="font-bold text-white text-2xl">Accuracy Challenge</h3>
                <p className="text-slate-500 text-sm">Target: {wordCount} Words (Aiming for 50-70 total)</p>
                {feedback && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                     <div className="bg-indigo-600/20 text-indigo-400 px-4 py-1.5 rounded-full border border-indigo-500/30 flex items-center gap-2">
                        <Award size={16} /> <span className="font-bold">Score: {feedback.score}%</span>
                     </div>
                     <div className="bg-emerald-600/20 text-emerald-400 px-4 py-1.5 rounded-full border border-emerald-500/30 flex items-center gap-2">
                        <Hash size={16} /> <span className="font-bold">{feedback.transcription.split(/\s+/).filter(Boolean).length} / {wordCount} Words</span>
                     </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              {step === 'recite' && (
                <div className="absolute right-2 top-2 z-10 bg-slate-800/90 rounded-xl flex p-1 border border-slate-700">
                   {(['visible', 'cloze', 'hidden'] as VisibilityMode[]).map(m => (
                     <button key={m} onClick={() => setVisibilityMode(m)} className={`p-2 rounded-lg transition-colors ${visibilityMode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                       {m === 'visible' ? <Eye size={18} /> : (m === 'cloze' ? <Grid2X2 size={18} /> : <EyeOff size={18} />)}
                     </button>
                   ))}
                </div>
              )}
              
              <div className={`space-y-6 bg-slate-900 p-8 rounded-3xl border border-slate-800 transition-all duration-500 ${step === 'recite' && visibilityMode === 'hidden' ? 'blur-2xl opacity-20 select-none' : ''}`}>
                {dialogue.lines.map((l, i) => (
                  <p key={i} className="text-xl text-slate-200 leading-relaxed font-medium">
                    {step === 'recite' && visibilityMode === 'cloze' ? <ClozeText text={l.text} /> : <ClickableText text={l.text} />}
                  </p>
                ))}
              </div>
              
              {step === 'recite' && visibilityMode === 'hidden' && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-slate-900/80 backdrop-blur-sm px-6 py-3 rounded-2xl border border-slate-700 flex items-center gap-3 text-slate-400 shadow-2xl">
                       <EyeOff size={20} />
                       <span className="font-bold text-sm tracking-wide">RECITING FROM MEMORY</span>
                    </div>
                 </div>
              )}
            </div>

            {feedback && (
              <div className="space-y-4 animate-in slide-in-from-bottom-4">
                <div className="bg-indigo-900/20 border border-indigo-500/20 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3 text-indigo-400 font-bold uppercase text-xs tracking-widest">
                    <MessageSquareQuote size={16} /> Transcription
                  </div>
                  <p className="text-slate-300 italic text-sm leading-relaxed">"{feedback.transcription}"</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
                     <div className="text-emerald-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} /> Pronunciation
                     </div>
                     <p className="text-slate-400 text-sm leading-relaxed">{feedback.pronunciationAnalysis}</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
                     <div className="text-indigo-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} /> Intonation
                     </div>
                     <p className="text-slate-400 text-sm leading-relaxed">{feedback.intonationAnalysis}</p>
                  </div>
                </div>

                <div className="bg-amber-900/10 border border-amber-500/20 p-6 rounded-3xl">
                   <div className="text-amber-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-4">
                      <Lightbulb size={16} /> Mastery Tips
                   </div>
                   <ul className="space-y-3">
                      {feedback.tips.map((tip, i) => (
                        <li key={i} className="text-slate-300 text-sm flex gap-3">
                          <span className="text-amber-500/50 font-black">0{i+1}</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                   </ul>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-4">
              {appState === AppState.RECORDING ? (
                 <button onClick={() => mediaRecorderRef.current?.stop()} className="flex flex-col items-center gap-3">
                   <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center animate-pulse shadow-xl shadow-red-900/40">
                     <Square size={28} fill="currentColor" />
                   </div>
                   <span className="text-red-500 font-bold text-sm uppercase tracking-widest">Finish</span>
                 </button>
              ) : (
                 <button onClick={startRecording} className="flex flex-col items-center gap-3 group">
                   <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-900/40 group-active:scale-95 transition-all">
                     {appState === AppState.ANALYZING ? <Loader2 className="animate-spin" size={32} /> : <Mic size={32} />}
                   </div>
                   <span className="text-indigo-400 font-bold text-sm uppercase tracking-widest">
                     {appState === AppState.ANALYZING ? 'Analyzing...' : step === 'recite' ? 'Start Reciting' : 'Start Recording'}
                   </span>
                 </button>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedWord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-8 relative w-full max-w-lg animate-in slide-in-from-bottom-full duration-500">
             <button onClick={() => setSelectedWord(null)} className="absolute right-6 top-6 text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
             <h4 className="text-3xl font-black text-white capitalize mb-6">{selectedWord.word}</h4>
             <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 min-h-[100px] flex items-center">
                {isDefining ? <div className="flex gap-3 text-slate-500 italic"><Loader2 className="animate-spin" size={20} /><span>Searching...</span></div> : <p className="text-slate-300 font-medium leading-relaxed text-lg">{selectedWord.definition || "No definition found."}</p>}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};