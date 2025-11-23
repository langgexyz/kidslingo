
export enum AppTab {
  DRAW = 'draw',
  CHAT = 'chat',
  STORY = 'story'
}

export interface FlashCardData {
  targetWord: string;
  nativeWord: string;
  pronunciation: string;
  simpleSentence: string;
  emoji: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export interface GeneratedImage {
  url: string;
  prompt: string;
}