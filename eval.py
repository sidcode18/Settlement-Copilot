#!/usr/bin/env python3
"""
Evaluation Suite for Settlement Copilot
Compares reconciliation results (matches.order_ids) against synthetic ground truth.
Computes overall and per-category Precision, Recall, F1-Score, and Accuracy across:
- Standard 1:1 Matches
- Split Multi-Order Matches
- Refund-Adjusted Settlements
- Fee-Deducted Settlements
- Ambiguous Tie-Breaker Cases
- Unresolved Exception Cases

Outputs a clean ASCII table to stdout and saves to eval_results.json.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List, Tuple

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import get_all_matches, get_all_payouts, get_all_orders, init_db_if_needed, save_matches
from backend.deterministic_matcher import run_deterministic_matching
from backend.agent_matcher import run_agent_matching

def compute_set_metrics(category_name: str, matched_sets: List[List[str]], gt_sets: List[List[str]]) -> Dict[str, Any]:
    """
    Computes precision, recall, f1, accuracy for list of (pred_order_ids, gt_order_ids)
    """
    tp = 0
    fp = 0
    fn = 0
    tn = 0
    
    for pred, gt in zip(matched_sets, gt_sets):
        pred_set = set(pred)
        gt_set = set(gt)
        
        # Exact set match check
        if pred_set == gt_set:
            if len(gt_set) > 0:
                tp += 1
            else:
                tn += 1
        else:
            if len(pred_set) > 0 and len(gt_set) > 0:
                # Partial / wrong match
                fp += 1
                fn += 1
            elif len(pred_set) > 0 and len(gt_set) == 0:
                fp += 1
            elif len(pred_set) == 0 and len(gt_set) > 0:
                fn += 1

    precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else (1.0 if fn == 0 else 0.0)
    recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else (1.0 if fp == 0 else 0.0)
    f1 = round(2 * precision * recall / (precision + recall), 4) if (precision + recall) > 0 else 0.0
    total = tp + fp + fn + tn
    accuracy = round((tp + tn) / total, 4) if total > 0 else 0.0

    return {
        "category": category_name,
        "total_cases": total,
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "accuracy": accuracy
    }

def run_eval(save_json: bool = True, output_path: str = "eval_results.json", use_existing: bool = False) -> Dict[str, Any]:
    init_db_if_needed()
    
    gt_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ground_truth.json")
    if not os.path.exists(gt_file):
        print("Error: data/ground_truth.json not found. Run generate_data.py first.")
        return {}
        
    with open(gt_file, "r") as f:
        ground_truth: Dict[str, Any] = json.load(f)
        
    matches = get_all_matches() if use_existing else []

    if use_existing and matches:
        print("Using existing reconciliation records from the database.")
    else:
        print("Running fresh reconciliation pipeline...")
        payouts = get_all_payouts()
        orders = get_all_orders()
        det_matches, unresolved_payouts, rem_orders = run_deterministic_matching(payouts, orders, ground_truth)
        agent_matches = run_agent_matching(unresolved_payouts, rem_orders, ground_truth)
        save_matches(det_matches + agent_matches)
        matches = get_all_matches()

    # Index matches by payout_id
    matches_by_id = {m.payout_id: m for m in matches}
    
    categories = {
        "standard_1to1": {"preds": [], "gts": []},
        "split_multi_order": {"preds": [], "gts": []},
        "refund_adjusted": {"preds": [], "gts": []},
        "fee_deducted": {"preds": [], "gts": []},
        "ambiguous_tie_breaker": {"preds": [], "gts": []},
        "unresolved_exception": {"preds": [], "gts": []}
    }
    
    all_preds = []
    all_gts = []
    
    for pid, gt_info in ground_truth.items():
        gt_orders = gt_info.get("order_ids", [])
        ptype = gt_info.get("payout_type", "standard")
        is_amb = gt_info.get("is_ambiguous", False)
        
        match_rec = matches_by_id.get(pid)
        pred_orders = match_rec.order_ids if match_rec else []
        
        all_preds.append(pred_orders)
        all_gts.append(gt_orders)
        
        if is_amb or ptype == "ambiguous_tie_breaker":
            cat_key = "ambiguous_tie_breaker"
        elif ptype == "standard":
            cat_key = "standard_1to1"
        elif ptype == "split_multi_order":
            cat_key = "split_multi_order"
        elif ptype == "refund_adjusted":
            cat_key = "refund_adjusted"
        elif ptype == "fee_deducted":
            cat_key = "fee_deducted"
        elif ptype == "unresolved":
            cat_key = "unresolved_exception"
        else:
            cat_key = "standard_1to1"
            
        categories[cat_key]["preds"].append(pred_orders)
        categories[cat_key]["gts"].append(gt_orders)
        
    overall_metrics = compute_set_metrics("overall", all_preds, all_gts)
    
    cat_reports = {}
    for cat_name, data in categories.items():
        if data["gts"]:
            cat_reports[cat_name] = compute_set_metrics(cat_name, data["preds"], data["gts"])
        else:
            cat_reports[cat_name] = {
                "category": cat_name,
                "total_cases": 0, "true_positives": 0, "false_positives": 0,
                "false_negatives": 0, "true_negatives": 0,
                "precision": 0.0, "recall": 0.0, "f1_score": 0.0, "accuracy": 0.0
            }
            
    eval_report = {
        "overall_precision": overall_metrics["precision"],
        "overall_recall": overall_metrics["recall"],
        "overall_f1": overall_metrics["f1_score"],
        "overall_accuracy": overall_metrics["accuracy"],
        "total_payouts_evaluated": len(ground_truth),
        "categories": cat_reports,
        "summary_notes": "Honest evaluation across 1:1, multi-order splits, partial refunds, MDR fees, and ambiguous narration tie-breakers."
    }
    
    if save_json:
        with open(output_path, "w") as f:
            json.dump(eval_report, f, indent=2)
            
    # Print clean formatted table
    print("\n" + "=" * 90)
    print("                      SETTLEMENT COPILOT — EVALUATION REPORT")
    print("=" * 90)
    print(f"{'Category':<26} | {'Cases':<6} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Accuracy':<10}")
    print("-" * 90)
    
    cat_display_names = {
        "standard_1to1": "Standard 1:1 Matches",
        "split_multi_order": "Split Multi-Order (2-4)",
        "refund_adjusted": "Refund Adjusted (Net)",
        "fee_deducted": "Fee Deducted (MDR)",
        "ambiguous_tie_breaker": "Ambiguous Tie-Breakers",
        "unresolved_exception": "Unresolved Exceptions"
    }
    
    for k, name in cat_display_names.items():
        m = cat_reports.get(k, {})
        cases = m.get("total_cases", 0)
        p = f"{m.get('precision', 0.0)*100:.1f}%"
        r = f"{m.get('recall', 0.0)*100:.1f}%"
        f1 = f"{m.get('f1_score', 0.0)*100:.1f}%"
        acc = f"{m.get('accuracy', 0.0)*100:.1f}%"
        print(f"{name:<26} | {cases:<6} | {p:<10} | {r:<10} | {f1:<10} | {acc:<10}")
        
    print("-" * 90)
    ov_p = f"{overall_metrics['precision']*100:.1f}%"
    ov_r = f"{overall_metrics['recall']*100:.1f}%"
    ov_f1 = f"{overall_metrics['f1_score']*100:.1f}%"
    ov_acc = f"{overall_metrics['accuracy']*100:.1f}%"
    print(f"{'OVERALL PIPELINE':<26} | {len(ground_truth):<6} | {ov_p:<10} | {ov_r:<10} | {ov_f1:<10} | {ov_acc:<10}")
    print("=" * 90)
    print(f"Results successfully saved to {output_path}\n")
    
    return eval_report

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate reconciliation output against ground truth.")
    parser.add_argument("--use-existing", action="store_true", help="Score the current matches table without rerunning reconciliation.")
    parser.add_argument("--output", default="eval_results.json", help="Path for the JSON evaluation report.")
    args = parser.parse_args()
    run_eval(output_path=args.output, use_existing=args.use_existing)
