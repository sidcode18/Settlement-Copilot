import json
import itertools
from datetime import datetime
from typing import List, Dict, Any, Tuple, Set, Optional
from backend.models import Payout, Order, MatchRecord
from backend.llm_client import llm_client

def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")

def find_subset_sum_candidates(
    payout: Payout,
    available_orders: List[Order],
    max_k: int = 4,
    tolerance: float = 5.0
) -> List[Dict[str, Any]]:
    """
    Search for plausible combinations of 1 to max_k orders that reconcile with the payout:
    1. Standard multi-order sum: sum(order.amount) ≈ payout.amount
    2. Fee-deducted sum: sum(order.amount - order.fee_amount) ≈ payout.amount
    3. Refund-adjusted single order: order.amount - refund ≈ payout.amount (order.status == 'partially_refunded')
    """
    p_amt = payout.amount
    p_date = parse_date(payout.date)
    candidates = []
    
    # Filter orders within ±10 day window of payout
    window_orders = []
    for o in available_orders:
        o_date = parse_date(o.order_date)
        delta_days = (p_date - o_date).days
        # Order should typically happen before or around payout date (-3 to +10 days)
        if -3 <= delta_days <= 10:
            window_orders.append(o)
            
    if not window_orders:
        return []

    # 1. Check Refund-adjusted (single order partial refunds)
    for o in window_orders:
        if o.status in ["partially_refunded", "refunded"] and o.amount > p_amt:
            refund_est = round(o.amount - p_amt, 2)
            # Plausible partial refund (between ₹50 and 80% of order value)
            if 50.0 <= refund_est <= (o.amount * 0.8):
                candidates.append({
                    "match_type": "refund_adjusted",
                    "orders": [o.model_dump()],
                    "sum_amount": round(o.amount, 2),
                    "refund_amount": refund_est,
                    "diff": 0.0,
                    "order_count": 1
                })

    # 2. Check Fee-deducted (single or multi orders with fee deduction)
    for o in window_orders:
        if o.fee_amount > 0:
            net_amt = o.amount - o.fee_amount
            diff = abs(net_amt - p_amt)
            if diff <= tolerance:
                candidates.append({
                    "match_type": "fee_deducted",
                    "orders": [o.model_dump()],
                    "sum_amount": round(o.amount, 2),
                    "net_amount": round(net_amt, 2),
                    "fee_amount": round(o.fee_amount, 2),
                    "diff": round(diff, 2),
                    "order_count": 1
                })

    # 3. Standard Combinatorial Subset-Sum (1 to max_k orders)
    # Group window orders by merchant if possible, or consider all window orders
    for k in range(1, min(max_k + 1, len(window_orders) + 1)):
        for combo in itertools.combinations(window_orders, k):
            # Orders in a combo should ideally belong to the same merchant
            merchants = {o.merchant_id for o in combo}
            if len(merchants) > 1:
                continue
                
            total_amt = sum(o.amount for o in combo)
            diff = abs(total_amt - p_amt)
            
            if diff <= tolerance:
                # Avoid duplicate single-order candidates already covered
                order_ids = sorted([o.order_id for o in combo])
                already_present = any(
                    sorted([x["order_id"] for x in c["orders"]]) == order_ids
                    for c in candidates
                )
                if not already_present:
                    candidates.append({
                        "match_type": "split_multi_order" if k > 1 else "standard",
                        "orders": [o.model_dump() for o in combo],
                        "sum_amount": round(total_amt, 2),
                        "diff": round(diff, 2),
                        "order_count": k
                    })

    return candidates

