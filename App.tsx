import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Speaker, ScriptSegment, SegmentType, SoundEffect } from './types';
import { AVAILABLE_VOICES, AVAILABLE_SOUND_EFFECTS } from './constants';
import { generateSpeechForSegment } from './services/geminiService';
import { concatenateAudioBuffers, audioBufferToWavBlob } from './services/audioUtils';
import SpeakerVoiceSelector from './components/SpeakerVoiceSelector';
import SoundEffectList from './components/SoundEffectList';
import AudioPlayer from './components/AudioPlayer';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

const initialScript = `Host: Welcome to the Future of AI podcast. Today, we have a special guest.
Jane: Thanks for having me! [background:intro_music, 20%] It's an exciting time for technology.
[sound:intro_music, 7s]
Host: Indeed. So, what's the latest breakthrough you've been working on?
Jane: We've just developed a new model that can understand and generate audio with incredible realism. [sound:sparkle]
Host: That sounds amazing! I can't wait to hear more.
[sound:applause, 5s]`;

export default function App() {
  const [script, setScript] = useState<string>(initialScript);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [soundEffects, setSoundEffects] = useState<{ [key: string]: SoundEffect }>(AVAILABLE_SOUND_EFFECTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);

  const parseSpeakers = useCallback((currentScript: string) => {
    const speakerRegex = /^([a-zA-Z0-9_]+):/gm;
    const matches = currentScript.match(speakerRegex);
    const uniqueSpeakers = [...new Set(matches?.map(s => s.replace(':', '')) || [])];
    
    setSpeakers(prevSpeakers => {
      const newSpeakers = [...prevSpeakers];
      const existingSpeakerNames = new Set(prevSpeakers.map(s => s.name));

      uniqueSpeakers.forEach((name, index) => {
        if (!existingSpeakerNames.has(name)) {
          newSpeakers.push({
            name,
            voice: AVAILABLE_VOICES[(index + newSpeakers.length) % AVAILABLE_VOICES.length],
          });
        }
      });

      // Filter out speakers no longer in the script
      const uniqueSpeakerSet = new Set(uniqueSpeakers);
      return newSpeakers.filter(s => uniqueSpeakerSet.has(s.name));
    });
  }, []);

  useEffect(() => {
    parseSpeakers(script);
  }, [script, parseSpeakers]);

  const handleVoiceChange = (speakerName: string, newVoice: string) => {
    setSpeakers(speakers.map(s => s.name === speakerName ? { ...s, voice: newVoice } : s));
  };

  const handleSoundEffectUpload = (effectKey: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSoundEffects(prevEffects => ({
        ...prevEffects,
        [effectKey]: { ...prevEffects[effectKey], data: dataUrl, filename: file.name }
      }));
    };
    reader.readAsDataURL(file);
  };

  const parseScript = (scriptToParse: string): ScriptSegment[] => {
    const lines = scriptToParse.split('\n').filter(line => line.trim() !== '');
    const segments: ScriptSegment[] = [];
    const soundEffectTagRegex = /\[sound:\s*([^,\]]+?)(?:,\s*(\d+)\s*s)?\s*\]/g;
    const backgroundSoundTagRegex = /\[background:\s*([^,\]]+?)(?:,\s*(\d{1,3})\s*%)?\s*\]$/;

    lines.forEach(line => {
        let currentLine = line.trim();
        const speakerMatch = currentLine.match(/^([a-zA-Z0-9_]+):\s*/);
        let speakerName: string | null = null;
        let backgroundSound: string | undefined;
        let backgroundVolume: number | undefined;

        if (speakerMatch) {
            speakerName = speakerMatch[1];
            let speechContent = currentLine.substring(speakerMatch[0].length).trim();
            const backgroundMatch = speechContent.match(backgroundSoundTagRegex);

            if (backgroundMatch) {
                backgroundSound = backgroundMatch[1].trim();
                const volumeStr = backgroundMatch[2];
                backgroundVolume = volumeStr ? parseInt(volumeStr, 10) / 100 : 0.25; // Default to 25%
                speechContent = speechContent.substring(0, backgroundMatch.index).trim();
            }
            
            currentLine = speechContent;
        }

        if (currentLine.length === 0 && !speakerName) return;

        const matches = [...currentLine.matchAll(soundEffectTagRegex)];
        let lastIndex = 0;

        matches.forEach(match => {
            const textBefore = currentLine.substring(lastIndex, match.index).trim();
            if (textBefore) {
                const currentSpeaker = speakerName || (speakers.length > 0 ? speakers[0].name : null);
                if (currentSpeaker) {
                    segments.push({ type: SegmentType.SPEECH, speaker: currentSpeaker, content: textBefore, backgroundSound, backgroundVolume });
                    // Background sound only applies to the first part of the speech
                    backgroundSound = undefined;
                    backgroundVolume = undefined;
                }
            }

            const effectName = match[1].trim();
            const durationStr = match[2];
            const duration = durationStr ? parseInt(durationStr, 10) : undefined;
            segments.push({ type: SegmentType.SOUND, content: effectName, duration });

            lastIndex = (match.index ?? 0) + match[0].length;
        });

        const textAfter = currentLine.substring(lastIndex).trim();
        if (textAfter) {
            const currentSpeaker = speakerName || (speakers.length > 0 ? speakers[0].name : null);
            if (currentSpeaker) {
                segments.push({ type: SegmentType.SPEECH, speaker: currentSpeaker, content: textAfter, backgroundSound, backgroundVolume });
            }
        } else if (matches.length === 0 && speakerName && backgroundSound) {
            // Handle lines that are just a speaker and a background tag
             segments.push({ type: SegmentType.SPEECH, speaker: speakerName, content: '', backgroundSound, backgroundVolume });
        }
    });

    return segments;
};


  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    setGenerationProgress(0);

    const segments = parseScript(script);
    if (segments.length === 0) {
      setError("Script is empty or could not be parsed.");
      setIsLoading(false);
      return;
    }
    setTotalSegments(segments.length);

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffers: AudioBuffer[] = [];
      const speakerMap = new Map<string, string>(speakers.map(s => [s.name, s.voice]));

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        const segmentSoundEffect = segment.type === SegmentType.SOUND 
            ? soundEffects[segment.content.toLowerCase().replace(/\s+/g, '_')] 
            : undefined;

        const backgroundSoundEffect = segment.backgroundSound
            ? soundEffects[segment.backgroundSound.toLowerCase().replace(/\s+/g, '_')]
            : undefined;

        const audioBuffer = await generateSpeechForSegment(segment, speakerMap, audioContext, segmentSoundEffect, backgroundSoundEffect);
        
        if (audioBuffer) {
          audioBuffers.push(audioBuffer);
        }
        setGenerationProgress(i + 1);
      }
      
      if (audioBuffers.length > 0) {
        const finalBuffer = concatenateAudioBuffers(audioBuffers, audioContext);
        const wavBlob = audioBufferToWavBlob(finalBuffer);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);
      } else {
        setError("No audio could be generated. Please check your script.");
      }

    } catch (err) {
      console.error("Error generating podcast:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const progressPercentage = useMemo(() => {
    return totalSegments > 0 ? Math.round((generationProgress / totalSegments) * 100) : 0;
  }, [generationProgress, totalSegments]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Podcast Voice & FX Generator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Craft your podcast with dynamic voices and sound effects using Gemini.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Podcast Script</h2>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Enter your script here... e.g., Host: Welcome back! [sound:applause, 5s]"
              className="w-full h-96 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200 resize-y"
            />
          </div>

          <div className="space-y-8">
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold mb-4 text-gray-200">Configuration</h2>
              <SpeakerVoiceSelector
                speakers={speakers}
                onVoiceChange={handleVoiceChange}
              />
              <SoundEffectList 
                soundEffects={soundEffects}
                onUpload={handleSoundEffectUpload}
              />
            </div>

            <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center">
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full px-6 py-3 text-lg font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-md"
              >
                {isLoading ? (
                  <>
                    <SpinnerIcon />
                    Generating... ({progressPercentage}%)
                  </>
                ) : (
                  'Generate Podcast'
                )}
              </button>

              {isLoading && (
                  <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
                      <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                  </div>
              )}

              {error && <p className="mt-4 text-red-400 text-center">{error}</p>}
              
              {audioUrl && !isLoading && (
                 <AudioPlayer src={audioUrl} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}