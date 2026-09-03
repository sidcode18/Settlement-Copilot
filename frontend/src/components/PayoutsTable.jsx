import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ArrowRight, 
  MessageSquare,
  UserCheck,
  Calendar,
  Cpu,
} from 'lucide-react';

export default function PayoutsTable({ 
  matches, 
  onAskCopilot, 
  onOpenReview, 
  loading 
}) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
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
      
      if (activeTab === 'unresolved' && m.resolution_method !== 'unresolved') return false;
      if (activeTab === 'deterministic' && m.resolution_method !== 'deterministic') return false;
      if (activeTab === 'agent' && m.resolution_method !== 'agent_subset_sum') return false;
      if (activeTab === 'split' && p.payout_type !== 'split_multi_order') return false;
      if (activeTab === 'refund_fee' && !['refund_adjusted', 'fee_deducted'].includes(p.payout_type)) return false;

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

  const tabInactive = 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]';
  const tabActiveGreen = 'bg-[#238636] text-white';
  const tabActiveRed = 'bg-[#f85149] text-white';
  const tabActiveBlue = 'bg-[#1f6feb] text-white';
  const tabActiveMuted = 'bg-[#30363d] text-white';

  return (
    <div className="bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden">
      
      <div className="p-4 sm:p-5 border-b border-[#30363d] flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'all' ? tabActiveBlue : tabInactive
            }`}
          >
            All ({matches.length})
          </button>
          
          <button
            onClick={() => setActiveTab('unresolved')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'unresolved' ? tabActiveRed : 'text-[#f85149]/90 hover:bg-[#f85149]/10'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Unresolved ({matches.filter(m => m.resolution_method === 'unresolved').length})
          </button>

          <button
            onClick={() => setActiveTab('deterministic')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'deterministic' ? tabActiveGreen : tabInactive
            }`}
          >
            Exact ({matches.filter(m => m.resolution_method === 'deterministic').length})
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'agent' ? tabActiveBlue : tabInactive
            }`}
          >
            Inferred ({matches.filter(m => m.resolution_method === 'agent_subset_sum').length})
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'split' ? tabActiveMuted : tabInactive
            }`}
          >
            Splits
          </button>

          <button
            onClick={() => setActiveTab('refund_fee')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'refund_fee' ? tabActiveMuted : tabInactive
            }`}
          >
            Refunds & Fees
          </button>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payout, order, narration..."
            className="w-full pl-9 pr-4 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-[#c9d1d9] placeholder:text-[#8b949e] focus:outline-none focus:border-[#58a6ff] transition-colors"
          />
        </div>

      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#30363d] bg-[#0d1117] text-[#8b949e] font-semibold uppercase tracking-wider">
              <th className="py-3 px-4 w-10"></th>
              <th className="py-3 px-4">Payout ID & Date</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Bank Narration</th>
              <th className="py-3 px-4">Matched Order(s)</th>
              <th className="py-3 px-4">Resolution</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363d]">
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#8b949e]">
                  No records match the current filter.
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
                        isExpanded ? 'bg-[#21262d]' : 'hover:bg-[#21262d]/50'
                      } ${isUnresolved ? 'bg-[#f85149]/5' : ''}`}
                    >
                      <td className="py-3 px-4 text-[#8b949e]">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#58a6ff]" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-[#c9d1d9]">{m.payout_id}</div>
                        <div className="text-[11px] text-[#8b949e] flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 inline" />
                          <span>{p?.date}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-white text-sm">
                          {formatINR(p?.amount)}
                        </div>
                        <span className={`inline-block px-1.5 py-0.5 mt-0.5 text-[10px] font-medium rounded ${
                          p?.payout_type === 'split_multi_order' ? 'bg-[#1f6feb]/10 text-[#58a6ff] border border-[#1f6feb]/20' :
                          p?.payout_type === 'refund_adjusted' ? 'bg-[#d29922]/10 text-[#d29922] border border-[#d29922]/20' :
                          p?.payout_type === 'fee_deducted' ? 'bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20' :
                          'bg-[#21262d] text-[#8b949e]'
                        }`}>
                          {p?.payout_type.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-mono text-[11px] text-[#c9d1d9] truncate" title={p?.raw_narration}>
                          {p?.raw_narration}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isUnresolved ? (
                          <span className="text-[#f85149] text-xs italic flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 inline" /> No match
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {m.order_ids.slice(0, 3).map(oid => (
                              <span key={oid} className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-[11px] font-mono text-[#c9d1d9]">
                                {oid}
                              </span>
                            ))}
                            {m.order_ids.length > 3 && (
                              <span className="text-[10px] text-[#8b949e] font-medium">
                                +{m.order_ids.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isDeterministic && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#238636]/10 text-[#3fb950] border border-[#238636]/20 font-medium text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Exact (100%)
                          </span>
                        )}
                        {isAgent && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1f6feb]/10 text-[#58a6ff] border border-[#1f6feb]/20 font-medium text-[11px]">
                            <Cpu className="w-3 h-3" />
                            <span>Inferred ({Math.round(m.confidence * 100)}%)</span>
                          </div>
                        )}
                        {isUnresolved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20 font-medium text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            Unresolved
                          </span>
                        )}
                        {m.human_verdict && (
                          <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#d29922]/20 text-[#d29922] text-[10px]">
                            <UserCheck className="w-2.5 h-2.5" />
                            {m.human_verdict}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onAskCopilot(m.payout_id)}
                            className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#1f6feb]/20 text-[#8b949e] hover:text-[#58a6ff] border border-[#30363d] transition-colors"
                            title="Discuss in chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenReview(m)}
                            className="px-2 py-1 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] text-[11px] font-medium transition-colors"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#0d1117] border-b border-[#30363d]">
                        <td colSpan={7} className="p-5">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                            
                            <div className="lg:col-span-7 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-[#c9d1d9] uppercase tracking-wider flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-[#58a6ff]" />
                                  Matched Orders ({m.matched_orders?.length || 0})
                                </h4>
                                {m.matched_orders?.length > 0 && (
                                  <div className="text-xs text-[#8b949e]">
                                    Sum: <span className="font-mono text-[#3fb950] font-semibold">{formatINR(m.total_matched_amount)}</span>
                                    {m.amount_variance !== 0 && (
                                      <span className="ml-2 font-mono text-[#d29922]">
                                        (Variance: {formatINR(m.amount_variance)})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {m.matched_orders && m.matched_orders.length > 0 ? (
                                <div className="rounded-lg border border-[#30363d] bg-[#161b22] overflow-hidden">
                                  <table className="w-full text-[11px]">
                                    <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#30363d]">
                                      <tr>
                                        <th className="py-2 px-3">Order ID</th>
                                        <th className="py-2 px-3">Merchant</th>
                                        <th className="py-2 px-3">Order Date</th>
                                        <th className="py-2 px-3">Status</th>
                                        <th className="py-2 px-3 text-right">Fee</th>
                                        <th className="py-2 px-3 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#30363d] font-mono">
                                      {m.matched_orders.map(ord => (
                                        <tr key={ord.order_id} className="hover:bg-[#21262d]">
                                          <td className="py-2 px-3 text-[#58a6ff]">{ord.order_id}</td>
                                          <td className="py-2 px-3 text-[#c9d1d9]">{ord.merchant_id}</td>
                                          <td className="py-2 px-3 text-[#8b949e]">{ord.order_date}</td>
                                          <td className="py-2 px-3">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-sans ${
                                              ord.status === 'paid' ? 'bg-[#238636]/10 text-[#3fb950]' :
                                              ord.status === 'partially_refunded' ? 'bg-[#d29922]/10 text-[#d29922]' :
                                              'bg-[#f85149]/10 text-[#f85149]'
                                            }`}>
                                              {ord.status}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-right text-[#8b949e]">
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
                                <div className="p-4 rounded-lg border border-dashed border-[#30363d] text-center text-[#8b949e] text-xs">
                                  No orders matched to this payout.
                                </div>
                              )}
                            </div>

                            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-[#c9d1d9] uppercase tracking-wider">
                                  Reasoning
                                </h4>
                                <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] text-[#c9d1d9] text-xs leading-relaxed">
                                  {m.reasoning ? (
                                    <p>{m.reasoning}</p>
                                  ) : isDeterministic ? (
                                    <p className="text-[#8b949e]">
                                      Exact amount match ({formatINR(p?.amount)}) with order date within ±3 days.
                                    </p>
                                  ) : (
                                    <p className="text-[#f85149]/90">
                                      No match with sufficient confidence. Flagged for review.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-[#30363d] text-xs">
                                <div className="flex items-center gap-2 text-[#8b949e]">
                                  <span>Confidence:</span>
                                  <span className="font-mono font-bold text-white">
                                    {(m.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <button
                                  onClick={() => onAskCopilot(m.payout_id)}
                                  className="flex items-center gap-1 text-[#58a6ff] hover:text-[#79c0ff] font-medium"
                                >
                                  <span>Discuss {m.payout_id}</span>
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
