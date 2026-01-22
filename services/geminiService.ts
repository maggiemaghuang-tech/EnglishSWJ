import { GoogleGenAI, Modality, Type, GenerateContentParameters } from "@google/genai";
import { FeedbackResult, Dialogue, ContentCategory } from "../types";
import { getRandomImageForCategory, STORAGE_KEYS } from "../constants";

const getApiKey = () => {
  return process.env.API_KEY || localStorage.getItem('GEMINI_API_KEY') || '';
};

const getAiClient = () => {
  const key = getApiKey();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
};

async function safeGenerateContent(params: GenerateContentParameters, retries = 3, delay = 1500): Promise<any> {
  const ai = getAiClient();
  if (!ai) throw new Error("MISSING_API_KEY");
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    const isRateLimit = error?.status === 429 || error?.message?.includes('429');
    if (isRateLimit && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return safeGenerateContent(params, retries - 1, delay * 2);
    }
    throw error;
  }
}

let sharedAudioContext: AudioContext | null = null;
export const getSharedAudioContext = (): AudioContext => {
  if (!sharedAudioContext) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioContextClass({ sampleRate: 24000 });
  }
  return sharedAudioContext!;
};

export const blobToAudioBuffer = async (blob: Blob): Promise<AudioBuffer> => {
  const audioContext = getSharedAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
};

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64.trim().replace(/^data:audio\/\w+;base64,/, '').replace(/[\n\r\s]/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export const rawPcmToAudioBuffer = (pcmData: Uint8Array, audioContext: AudioContext, sampleRate: number = 24000): AudioBuffer => {
  const usableLength = pcmData.length - (pcmData.length % 2);
  const view = new DataView(pcmData.buffer, pcmData.byteOffset, usableLength);
  const numSamples = usableLength / 2;
  const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < numSamples; i++) channelData[i] = view.getInt16(i * 2, true) / 32768.0;
  return audioBuffer;
};

export class PCMPlayer {
  private audioContext: AudioContext = getSharedAudioContext();
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;
  private playbackRate: number = 1.0;
  private pauseOffset: number = 0;
  private startTime: number = 0;
  private onProgressCb?: (c: number, d: number) => void;
  private onEndedCb?: () => void;
  private loop: boolean = false;
  private animationFrameId: number | null = null;

  load(rawPcm: Uint8Array) { 
    this.buffer = rawPcmToAudioBuffer(rawPcm, this.audioContext); 
    this.pauseOffset = 0; 
  }
  
  setRate(rate: number) { 
    this.playbackRate = rate; 
    if (this.source) this.source.playbackRate.value = rate;
  }

  private startProgressTimer() {
    const update = () => {
      if (this.isPlaying && this.onProgressCb && this.buffer) {
        this.onProgressCb(this.getCurrentTime(), this.buffer.duration);
        this.animationFrameId = requestAnimationFrame(update);
      }
    };
    this.animationFrameId = requestAnimationFrame(update);
  }
  
  async play(onProgress?: (c: number, d: number) => void, onEnded?: () => void, loop: boolean = false) {
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    if (!this.buffer || this.isPlaying) return;
    this.onProgressCb = onProgress;
    this.onEndedCb = onEnded;
    this.loop = loop;
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.playbackRate.value = this.playbackRate;
    this.source.loop = this.loop;
    this.source.connect(this.audioContext.destination);
    this.source.onended = () => { if (!this.loop) { this.isPlaying = false; if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId); onEnded?.(); } };
    this.source.start(0, this.pauseOffset);
    this.startTime = this.audioContext.currentTime;
    this.isPlaying = true;
    this.startProgressTimer();
  }

  pause() { 
    if (!this.isPlaying) return;
    this.pauseOffset += (this.audioContext.currentTime - this.startTime) * this.playbackRate;
    this.source?.stop();
    this.source = null;
    this.isPlaying = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  stop() { 
    this.source?.stop(); 
    this.source = null;
    this.isPlaying = false; 
    this.pauseOffset = 0; 
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
  }

  seek(seconds: number) {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.pauseOffset = seconds;
    if (wasPlaying) this.play(this.onProgressCb, this.onEndedCb, this.loop);
  }

  getDuration() { return this.buffer?.duration || 0; }
  getCurrentTime() { 
    if (!this.isPlaying) return this.pauseOffset;
    let time = this.pauseOffset + (this.audioContext.currentTime - this.startTime) * this.playbackRate;
    if (this.loop && this.buffer) time = time % this.buffer.duration;
    return time;
  }
}

export const fetchTtsAudio = async (text: string): Promise<{ rawPcm: Uint8Array }> => {
  const response = await safeGenerateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } } },
  });
  return { rawPcm: decodeBase64(response.candidates[0].content.parts[0].inlineData.data) };
};

export const analyzeRecitation = async (audioBlob: Blob, referenceText: string): Promise<FeedbackResult> => {
  const reader = new FileReader();
  const base64 = await new Promise<string>(r => { reader.onloadend = () => r((reader.result as string).split(',')[1]); reader.readAsDataURL(audioBlob); });
  const response = await safeGenerateContent({
    model: "gemini-3-pro-preview",
    contents: { parts: [{ inlineData: { mimeType: audioBlob.type, data: base64 } }, { text: `Analyze pronunciation for: "${referenceText}". Return JSON: score(0-100), transcription, pronunciationAnalysis, intonationAnalysis, tips(array of 3).` }] },
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text);
};

export const generateStudyMaterial = async (input: string, mode: 'topic' | 'text', difficulty: string, contentType: string): Promise<Dialogue> => {
  const isDailyRecite = input.toLowerCase().includes("daily recite") || input.includes("每日背诵");
  
  const systemInstruction = isDailyRecite 
    ? "You are a specialized language master. Create exactly 2 or 3 VERY SHORT dialogues for memorization. The TOTAL COMBINED word count of all dialogues MUST be between 50 and 70 words. This is crucial for mastery. Use simple, high-frequency, natural English. Respond ONLY in valid JSON."
    : `Create a ${difficulty} ${contentType} about "${input}". Use natural language.`;

  const prompt = isDailyRecite 
    ? `Mastery Topic: "${input}". Provide 2-3 short dialogues. Total word count: 50-70 words. Return JSON with title, scenario, and lines.`
    : `Generate content for: "${input}". Format: JSON.`;

  const response = await safeGenerateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          scenario: { type: Type.STRING },
          lines: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { speaker: { type: Type.STRING }, text: { type: Type.STRING } }, required: ["speaker", "text"] } }
        },
        required: ["title", "scenario", "lines"]
      }
    }
  });
  const data = JSON.parse(response.text);
  return { ...data, id: `gen_${Date.now()}`, difficulty, category: isDailyRecite ? 'Daily' : 'Interview', duration: '1 min', imageUrl: getRandomImageForCategory(isDailyRecite ? 'Daily' : 'Interview') };
};

export const generateContentByFilter = async (category: ContentCategory, difficulty: string, duration: string): Promise<Dialogue> => {
  const response = await safeGenerateContent({
    model: "gemini-3-pro-preview",
    contents: `Generate a ${difficulty} ${category} lesson. JSON: title, scenario, lines.`,
    config: { responseMimeType: "application/json" }
  });
  const data = JSON.parse(response.text);
  return { ...data, id: `auto_${Date.now()}`, difficulty, category, duration, imageUrl: getRandomImageForCategory(category) };
};

export const getWordDefinition = async (word: string, context: string): Promise<string> => {
  const response = await safeGenerateContent({ model: "gemini-3-flash-preview", contents: `Definition of "${word}" in context: "${context}". Max 15 words.` });
  return response.text;
};