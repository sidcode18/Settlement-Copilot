import React, { useEffect, useState } from 'react';
import { 
  X, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Info,
  Award
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
    standard_1to1: "Standard 1:1 Matches",
    split_multi_order: "Split Multi-Order (2-4)",
    refund_adjusted: "Refund Adjusted (Net)",
    fee_deducted: "Fee Deducted (MDR)",
    ambiguous_tie_breaker: "Ambiguous Tie-Breakers",
    unresolved_exception: "Unresolved Exceptions"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Reconciliation Evaluation Report</h3>
              <p className="text-xs text-slate-400">Ground-truth precision & recall breakdown (eval_results.json)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <span>Computing precision and recall across all categories...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Error loading eval metrics: {error}</span>
            </div>
          ) : report ? (
            <>
              {/* Top Level Metric Badges */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Overall Precision</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {(report.overall_precision * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Overall Recall</div>
                  <div className="text-xl font-bold text-sky-400 mt-1">
                    {(report.overall_recall * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Overall F1-Score</div>
                  <div className="text-xl font-bold text-indigo-400 mt-1">
                    {(report.overall_f1 * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Total Evaluated</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {report.total_payouts_evaluated} cases
                  </div>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Performance by Settlement Category
                </h4>
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Cases</th>
                        <th className="py-2.5 px-3 text-right">Precision</th>
                        <th className="py-2.5 px-3 text-right">Recall</th>
                        <th className="py-2.5 px-3 text-right">F1-Score</th>
                        <th className="py-2.5 px-3 text-right">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {Object.entries(report.categories || {}).map(([key, cat]) => (
                        <tr key={key} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                            {categoryLabels[key] || key}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-400">{cat.total_cases}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400">
                            {(cat.precision * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-sky-400">
                            {(cat.recall * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-indigo-400">
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

              {/* Addendum & Integrity Note */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-400 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Honest Evaluation Policy:</strong> Metrics report exact predictions without synthetic over-tuning. Split multi-orders and ambiguous narration tie-breakers test combinatorial logic and LLM context extraction under realistic noise.
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
