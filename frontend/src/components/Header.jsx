import React from 'react';
import { 
  Zap, 
  RotateCw, 
  BarChart3, 
  MessageSquare, 
  ShieldCheck, 
  AlertTriangle,
  Database,
  Cpu
} from 'lucide-react';

export default function Header({ 
  onReconcile, 
  onRegenerate, 
  onOpenEval, 
  onToggleChat, 
  isChatOpen, 
  loading,
  health,
  summary
}) {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Branding & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-700 flex items-center justify-center shadow-lg shadow-teal-900/20 text-white">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Settlement Copilot</h1>
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Track 4 • AI Finance Controller
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Autonomous multi-order split, refund & fee reconciliation engine with ops copilot
            </p>
          </div>
        </div>

        {/* Engine Status & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          
          {/* LLM Mode Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">LLM:</span>
            {health?.is_fallback ? (
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 inline" /> Fallback Mode
              </span>
            ) : (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 inline" /> {health?.provider || 'Active'}
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
            title="Generate new synthetic dataset with realistic edge cases"
          >
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Data</span>
          </button>

          <button
            onClick={onOpenEval}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            title="View ground-truth precision and recall metrics"
          >
            <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
            <span>Eval Report</span>
          </button>

          <button
            onClick={onReconcile}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-xs font-semibold text-white shadow-md shadow-teal-900/20 transition-all disabled:opacity-50 active:scale-95"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Reconciling...' : 'Run Reconciliation'}</span>
          </button>

          <button
            onClick={onToggleChat}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isChatOpen 
                ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Copilot Chat</span>
          </button>
        </div>

      </div>
    </header>
  );
}
