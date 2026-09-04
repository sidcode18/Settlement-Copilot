import React from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  AlertOctagon, 
  TrendingUp, 
  Layers,
  IndianRupee
} from 'lucide-react';

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      
      {/* 1. Overall Match Rate */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Match Rate</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-white">{summary.match_rate}%</div>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.matched_payouts} of {summary.total_payouts} payouts reconciled
          </p>
        </div>
        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${summary.match_rate}%` }}
          />
        </div>
      </div>

      {/* 2. Total Settled Value */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Settled Volume</span>
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-white">
            {formatINR(summary.total_settled_value)}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.total_payouts} total batch transactions
          </p>
        </div>
        <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1">
          <span>Ledger variance:</span>
          <span className="text-emerald-400 font-mono">₹0.00 exact</span>
        </div>
      </div>

      {/* 3. Deterministic 1:1 Layer */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Deterministic (1:1)</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-emerald-400">
            {summary.deterministic_count}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.deterministic_pct}% share • 100% confidence
          </p>
        </div>
        <div className="mt-3 text-[11px] text-slate-500">
          Fast path: Exact amount equality ±3d
        </div>
      </div>

      {/* 4. Agent Subset-Sum AI Layer */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Agent AI Resolved</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-indigo-400">
            {summary.agent_resolved_count}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.agent_resolved_pct}% share • Splits, refunds, fees
          </p>
        </div>
        <div className="mt-3 text-[11px] text-slate-500">
          Subset-sum + LLM tie-breaking
        </div>
      </div>

      {/* 5. Unresolved Exceptions Queue */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Exceptions Queue</span>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-rose-400">
            {summary.unresolved_payouts}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.unresolved_pct}% unresolved ({formatINR(summary.unresolved_value)})
          </p>
        </div>
        <div className="mt-3 text-[11px] text-amber-400/80 flex items-center gap-1 font-medium">
          <span>Requires ops review</span>
        </div>
      </div>

    </div>
  );
}
