export interface DialogueLine {
  speaker: string;
  text: string;
}

export type ContentCategory = 'Daily' | 'BBC News' | 'TED Talk' | 'Interview' | 'Life Vlog';

export interface Dialogue {
  id: string;
  title: string;
  scenario: string;
  lines: DialogueLine[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  category: ContentCategory;
  duration: string; // e.g. "2 min", "5 min"
  imageUrl?: string; // New field for card background
}

export interface FeedbackResult {
  score: number; // 0-100
  transcription: string;
  pronunciationAnalysis: string;
  intonationAnalysis: string;
  tips: string[];
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  PLAYING_AUDIO = 'PLAYING_AUDIO',
}