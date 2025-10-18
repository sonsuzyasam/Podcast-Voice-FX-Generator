import { GoogleGenAI, Modality } from '@google/genai';
import { ScriptSegment, SegmentType, SoundEffect } from '../types';
import { decodePcmAudioData, loopAndExtendAudio, fetchAndDecodeAudio, decodeDataUrlAudio, mixAudioBuffers } from './audioUtils';

const getAiClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const generateSpeech = async (text: string, voice: string): Promise<string> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('No audio data received from API for speech.');
  }
  return base64Audio;
};

// Fallback for generating custom sound effects not in our predefined list.
const generateSound = async (description: string): Promise<string> => {
  const ai = getAiClient();
  const prompt = `Generate a high-quality sound effect of: ${description}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error(`No audio data received from API for sound effect: "${description}"`);
  }
  return base64Audio;
};

const getSoundEffectAudio = async (
    soundEffect: SoundEffect | undefined,
    content: string, 
    audioContext: AudioContext
): Promise<AudioBuffer | null> => {
    if (soundEffect) {
        if (soundEffect.data) {
            return await decodeDataUrlAudio(soundEffect.data, audioContext);
        } else {
            return await fetchAndDecodeAudio(soundEffect.url, audioContext);
        }
    } else {
        console.log(`Generating custom sound effect with description: "${content}"`);
        const base64Audio = await generateSound(content.replace(/_/g, ' '));
        return await decodePcmAudioData(base64Audio, audioContext);
    }
};


export const generateSpeechForSegment = async (
  segment: ScriptSegment,
  speakerVoiceMap: Map<string, string>,
  audioContext: AudioContext,
  soundEffect?: SoundEffect,
  backgroundSoundEffect?: SoundEffect,
): Promise<AudioBuffer | null> => {
  try {
    if (segment.type === SegmentType.SPEECH) {
      if (!segment.speaker) return null;
      
      const textToGenerate = segment.content;
      const voiceToUse = speakerVoiceMap.get(segment.speaker) || 'Kore';

      let speechBuffer: AudioBuffer;
      if (textToGenerate.trim()) {
        const base64Audio = await generateSpeech(textToGenerate, voiceToUse);
        speechBuffer = await decodePcmAudioData(base64Audio, audioContext);
      } else {
        // Create a silent buffer if there's no text (e.g., for background-only lines)
        speechBuffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
      }

      if (segment.backgroundSound && backgroundSoundEffect) {
          const backgroundBuffer = await getSoundEffectAudio(backgroundSoundEffect, segment.backgroundSound, audioContext);
          if(backgroundBuffer) {
              return mixAudioBuffers(speechBuffer, backgroundBuffer, segment.backgroundVolume || 0.25, audioContext);
          }
      }

      return speechBuffer;

    } else { // SegmentType.SOUND
      const originalContent = segment.content;
      if (!originalContent.trim()) return null;
      
      const audioBuffer = await getSoundEffectAudio(soundEffect, originalContent, audioContext);
      if (!audioBuffer) return null;

      if (segment.duration && segment.duration > 0) {
        return loopAndExtendAudio(audioBuffer, segment.duration, audioContext);
      }

      return audioBuffer;
    }
  } catch (error) {
    console.error(`Failed to generate audio for segment: ${JSON.stringify(segment)}`, error);
    if (error instanceof Error && error.message.includes('No audio data')) {
      throw new Error(`Failed to generate sound: "${segment.content}". The model may not be able to create this sound.`);
    }
    throw error;
  }
};