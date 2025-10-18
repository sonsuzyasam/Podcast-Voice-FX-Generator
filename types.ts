export interface Speaker {
  name: string;
  voice: string;
}

export enum SegmentType {
  SPEECH = 'speech',
  SOUND = 'sound',
}

export interface ScriptSegment {
  type: SegmentType;
  content: string;
  speaker?: string;
  duration?: number; // in seconds
  backgroundSound?: string; // key of the sound effect
  backgroundVolume?: number; // 0.0 to 1.0
}

export interface SoundEffect {
  description: string;
  url: string; // URL to the audio file
  data?: string; // Optional field for base64 data of an uploaded file
  filename?: string; // Optional field for the name of the uploaded file
}