import React from 'react';
import { Speaker } from '../types';
import { AVAILABLE_VOICES } from '../constants';

interface SpeakerVoiceSelectorProps {
  speakers: Speaker[];
  onVoiceChange: (speakerName: string, newVoice: string) => void;
}

const SpeakerVoiceSelector: React.FC<SpeakerVoiceSelectorProps> = ({ speakers, onVoiceChange }) => {
  if (speakers.length === 0) {
    return (
      <div className="text-gray-400 text-sm">
        <p className="font-semibold mb-2 text-gray-300">Speaker Voices</p>
        No speakers detected. Add lines like "Host: Hello world" to the script.
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
       <p className="font-semibold text-gray-300">Speaker Voices</p>
      {speakers.map((speaker) => (
        <div key={speaker.name} className="flex items-center justify-between">
          <label htmlFor={`voice-${speaker.name}`} className="text-gray-300 font-medium">
            {speaker.name}
          </label>
          <select
            id={`voice-${speaker.name}`}
            value={speaker.voice}
            onChange={(e) => onVoiceChange(speaker.name, e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-48 p-2 transition-colors duration-200"
          >
            {AVAILABLE_VOICES.map((voice) => (
              <option key={voice} value={voice}>
                {voice}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
};

export default SpeakerVoiceSelector;