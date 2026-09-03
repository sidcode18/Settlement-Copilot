import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0d1117]/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden flex flex-col">
        
        <div className="px-5 py-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#58a6ff]" />
            <h3 className="text-sm font-semibold text-white">Manual Review</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          
          <div className="p-3.5 rounded-lg bg-[#0d1117] border border-[#30363d] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-[#c9d1d9]">{matchRecord.payout_id}</span>
              <span className="font-semibold text-[#3fb950] text-sm">
                ₹{p?.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-[#8b949e] text-[11px] truncate font-mono">
              {p?.raw_narration}
            </div>
            <div className="text-[#8b949e] text-[11px] flex items-center gap-2">
              <span>{p?.date}</span>
              <span>•</span>
              <span>{matchRecord.resolution_method}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#c9d1d9]">Verdict</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVerdict('approved')}
                className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-all ${
                  verdict === 'approved' 
                    ? 'bg-[#238636]/20 border-[#238636] text-[#3fb950]' 
                    : 'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-[#3fb950]" />
                <span>Approve</span>
              </button>

              <button
                type="button"
                onClick={() => setVerdict('rejected')}
                className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-all ${
                  verdict === 'rejected' 
                    ? 'bg-[#f85149]/20 border-[#f85149] text-[#f85149]' 
                    : 'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                <XCircle className="w-4 h-4 text-[#f85149]" />
                <span>Reject</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#c9d1d9]">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional review notes..."
              className="w-full p-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#c9d1d9] placeholder:text-[#8b949e] focus:outline-none focus:border-[#58a6ff] transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-[#f85149]/10 border border-[#f85149]/20 text-[#f85149] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

        </div>

        <div className="px-5 py-3.5 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs font-medium transition-colors border border-[#30363d]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
}
