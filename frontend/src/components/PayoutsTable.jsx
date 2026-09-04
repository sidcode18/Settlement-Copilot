import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Sparkles, 
  AlertTriangle, 
  Layers, 
  ArrowRight, 
  ExternalLink,
  Bot,
  UserCheck,
  Percent,
  Calendar,
  Building2,
  Info
} from 'lucide-react';

export default function PayoutsTable({ 
  matches, 
  onAskCopilot, 
  onOpenReview, 
  loading 
}) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, unresolved, deterministic, agent, split, refund_fee
  const [expandedId, setExpandedId] = useState(null);

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const p = m.payout;
      if (!p) return true;
      
      // Tab filter
      if (activeTab === 'unresolved' && m.resolution_method !== 'unresolved') return false;
      if (activeTab === 'deterministic' && m.resolution_method !== 'deterministic') return false;
      if (activeTab === 'agent' && m.resolution_method !== 'agent_subset_sum') return false;
      if (activeTab === 'split' && p.payout_type !== 'split_multi_order') return false;
      if (activeTab === 'refund_fee' && !['refund_adjusted', 'fee_deducted'].includes(p.payout_type)) return false;

      // Search query
      if (search.trim()) {
        const s = search.toLowerCase();
        const inId = m.payout_id.toLowerCase().includes(s);
        const inNarration = p.raw_narration.toLowerCase().includes(s);
        const inType = p.payout_type.toLowerCase().includes(s);
        const inReason = m.reasoning && m.reasoning.toLowerCase().includes(s);
        const inOrders = m.order_ids.some(oid => oid.toLowerCase().includes(s));
        return inId || inNarration || inType || inReason || inOrders;
      }
      return true;
    });
  }, [matches, activeTab, search]);

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      
      {/* Controls Bar: Search & Filter Tabs */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'all' 
                ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            All Payouts ({matches.length})
          </button>
          
          <button
            onClick={() => setActiveTab('unresolved')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'unresolved' 
                ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20' 
                : 'text-rose-400/90 hover:bg-rose-950/30'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Exceptions Queue ({matches.filter(m => m.resolution_method === 'unresolved').length})
          </button>

          <button
            onClick={() => setActiveTab('deterministic')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'deterministic' 
                ? 'bg-emerald-600 text-white' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Deterministic ({matches.filter(m => m.resolution_method === 'deterministic').length})
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'agent' 
                ? 'bg-indigo-600 text-white' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Agent AI ({matches.filter(m => m.resolution_method === 'agent_subset_sum').length})
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'split' 
                ? 'bg-slate-700 text-white' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Multi-Order Splits
          </button>

          <button
            onClick={() => setActiveTab('refund_fee')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'refund_fee' 
                ? 'bg-slate-700 text-white' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Refunds & Fees
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payout, order, narration..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4 w-10"></th>
              <th className="py-3 px-4">Payout ID & Date</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Bank Narration</th>
              <th className="py-3 px-4">Matched Order(s)</th>
              <th className="py-3 px-4">Resolution Engine</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  No matching reconciliation records found for the selected filter.
                </td>
              </tr>
            ) : (
              filteredMatches.map((m) => {
                const isExpanded = expandedId === m.payout_id;
                const p = m.payout;
                const isUnresolved = m.resolution_method === 'unresolved';
                const isDeterministic = m.resolution_method === 'deterministic';
                const isAgent = m.resolution_method === 'agent_subset_sum';

                return (
                  <React.Fragment key={m.payout_id}>
                    <tr 
                      onClick={() => toggleExpand(m.payout_id)}
                      className={`cursor-pointer transition-colors ${
                        isExpanded ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'
                      } ${isUnresolved ? 'bg-rose-950/10' : ''}`}
                    >
                      {/* Accordion toggle */}
                      <td className="py-3 px-4 text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-sky-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>

                      {/* ID & Date */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-200">{m.payout_id}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 inline" />
                          <span>{p?.date}</span>
                        </div>
                      </td>

                      {/* Amount & Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-white text-sm">
                          {formatINR(p?.amount)}
                        </div>
                        <span className={`inline-block px-1.5 py-0.5 mt-0.5 text-[10px] font-medium rounded ${
                          p?.payout_type === 'split_multi_order' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          p?.payout_type === 'refund_adjusted' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          p?.payout_type === 'fee_deducted' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {p?.payout_type.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Narration */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-mono text-[11px] text-slate-300 truncate" title={p?.raw_narration}>
                          {p?.raw_narration}
                        </div>
                      </td>

                      {/* Matched Orders */}
                      <td className="py-3 px-4">
                        {isUnresolved ? (
                          <span className="text-rose-400 text-xs italic flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 inline" /> No match found
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {m.order_ids.slice(0, 3).map(oid => (
                              <span key={oid} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                                {oid}
                              </span>
                            ))}
                            {m.order_ids.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                +{m.order_ids.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Resolution Method & Confidence */}
                      <td className="py-3 px-4">
                        {isDeterministic && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Deterministic (100%)
                          </span>
                        )}
                        {isAgent && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium text-[11px]">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>Agent ({Math.round(m.confidence * 100)}%)</span>
                          </div>
                        )}
                        {isUnresolved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            Unresolved
                          </span>
                        )}
                        {m.human_verdict && (
                          <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                            <UserCheck className="w-2.5 h-2.5" />
                            {m.human_verdict}
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onAskCopilot(m.payout_id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-slate-400 hover:text-sky-400 border border-slate-700 transition-colors"
                            title="Investigate with AI Copilot"
                          >
                            <Bot className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenReview(m)}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium transition-colors"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Accordion Row */}
                    {isExpanded && (
                      <tr className="bg-slate-950/70 border-b border-slate-800">
                        <td colSpan={7} className="p-5">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                            
                            {/* Left: Matched Orders Breakdown Table */}
                            <div className="lg:col-span-7 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                                  Matched Internal Orders ({m.matched_orders?.length || 0})
                                </h4>
                                {m.matched_orders?.length > 0 && (
                                  <div className="text-xs text-slate-400">
                                    Ledger Sum: <span className="font-mono text-emerald-400 font-semibold">{formatINR(m.total_matched_amount)}</span>
                                    {m.amount_variance !== 0 && (
                                      <span className="ml-2 font-mono text-amber-400">
                                        (Variance: {formatINR(m.amount_variance)})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {m.matched_orders && m.matched_orders.length > 0 ? (
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                                  <table className="w-full text-[11px]">
                                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                                      <tr>
                                        <th className="py-2 px-3">Order ID</th>
                                        <th className="py-2 px-3">Merchant</th>
                                        <th className="py-2 px-3">Order Date</th>
                                        <th className="py-2 px-3">Status</th>
                                        <th className="py-2 px-3 text-right">Fee</th>
                                        <th className="py-2 px-3 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50 font-mono">
                                      {m.matched_orders.map(ord => (
                                        <tr key={ord.order_id} className="hover:bg-slate-800/40">
                                          <td className="py-2 px-3 text-sky-300">{ord.order_id}</td>
                                          <td className="py-2 px-3 text-slate-300">{ord.merchant_id}</td>
                                          <td className="py-2 px-3 text-slate-400">{ord.order_date}</td>
                                          <td className="py-2 px-3">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-sans ${
                                              ord.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                                              ord.status === 'partially_refunded' ? 'bg-amber-500/10 text-amber-400' :
                                              'bg-rose-500/10 text-rose-400'
                                            }`}>
                                              {ord.status}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-right text-slate-400">
                                            {ord.fee_amount > 0 ? formatINR(ord.fee_amount) : '₹0.00'}
                                          </td>
                                          <td className="py-2 px-3 text-right text-white font-semibold">
                                            {formatINR(ord.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                                  No internal ledger orders matched to this payout.
                                </div>
                              )}
                            </div>

                            {/* Right: Reasoning & Audit Trail */}
                            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                                  Reconciliation Audit & Reasoning
                                </h4>
                                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs leading-relaxed">
                                  {m.reasoning ? (
                                    <p>{m.reasoning}</p>
                                  ) : isDeterministic ? (
                                    <p className="text-slate-400">
                                      Resolved deterministically via exact 1:1 amount match ({formatINR(p?.amount)}) with order date proximity (±3 days). No heuristic ambiguity.
                                    </p>
                                  ) : (
                                    <p className="text-rose-400/90">
                                      Unable to match with sufficient confidence. Item logged in exceptions queue for finance operations review.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                                <div className="flex items-center gap-2 text-slate-400">
                                  <span>Confidence Score:</span>
                                  <span className="font-mono font-bold text-white">
                                    {(m.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <button
                                  onClick={() => onAskCopilot(m.payout_id)}
                                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"
                                >
                                  <span>Ask Copilot about {m.payout_id}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>

                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
