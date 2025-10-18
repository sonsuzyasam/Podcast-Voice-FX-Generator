import React, { useRef } from 'react';
import { SoundEffect } from '../types';

interface SoundEffectListProps {
  soundEffects: { [key: string]: SoundEffect };
  onUpload: (effectKey: string, file: File) => void;
}

const SoundEffectList: React.FC<SoundEffectListProps> = ({ soundEffects, onUpload }) => {
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const handleUploadClick = (key: string) => {
    fileInputRefs.current[key]?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(key, e.target.files[0]);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2 text-gray-300">Available Sound Effects</h3>
      <div className="text-sm text-gray-400 mb-3 space-y-1">
        <p>Use like: <code className="bg-gray-700 p-1 rounded">[sound:effect_name]</code></p>
        <p>Set duration: <code className="bg-gray-700 p-1 rounded">[sound:effect_name, 10s]</code></p>
        <p>Set background: <code className="bg-gray-700 p-1 rounded">[background:effect_name, 25%]</code></p>
      </div>
      <div className="space-y-3">
        {Object.entries(soundEffects).map(([key, effect]) => (
          <div key={key} className="flex items-center justify-between bg-gray-700 p-2 rounded-md">
            <div className="flex flex-col overflow-hidden">
              <code className="text-gray-200 font-semibold">{key}</code>
              {effect.filename && (
                <span className="text-xs text-green-400 truncate max-w-40">
                  {effect.filename}
                </span>
              )}
            </div>
            <input
              type="file"
              accept="audio/*"
              // FIX: The ref callback function must return void. Using a block body ensures this.
              ref={el => { fileInputRefs.current[key] = el; }}
              onChange={(e) => handleFileChange(e, key)}
              className="hidden"
            />
            <button
              onClick={() => handleUploadClick(key)}
              className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded transition-colors"
            >
              Upload
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SoundEffectList;