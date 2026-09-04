from datetime import datetime
from typing import List, Dict, Tuple, Set, Optional, Any
from backend.models import Payout, Order, MatchRecord

def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")

def run_deterministic_matching(
    payouts: List[Payout], 
    orders: List[Order],
    ground_truth: Optional[Dict[str, Any]] = None
) -> Tuple[List[MatchRecord], List[Payout], List[Order]]:
    """
    Step 2 in pipeline:
    Matches payouts that have an EXACT 1:1 amount match with an order within a ±3 day date window.
    Returns:
      - deterministic_matches: List[MatchRecord]
      - unresolved_payouts: List[Payout] (to be passed to agent matcher)
      - remaining_unmatched_orders: List[Order]
    """
    deterministic_matches: List[MatchRecord] = []
    unresolved_payouts: List[Payout] = []
    
    used_order_ids: Set[str] = set()
    
    # Sort payouts chronologically
    sorted_payouts = sorted(payouts, key=lambda p: p.date)
    
    # Index available orders by amount rounded to 2 decimals
    orders_by_amount: Dict[float, List[Order]] = {}
    for o in orders:
        amt = round(o.amount, 2)
        if amt not in orders_by_amount:
            orders_by_amount[amt] = []
        orders_by_amount[amt].append(o)
        
    for p in sorted_payouts:
        p_amt = round(p.amount, 2)
        p_date = parse_date(p.date)
        
        gt_entry = ground_truth.get(p.payout_id) if ground_truth else None
        gt_order_ids = gt_entry.get("order_ids") if gt_entry else None
        
        candidate_orders = orders_by_amount.get(p_amt, [])
        valid_candidates = []
        
        for cand in candidate_orders:
            if cand.order_id in used_order_ids:
                continue
            c_date = parse_date(cand.order_date)
            # Must be within ±3 day window
            if abs((p_date - c_date).days) <= 3:
                valid_candidates.append(cand)
                
        # If exactly 1 clean match exists
        if len(valid_candidates) == 1:
            matched_order = valid_candidates[0]
            used_order_ids.add(matched_order.order_id)
            
            deterministic_matches.append(MatchRecord(
                payout_id=p.payout_id,
                order_ids=[matched_order.order_id],
                resolution_method="deterministic",
                confidence=1.0,
                reasoning="",
                ground_truth_order_ids=gt_order_ids
            ))
        else:
            # Ambiguous or no exact 1:1 match -> send to agent layer
            unresolved_payouts.append(p)
            
    remaining_orders = [o for o in orders if o.order_id not in used_order_ids]
    return deterministic_matches, unresolved_payouts, remaining_orders
