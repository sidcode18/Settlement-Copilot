import React from 'react';
import { 
  CheckCircle2, 
  Cpu, 
  AlertOctagon, 
  TrendingUp, 
  DollarSign
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
      
      <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-[#8b949e] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#8b949e]">Match Rate</span>
          <div className="w-8 h-8 rounded bg-[#238636]/10 text-[#3fb950] flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-white">{summary.match_rate}%</div>
          <p className="text-xs text-[#8b949e] mt-0.5">
            {summary.matched_payouts} of {summary.total_payouts} payouts
          </p>
        </div>
        <div className="mt-3 w-full bg-[#21262d] rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-[#238636] h-full rounded-full transition-all duration-500" 
            style={{ width: `${summary.match_rate}%` }}
          />
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-[#8b949e] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#8b949e]">Total Value</span>
          <div className="w-8 h-8 rounded bg-[#1f6feb]/10 text-[#58a6ff] flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-white">
            {formatINR(summary.total_settled_value)}
          </div>
          <p className="text-xs text-[#8b949e] mt-0.5">
            {summary.total_payouts} transactions
          </p>
        </div>
        <div className="mt-3 text-[11px] text-[#8b949e] flex items-center gap-1">
          <span>Variance:</span>
          <span className="text-[#3fb950] font-mono">₹0.00</span>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-[#8b949e] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#8b949e]">Exact Matches</span>
          <div className="w-8 h-8 rounded bg-[#238636]/10 text-[#3fb950] flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-[#3fb950]">
            {summary.deterministic_count}
          </div>
          <p className="text-xs text-[#8b949e] mt-0.5">
            {summary.deterministic_pct}% • 100% confidence
          </p>
        </div>
        <div className="mt-3 text-[11px] text-[#8b949e]">
          Amount equality ±3 days
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-[#8b949e] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#8b949e]">Inferred</span>
          <div className="w-8 h-8 rounded bg-[#1f6feb]/10 text-[#58a6ff] flex items-center justify-center">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-[#58a6ff]">
            {summary.agent_resolved_count}
          </div>
          <p className="text-xs text-[#8b949e] mt-0.5">
            {summary.agent_resolved_pct}% • Complex cases
          </p>
        </div>
        <div className="mt-3 text-[11px] text-[#8b949e]">
          Subset-sum + validation
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[#161b22] border border-[#30363d] hover:border-[#8b949e] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#8b949e]">Unresolved</span>
          <div className="w-8 h-8 rounded bg-[#f85149]/10 text-[#f85149] flex items-center justify-center">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-[#f85149]">
            {summary.unresolved_payouts}
          </div>
          <p className="text-xs text-[#8b949e] mt-0.5">
            {summary.unresolved_pct}% ({formatINR(summary.unresolved_value)})
          </p>
        </div>
        <div className="mt-3 text-[11px] text-[#d29922] flex items-center gap-1 font-medium">
          <span>Manual review</span>
        </div>
      </div>

    </div>
  );
}
