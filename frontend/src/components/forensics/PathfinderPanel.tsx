import React, { useState } from 'react';
import { Route, MapPin, Compass, Sparkles, X, ArrowRight, RotateCcw } from 'lucide-react';

interface PathfinderPanelProps {
  onCalculatePath: (source: string, target: string) => void;
  onClear: () => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export const PathfinderPanel: React.FC<PathfinderPanelProps> = ({ 
  onCalculatePath, 
  onClear, 
  isExpanded, 
  setIsExpanded 
}) => {
  const [source, setSource] = useState('');
  const [sink, setSink] = useState('');

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (source.trim() && sink.trim()) {
      onCalculatePath(source.trim(), sink.trim());
    }
  };

  const handleClear = () => {
    setSource('');
    setSink('');
    onClear();
  };

  // Collapsed Floating Launcher (Vercel/Linear Tier Glassmorphism)
  if (!isExpanded) {
    return (
      <button 
        onClick={() => setIsExpanded(true)}
        className="group absolute top-5 left-5 z-20 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-900/95 backdrop-blur-md border border-slate-700/60 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-400 shadow-xl shadow-black/40 transition-all duration-300"
        title="Open Pathfinding Overlay"
      >
        <div className="p-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
          <Compass className="w-4 h-4" />
        </div>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-200 group-hover:text-white transition-colors duration-300">
          Pathfinder
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/80 animate-pulse" />
      </button>
    );
  }

  // Expanded Floating Glassmorphic Panel
  return (
    <div className="absolute top-5 left-5 z-20 w-80 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-2xl shadow-black/60 overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-100">
              Pathfinder Engine
            </h3>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
              Graph Flow Analysis
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsExpanded(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-all duration-300"
          title="Minimize Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Body */}
      <form onSubmit={handleCalculate} className="p-5 space-y-4">
        {/* Source Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-indigo-400" />
              Source Address
            </label>
            <span className="text-[10px] text-slate-500 font-mono">Origin</span>
          </div>
          <input 
            type="text" 
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-3.5 py-2 text-xs font-mono bg-slate-950/60 border border-slate-800 focus:border-indigo-500/80 rounded-xl text-slate-200 placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
            placeholder="0x... (e.g. Suspect Origin)"
            spellCheck={false}
          />
        </div>
        
        {/* Sink Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1.5">
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              Sink Address
            </label>
            <span className="text-[10px] text-slate-500 font-mono">Destination</span>
          </div>
          <input 
            type="text" 
            value={sink}
            onChange={(e) => setSink(e.target.value)}
            className="w-full px-3.5 py-2 text-xs font-mono bg-slate-950/60 border border-slate-800 focus:border-indigo-500/80 rounded-xl text-slate-200 placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300"
            placeholder="0x... (e.g. Exchange VASP)"
            spellCheck={false}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 pt-2">
          <button 
            type="submit"
            disabled={!source.trim() || !sink.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold tracking-tight text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-300"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            <span>Trace Shortest Path</span>
          </button>
          
          <button 
            type="button"
            onClick={handleClear}
            className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 active:scale-[0.98] rounded-xl border border-slate-800 hover:border-slate-700 transition-all duration-300"
            title="Reset Pathfinder Selection"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Footnote Guide */}
        <p className="text-[10px] leading-relaxed text-slate-400 text-center font-normal pt-1">
          Dijkstra solver will isolate the flow trail &amp; dim unlinked graph nodes.
        </p>
      </form>
    </div>
  );
};
