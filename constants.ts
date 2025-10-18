// IMPORTANT: These URLs must be publicly accessible and have permissive CORS headers.
// Services like Google Cloud Storage or Amazon S3 are recommended.
// Google Drive links will likely NOT work due to permission restrictions.
import { SoundEffect } from './types';

export const AVAILABLE_VOICES: string[] = [
  'Kore',
  'Puck',
  'Charon',
  'Zephyr',
  'Fenrir',
  'Aura',
  'Orion',
  'Lyra',
  'Griffin',
  'Nova',
  'Caspian',
  'Seraphina',
  'Juno',
  'Atlas',
  'Helios',
  'Echo',
  'Phoenix'
];

export const AVAILABLE_SOUND_EFFECTS: { [key: string]: SoundEffect } = {
  applause: { 
    description: 'Enthusiastic audience applause', 
    url: 'https://storage.googleapis.com/genai-assets/podcast-maker/applause.wav' 
  },
  intro_music: { 
    description: 'Upbeat, modern podcast intro music', 
    url: 'https://storage.googleapis.com/genai-assets/podcast-maker/intro_music.wav' 
  },
  outro_music: { 
    description: 'Calm, reflective podcast outro music', 
    url: 'https://storage.googleapis.com/genai-assets/podcast-maker/outro_music.wav' 
  },
  sparkle: { 
    description: 'A magical, shimmering sparkle sound', 
    url: 'https://storage.googleapis.com/genai-assets/podcast-maker/sparkle.wav' 
  },
  whoosh: { 
    description: 'A fast whoosh transition sound', 
    url: 'https://storage.googleapis.com/genai-assets/podcast-maker/whoosh.wav' 
  },
  door_creak: { 
    description: 'A heavy old door creaking open', 
    url: 'https://storage.googleapis.com/genai-assets/podcast-maker/door_creak.wav' 
  },
  chime: { 
    description: 'A single, gentle, clear chime', 
    url: 'https://storage.googleapis.com/genai-assets/podcast-maker/chime.wav'
  },
  explosion: { 
    description: 'A large, distant explosion', 
    url: 'https://storage.googleapis.com/genai-assets/podcast-maker/explosion.wav' 
  },
};
