import React, { useEffect, useState } from 'react';
import { 
  X, 
  BarChart3, 
  AlertCircle, 
  RefreshCw, 
  Info,
} from 'lucide-react';
import { fetchEvalReport } from '../api';

export default function EvalModal({ isOpen, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvalReport();
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const categoryLabels = {
    standard_1to1: "Standard 1:1",
    split_multi_order: "Multi-order splits",
    refund_adjusted: "Refund adjusted",
    fee_deducted: "Fee deducted",
    ambiguous_tie_breaker: "Tie-breakers",
    unresolved_exception: "Unresolved"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0d1117]/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="px-6 py-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1f6feb]/10 text-[#58a6ff] flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Evaluation Report</h3>
              <p className="text-xs text-[#8b949e]">Precision and recall by category</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#8b949e]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#58a6ff]" />
              <span>Loading metrics...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-[#f85149]/10 border border-[#f85149]/20 text-[#f85149] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Failed to load report: {error}</span>
            </div>
          ) : report ? (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
                  <div className="text-[#8b949e] text-[11px]">Precision</div>
                  <div className="text-xl font-bold text-[#3fb950] mt-1">
                    {(report.overall_precision * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
                  <div className="text-[#8b949e] text-[11px]">Recall</div>
                  <div className="text-xl font-bold text-[#58a6ff] mt-1">
                    {(report.overall_recall * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
                  <div className="text-[#8b949e] text-[11px]">F1-Score</div>
                  <div className="text-xl font-bold text-[#c9d1d9] mt-1">
                    {(report.overall_f1 * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
                  <div className="text-[#8b949e] text-[11px]">Evaluated</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {report.total_payouts_evaluated}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#c9d1d9] uppercase tracking-wider">
                  By category
                </h4>
                <div className="rounded-lg border border-[#30363d] overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[#0d1117] text-[#8b949e] border-b border-[#30363d]">
                      <tr>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Cases</th>
                        <th className="py-2.5 px-3 text-right">Precision</th>
                        <th className="py-2.5 px-3 text-right">Recall</th>
                        <th className="py-2.5 px-3 text-right">F1</th>
                        <th className="py-2.5 px-3 text-right">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30363d] font-mono text-[11px]">
                      {Object.entries(report.categories || {}).map(([key, cat]) => (
                        <tr key={key} className="hover:bg-[#21262d]">
                          <td className="py-2.5 px-3 font-sans font-medium text-[#c9d1d9]">
                            {categoryLabels[key] || key}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[#8b949e]">{cat.total_cases}</td>
                          <td className="py-2.5 px-3 text-right text-[#3fb950]">
                            {(cat.precision * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#58a6ff]">
                            {(cat.recall * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#c9d1d9]">
                            {(cat.f1_score * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-white">
                            {(cat.accuracy * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-[#8b949e] leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#58a6ff] flex-shrink-0 mt-0.5" />
                <div>
                  Metrics reflect predictions against ground-truth labels without manual tuning.
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="px-6 py-3.5 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs font-medium transition-colors border border-[#30363d]"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
