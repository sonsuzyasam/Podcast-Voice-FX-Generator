
import React from 'react';
import { PlayIcon } from './icons/PlayIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface AudioPlayerProps {
  src: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  return (
    <div className="mt-6 w-full space-y-4">
      <audio controls src={src} className="w-full">
        Your browser does not support the audio element.
      </audio>
      <a
        href={src}
        download="podcast.wav"
        className="w-full px-4 py-2 text-md font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center shadow-md"
      >
        <DownloadIcon />
        Download Podcast (.wav)
      </a>
    </div>
  );
};

export default AudioPlayer;