def build_llm_verification_prompt(payout: Payout, candidates: List[Dict[str, Any]]) -> Tuple[str, str]:
    system_prompt = (
        "You are an expert AI Finance Controller reconciling bank settlements against merchant order ledgers.\n"
        "Your task is to analyze candidate order groupings for a given bank payout and determine the most accurate match.\n"
        "Pay special attention to bank narration strings (e.g. batch numbers, invoice suffixes, merchant codes), "
        "order dates, fee deductions, and partial refund statuses.\n"
        "Always respond ONLY with a valid JSON object in the exact schema below, with no surrounding explanations or markdown code blocks:\n"
        "{\n"
        '  "selected_order_ids": ["ORD-101", "ORD-102"],\n'
        '  "confidence": 0.95,\n'
        '  "reasoning": "Concise 1-sentence explanation of why this match or tie-breaker was chosen."\n'
        "}"
    )
    
    user_prompt = (
        f"Bank Settlement Payout:\n"
        f"- Payout ID: {payout.payout_id}\n"
        f"- Amount: INR {payout.amount:.2f}\n"
        f"- Date: {payout.date}\n"
        f"- Bank Narration: {payout.raw_narration}\n"
        f"- Payout Category: {payout.payout_type}\n\n"
        f"Candidate Order Groupings Found ({len(candidates)} plausible option(s)):\n"
    )
    
    for idx, cand in enumerate(candidates, 1):
        order_list = cand["orders"]
        user_prompt += f"\nOption {idx} ({cand['match_type']}, {cand['order_count']} order(s), sum: INR {cand.get('sum_amount', 0):.2f}, diff: INR {cand.get('diff', 0):.2f}):\n"
        for o in order_list:
            user_prompt += f"  - Order {o['order_id']} | Merchant: {o['merchant_id']} | Amount: INR {o['amount']:.2f} | Date: {o['order_date']} | Status: {o['status']} | Fee: INR {o.get('fee_amount', 0):.2f}\n"
            
    user_prompt += (
        "\nInstructions:\n"
        "1. If one candidate clearly matches (via narration clues, date alignment, amount logic), select its order IDs.\n"
        "2. If multiple candidates exist, tie-break using narration tokens and date closeness.\n"
        "3. If none are convincing or evidence is weak, assign confidence < 0.60 and empty selected_order_ids.\n"
        "Return ONLY the JSON response."
    )
    
    return system_prompt, user_prompt

def run_agent_matching(
    unresolved_payouts: List[Payout],
    available_orders: List[Order],
    ground_truth: Optional[Dict[str, Any]] = None
) -> List[MatchRecord]:
    """
    Step 3 in pipeline:
    For each unresolved payout:
    - Runs subset-sum search for candidate groupings (tolerance <= ₹5)
    - If 1 candidate -> passes to LLM for validation
    - If >1 candidates -> passes to LLM for tie-breaking
    - If 0 candidates -> marks unresolved
    - Enforces confidence threshold >= 0.60
    """
    agent_matches: List[MatchRecord] = []
    claimed_order_ids: Set[str] = set()
    
    for payout in unresolved_payouts:
        gt_entry = ground_truth.get(payout.payout_id) if ground_truth else None
        gt_order_ids = gt_entry.get("order_ids") if gt_entry else None
        
        current_available = [o for o in available_orders if o.order_id not in claimed_order_ids]
        candidates = find_subset_sum_candidates(payout, current_available, max_k=4, tolerance=5.0)
        
        if not candidates:
            agent_matches.append(MatchRecord(
                payout_id=payout.payout_id,
                order_ids=[],
                resolution_method="unresolved",
                confidence=0.0,
                reasoning="No plausible order combinations found within amount tolerance (₹5) or date window.",
                ground_truth_order_ids=gt_order_ids
            ))
            continue
            
        system_prompt, user_prompt = build_llm_verification_prompt(payout, candidates)
        context_meta = {
            "payout": payout.model_dump(),
            "candidates": candidates
        }
        
        eval_result = llm_client.evaluate_candidates_json(system_prompt, user_prompt, context_meta)
        
        selected_ids = eval_result.get("selected_order_ids", [])
        confidence = float(eval_result.get("confidence", 0.0))
        reasoning = eval_result.get("reasoning", "")
        
        # Enforce strict confidence cutoff (< 0.60 must be marked unresolved in code)
        if confidence >= 0.60 and selected_ids:
            # Validate that selected_ids actually exist in current_available
            valid_selected = [oid for oid in selected_ids if any(o.order_id == oid for o in current_available)]
            if valid_selected:
                for oid in valid_selected:
                    claimed_order_ids.add(oid)
                    
                agent_matches.append(MatchRecord(
                    payout_id=payout.payout_id,
                    order_ids=valid_selected,
                    resolution_method="agent_subset_sum",
                    confidence=round(confidence, 3),
                    reasoning=reasoning,
                    ground_truth_order_ids=gt_order_ids
                ))
            else:
                agent_matches.append(MatchRecord(
                    payout_id=payout.payout_id,
                    order_ids=[],
                    resolution_method="unresolved",
                    confidence=0.0,
                    reasoning="Selected orders are no longer available or invalid.",
                    ground_truth_order_ids=gt_order_ids
                ))
        else:
            agent_matches.append(MatchRecord(
                payout_id=payout.payout_id,
                order_ids=[],
                resolution_method="unresolved",
                confidence=round(confidence, 3),
                reasoning=reasoning or "Confidence below required threshold (0.60). Moved to human exceptions queue.",
                ground_truth_order_ids=gt_order_ids
            ))
            
    return agent_matches
