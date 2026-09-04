from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Payout(BaseModel):
    payout_id: str
    amount: float
    date: str
    payout_type: str
    raw_narration: str

class Order(BaseModel):
    order_id: str
    merchant_id: str
    amount: float
    order_date: str
    status: str
    fee_amount: float = 0.0

class MatchRecord(BaseModel):
    payout_id: str
    order_ids: List[str] = Field(default_factory=list)
    resolution_method: str  # 'deterministic', 'agent_subset_sum', 'unresolved'
    confidence: float
    reasoning: Optional[str] = ""
    human_verdict: Optional[str] = None  # 'approved', 'rejected', 'modified'
    ground_truth_order_ids: Optional[List[str]] = None
    created_at: Optional[str] = None
    
    # Detailed metadata for UI drill-down
    payout: Optional[Payout] = None
    matched_orders: Optional[List[Order]] = Field(default_factory=list)
    total_matched_amount: Optional[float] = 0.0
    amount_variance: Optional[float] = 0.0

class ReconcileSummary(BaseModel):
    total_payouts: int
    matched_payouts: int
    unresolved_payouts: int
    match_rate: float
    deterministic_count: int
    agent_resolved_count: int
    deterministic_pct: float
    agent_resolved_pct: float
    unresolved_pct: float
    total_settled_value: float
    unresolved_value: float
    llm_provider_active: str
    is_fallback: bool

class ReconcileResponse(BaseModel):
    status: str
    summary: ReconcileSummary
    matches: List[MatchRecord]

class ChatMessage(BaseModel):
    role: str  # 'user', 'assistant', 'system'
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = Field(default_factory=list)

class ChatResponse(BaseModel):
    reply: str
    tool_calls_made: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    suggested_followups: Optional[List[str]] = Field(default_factory=list)

class ManualVerdictRequest(BaseModel):
    payout_id: str
    verdict: str  # 'approved', 'rejected', 'manual_linked'
    manual_order_ids: Optional[List[str]] = None
    notes: Optional[str] = None

class CategoryEval(BaseModel):
    category: Optional[str] = None
    total_cases: int
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: Optional[int] = 0
    precision: float
    recall: float
    f1_score: float
    accuracy: float

class EvalReport(BaseModel):
    overall_precision: float
    overall_recall: float
    overall_f1: float
    overall_accuracy: float
    total_payouts_evaluated: int
    categories: Dict[str, CategoryEval]
    summary_notes: str

