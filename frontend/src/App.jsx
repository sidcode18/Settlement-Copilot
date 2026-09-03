import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import PayoutsTable from './components/PayoutsTable';
import ChatDrawer from './components/ChatDrawer';
import EvalModal from './components/EvalModal';
import ManualReviewModal from './components/ManualReviewModal';
import { 
  runReconciliation, 
  fetchMatches, 
  fetchHealth, 
  triggerDataGeneration 
} from './api';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [matches, setMatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialQuery, setChatInitialQuery] = useState('');
  const [isEvalOpen, setIsEvalOpen] = useState(false);
  const [reviewRecord, setReviewRecord] = useState(null);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await fetchHealth();
      setHealth(h);

      let records = await fetchMatches();
      if (records.length === 0) {
        const recRes = await runReconciliation();
        records = recRes.matches;
        setSummary(recRes.summary);
      } else {
        computeSummaryFromMatches(records);
      }
      setMatches(records);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const computeSummaryFromMatches = (records) => {
    const total = records.length;
    const det = records.filter(r => r.resolution_method === 'deterministic').length;
    const agent = records.filter(r => r.resolution_method === 'agent_subset_sum').length;
    const unres = records.filter(r => r.resolution_method === 'unresolved').length;
    const totalVal = records.reduce((acc, r) => acc + (r.payout?.amount || 0), 0);
    const unresVal = records.filter(r => r.resolution_method === 'unresolved').reduce((acc, r) => acc + (r.payout?.amount || 0), 0);

    setSummary({
      total_payouts: total,
      matched_payouts: det + agent,
      unresolved_payouts: unres,
      match_rate: total > 0 ? Number(((det + agent) / total * 100).toFixed(2)) : 0,
      deterministic_count: det,
      agent_resolved_count: agent,
      deterministic_pct: total > 0 ? Number((det / total * 100).toFixed(2)) : 0,
      agent_resolved_pct: total > 0 ? Number((agent / total * 100).toFixed(2)) : 0,
      unresolved_pct: total > 0 ? Number((unres / total * 100).toFixed(2)) : 0,
      total_settled_value: totalVal,
      unresolved_value: unresVal,
    });
  };

  const handleReconcile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runReconciliation();
      setMatches(res.matches);
      setSummary(res.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    const randomSeed = Math.floor(Math.random() * 10000);
    setLoading(true);
    setError(null);
    try {
      await triggerDataGeneration(randomSeed);
      await handleReconcile();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAskCopilot = (payoutId) => {
    setChatInitialQuery(`Why was payout ${payoutId} resolved or matched this way?`);
    setIsChatOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex flex-col antialiased">
      
      <Header
        onReconcile={handleReconcile}
        onRegenerate={handleRegenerate}
        onOpenEval={() => setIsEvalOpen(true)}
        onToggleChat={() => setIsChatOpen(prev => !prev)}
        isChatOpen={isChatOpen}
        loading={loading}
        health={health}
        summary={summary}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {error && (
          <div className="p-4 rounded-lg bg-[#f85149]/10 border border-[#f85149]/20 text-[#f85149] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-xs text-[#f85149] hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <SummaryCards summary={summary} />

        <PayoutsTable
          matches={matches}
          onAskCopilot={handleAskCopilot}
          onOpenReview={(record) => setReviewRecord(record)}
          loading={loading}
        />

      </main>

      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialQuery={chatInitialQuery}
        health={health}
      />

      <EvalModal
        isOpen={isEvalOpen}
        onClose={() => setIsEvalOpen(false)}
      />

      <ManualReviewModal
        matchRecord={reviewRecord}
        isOpen={!!reviewRecord}
        onClose={() => setReviewRecord(null)}
        onVerdictSubmitted={() => {
          fetchMatches().then(records => {
            setMatches(records);
            computeSummaryFromMatches(records);
          });
        }}
      />

    </div>
  );
}
