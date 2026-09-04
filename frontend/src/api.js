const API_BASE = '/api';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export async function runReconciliation() {
  const res = await fetch(`${API_BASE}/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Reconciliation failed: ${res.statusText}`);
  }
  return await res.json();
}

export async function fetchMatches(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.method) query.append('method', params.method);
  if (params.status) query.append('status', params.status);

  const res = await fetch(`${API_BASE}/matches?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch matches: ${res.statusText}`);
  }
  return await res.json();
}

export async function fetchMatchRecord(payoutId) {
  const res = await fetch(`${API_BASE}/matches/${payoutId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch match for ${payoutId}: ${res.statusText}`);
  }
  return await res.json();
}

export async function sendChatMessage(message, history = []) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.statusText}`);
  }
  return await res.json();
}

export async function fetchEvalReport() {
  const res = await fetch(`${API_BASE}/eval`);
  if (!res.ok) {
    throw new Error(`Failed to fetch evaluation report: ${res.statusText}`);
  }
  return await res.json();
}

export async function triggerDataGeneration(seed = 42) {
  const res = await fetch(`${API_BASE}/generate-data?seed=${seed}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to generate data: ${res.statusText}`);
  }
  return await res.json();
}

export async function submitManualVerdict(payoutId, { verdict, manual_order_ids, notes }) {
  const res = await fetch(`${API_BASE}/matches/${payoutId}/verdict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payout_id: payoutId, verdict, manual_order_ids, notes }),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit verdict: ${res.statusText}`);
  }
  return await res.json();
}
