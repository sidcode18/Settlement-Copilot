import os
import json
import logging
from json import JSONDecodeError
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.models import (
    MatchRecord, 
    ReconcileResponse, 
    ReconcileSummary, 
    ChatRequest, 
    ChatResponse, 
    ManualVerdictRequest,
    EvalReport
)
from backend.database import (
    init_db_if_needed,
    get_all_payouts,
    get_all_orders,
    get_all_matches,
    get_match_record,
    save_matches,
    update_human_verdict
)
from backend.deterministic_matcher import run_deterministic_matching
from backend.agent_matcher import run_agent_matching
from backend.chat_agent import execute_chat_query
from backend.llm_client import llm_client

logger = logging.getLogger("settlement_copilot")
app = FastAPI(title="Settlement Copilot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db_if_needed()
    logger.info("Database initialized.")
    if llm_client.provider:
        logger.info(f"LLM Provider: {llm_client.provider}")
    else:
        logger.warning("Running on rule-based fallback - set an API key for real agent reasoning")

@app.get("/api/health")
def health_check():
    return {
        "status": "ok", 
        "provider": llm_client.get_provider_name(), 
        "is_fallback": llm_client.is_fallback()
    }

@app.post("/reconcile", response_model=ReconcileResponse)
@app.post("/api/reconcile", response_model=ReconcileResponse)
def reconcile():
    """
    Executes full pipeline:
    1. Deterministic 1:1 exact matching
    2. Agent subset-sum & LLM validation for ambiguous / split / refund / fee cases
    3. Persists records to database
    4. Returns summary metrics
    """
    payouts = get_all_payouts()
    orders = get_all_orders()
    
    gt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ground_truth.json")
    ground_truth = {}
    if os.path.exists(gt_path):
        try:
            with open(gt_path, "r") as f:
                ground_truth = json.load(f)
        except (OSError, JSONDecodeError) as exc:
            logger.warning("Unable to load ground truth from %s: %s", gt_path, exc)

    # Step 1: Deterministic Layer
    det_matches, unresolved_payouts, remaining_orders = run_deterministic_matching(
        payouts, orders, ground_truth=ground_truth
    )
    
    # Step 2: Agent Layer
    agent_matches = run_agent_matching(
        unresolved_payouts, remaining_orders, ground_truth=ground_truth
    )
    
    all_matches = det_matches + agent_matches
    save_matches(all_matches)
    
    # Compute summary stats
    total = len(payouts)
    det_cnt = len(det_matches)
    agent_cnt = sum(1 for m in agent_matches if m.resolution_method == "agent_subset_sum")
    unresolved_cnt = sum(1 for m in agent_matches if m.resolution_method == "unresolved")
    matched_cnt = det_cnt + agent_cnt
    
    total_val = sum(p.amount for p in payouts)
    unresolved_pids = {m.payout_id for m in agent_matches if m.resolution_method == "unresolved"}
    unresolved_val = sum(p.amount for p in payouts if p.payout_id in unresolved_pids)
    
    summary = ReconcileSummary(
        total_payouts=total,
        matched_payouts=matched_cnt,
        unresolved_payouts=unresolved_cnt,
        match_rate=round((matched_cnt / total) * 100, 2) if total else 0.0,
        deterministic_count=det_cnt,
        agent_resolved_count=agent_cnt,
        deterministic_pct=round((det_cnt / total) * 100, 2) if total else 0.0,
        agent_resolved_pct=round((agent_cnt / total) * 100, 2) if total else 0.0,
        unresolved_pct=round((unresolved_cnt / total) * 100, 2) if total else 0.0,
        total_settled_value=round(total_val, 2),
        unresolved_value=round(unresolved_val, 2),
        llm_provider_active=llm_client.get_provider_name(),
        is_fallback=llm_client.is_fallback()
    )
    
    full_match_records = get_all_matches()
    return ReconcileResponse(
        status="success",
        summary=summary,
        matches=full_match_records
    )

@app.get("/matches", response_model=List[MatchRecord])
@app.get("/api/matches", response_model=List[MatchRecord])
def get_matches(
    search: Optional[str] = Query(None, description="Search term for payout, orders, narration"),
    method: Optional[str] = Query(None, description="Filter by resolution_method"),
    status: Optional[str] = Query(None, description="Filter by reconciled or unresolved")
):
    return get_all_matches(search=search, method=method, status=status)

@app.get("/matches/{payout_id}", response_model=MatchRecord)
@app.get("/api/matches/{payout_id}", response_model=MatchRecord)
def get_single_match(payout_id: str):
    record = get_match_record(payout_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Match record for {payout_id} not found.")
    return record

@app.post("/chat", response_model=ChatResponse)
@app.post("/api/chat", response_model=ChatResponse)
def chat_with_copilot(req: ChatRequest):
    try:
        history_dict = [m.model_dump() for m in (req.history or [])]
        reply, tool_calls, followups = execute_chat_query(req.message, history_dict)
        return ChatResponse(
            reply=reply,
            tool_calls_made=tool_calls,
            suggested_followups=followups
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/matches/{payout_id}/verdict")
def update_verdict(payout_id: str, req: ManualVerdictRequest):
    success = update_human_verdict(
        payout_id=payout_id,
        verdict=req.verdict,
        manual_order_ids=req.manual_order_ids,
        notes=req.notes
    )
    if not success:
        raise HTTPException(status_code=404, detail="Payout record not found.")
    return {"status": "success", "message": f"Updated verdict for {payout_id} to '{req.verdict}'."}

@app.post("/api/generate-data")
def trigger_generate_data(seed: int = 42):
    import subprocess
    cmd = ["python3", "generate_data.py", "--seed", str(seed)]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Data generation failed: {res.stderr}")
    return {"status": "success", "message": f"Synthetic data regenerated with seed {seed}.", "stdout": res.stdout}

@app.get("/api/eval", response_model=EvalReport)
def run_evaluation_api():
    from eval import run_eval
    report = run_eval(save_json=True)
    return report

@app.get("/api/payouts")
def list_payouts():
    return get_all_payouts()

@app.get("/api/orders")
def list_orders():
    return get_all_orders()

# Serve Frontend static build if available
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(
            os.path.join(frontend_dist, "index.html"),
            headers={"Cache-Control": "no-cache"},
        )
