import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  Building2, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { submitManualVerdict } from '../api';

export default function ManualReviewModal({ matchRecord, isOpen, onClose, onVerdictSubmitted }) {
  const [verdict, setVerdict] = useState('approved');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !matchRecord) return null;

  const p = matchRecord.payout;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await submitManualVerdict(matchRecord.payout_id, {
        verdict,
        notes: notes.trim() || undefined
      });
      onVerdictSubmitted();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Manual Ops Review</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          
          {/* Payout Info Summary */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-slate-200">{matchRecord.payout_id}</span>
              <span className="font-semibold text-emerald-400 text-sm">
                ₹{p?.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-slate-400 text-[11px] truncate font-mono">
              Narration: {p?.raw_narration}
            </div>
            <div className="text-slate-500 text-[11px] flex items-center gap-2">
              <span>Date: {p?.date}</span>
              <span>•</span>
              <span>Method: {matchRecord.resolution_method}</span>
            </div>
          </div>

          {/* Verdict Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Review Verdict</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVerdict('approved')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-medium transition-all ${
                  verdict === 'approved' 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm' 
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Approve Match</span>
              </button>

              <button
                type="button"
                onClick={() => setVerdict('rejected')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-medium transition-all ${
                  verdict === 'rejected' 
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm' 
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Reject / Hold</span>
              </button>
            </div>
          </div>

          {/* Notes textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Reviewer Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Verified merchant invoice BATCH-A manually with ledger coordinator."
              className="w-full p-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Save Verdict'}
          </button>
        </div>

      </div>
    </div>
  );
}
