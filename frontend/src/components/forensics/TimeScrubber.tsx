import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause } from 'lucide-react';

interface TimeScrubberProps {
  minDate: string;
  maxDate: string;
  onRangeChange: (start: string, end: string) => void;
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({ minDate, maxDate, onRangeChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(100); // 0 to 100 percentage

  const minTime = new Date(minDate).getTime();
  const maxTime = new Date(maxDate).getTime();
  const duration = maxTime - minTime;

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 1; // 1% per tick
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    // Calculate current end time based on progress
    if (!minTime || !maxTime || duration <= 0) return;
    
    const currentEndTime = minTime + (duration * (progress / 100));
    const startStr = new Date(minTime).toISOString();
    const endStr = new Date(currentEndTime).toISOString();
    
    onRangeChange(startStr, endStr);
  }, [progress, minTime, maxTime, duration, onRangeChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProgress(Number(e.target.value));
    setIsPlaying(false);
  };

  const currentDisplayDate = duration > 0 ? new Date(minTime + (duration * (progress / 100))).toLocaleString() : '';

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-2xl bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-2xl shadow-2xl text-white flex flex-col gap-2">
      <div className="flex justify-between items-center text-xs font-mono text-slate-300">
        <span>{new Date(minDate).toLocaleString()}</span>
        <span className="font-bold text-indigo-400 bg-indigo-900/50 px-3 py-1 rounded-full border border-indigo-500/30">
          <Clock size={12} className="inline mr-1" />
          {currentDisplayDate}
        </span>
        <span>{new Date(maxDate).toLocaleString()}</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-10 h-10 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
        </button>
        
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={progress} 
          onChange={handleSliderChange}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>
    </div>
  );
};
