import React from 'react';
import { 
  GitBranch, 
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
    <header className="sticky top-0 z-30 bg-[#0d1117]/90 backdrop-blur border-b border-[#30363d] px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#238636] flex items-center justify-center text-white">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Settlement Reconciliation</h1>
            </div>
            <p className="text-xs text-[#8b949e]">
              Bank payout matching and order reconciliation
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-xs">
            <Cpu className="w-3.5 h-3.5 text-[#8b949e]" />
            <span className="text-[#8b949e]">Provider:</span>
            {health?.is_fallback ? (
              <span className="text-[#d29922] font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 inline" /> Fallback
              </span>
            ) : (
              <span className="text-[#3fb950] font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 inline" /> {health?.provider || 'Active'}
              </span>
            )}
          </div>

          <button
            onClick={onRegenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-xs font-medium text-[#c9d1d9] transition-colors disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5 text-[#8b949e]" />
            <span>Reset Data</span>
          </button>

          <button
            onClick={onOpenEval}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-xs font-medium text-[#c9d1d9] transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#58a6ff]" />
            <span>Report</span>
          </button>

          <button
            onClick={onReconcile}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-xs font-semibold text-white transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Reconciling...' : 'Run Reconciliation'}</span>
          </button>

          <button
            onClick={onToggleChat}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isChatOpen 
                ? 'bg-[#1f6feb] text-white border-[#58a6ff]' 
                : 'bg-[#21262d] hover:bg-[#30363d] border-[#30363d] text-[#c9d1d9]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
        </div>

      </div>
    </header>
  );
}
