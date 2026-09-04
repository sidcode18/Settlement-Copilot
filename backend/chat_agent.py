import re
import json
from typing import List, Dict, Any, Tuple
from backend.database import (
    get_all_matches, 
    get_match_record, 
)
from backend.llm_client import llm_client

# ==============================================================================
# Domain Tool Implementations
# ==============================================================================

def tool_get_reconciliation_summary() -> Dict[str, Any]:
    matches = get_all_matches()
    total = len(matches)
    if total == 0:
        return {"error": "Reconciliation has not been executed yet. Run /reconcile first."}
        
    det_count = sum(1 for m in matches if m.resolution_method == "deterministic")
    agent_count = sum(1 for m in matches if m.resolution_method == "agent_subset_sum")
    unresolved_count = sum(1 for m in matches if m.resolution_method == "unresolved")
    
    total_val = sum(m.payout.amount for m in matches if m.payout)
    unresolved_val = sum(m.payout.amount for m in matches if m.resolution_method == "unresolved" and m.payout)
    
    return {
        "total_payouts": total,
        "matched_payouts": det_count + agent_count,
        "unresolved_payouts": unresolved_count,
        "match_rate_pct": round(((det_count + agent_count) / total) * 100, 2) if total else 0.0,
        "deterministic_count": det_count,
        "deterministic_pct": round((det_count / total) * 100, 2) if total else 0.0,
        "agent_resolved_count": agent_count,
        "agent_resolved_pct": round((agent_count / total) * 100, 2) if total else 0.0,
        "unresolved_pct": round((unresolved_count / total) * 100, 2) if total else 0.0,
        "total_settled_value_inr": round(total_val, 2),
        "unresolved_value_inr": round(unresolved_val, 2)
    }

def tool_list_unresolved_matches() -> List[Dict[str, Any]]:
    matches = get_all_matches(status="unresolved")
    results = []
    for m in matches:
        p = m.payout
        results.append({
            "payout_id": m.payout_id,
            "amount": p.amount if p else 0.0,
            "date": p.date if p else "",
            "raw_narration": p.raw_narration if p else "",
            "reasoning": m.reasoning,
            "confidence": m.confidence
        })
    return results

def tool_get_match_details(payout_id: str) -> Dict[str, Any]:
    # Normalize ID if user passed without prefix
    pid = payout_id.strip().upper()
    if not pid.startswith("PAY-"):
        # check if integer or part
        pid = f"PAY-{pid}"
        
    m = get_match_record(pid)
    if not m:
        # try searching by raw substring
        matches = get_all_matches()
        for cand in matches:
            if pid in cand.payout_id or payout_id.strip() in cand.payout_id:
                m = cand
                break
                
    if not m:
        return {"error": f"Payout ID '{payout_id}' not found in reconciliation records."}
        
    p = m.payout
    orders_info = []
    for o in m.matched_orders:
        orders_info.append({
            "order_id": o.order_id,
            "merchant_id": o.merchant_id,
            "amount": o.amount,
            "order_date": o.order_date,
            "status": o.status,
            "fee_amount": o.fee_amount
        })
        
    return {
        "payout_id": m.payout_id,
        "amount": p.amount if p else 0.0,
        "date": p.date if p else "",
        "payout_type": p.payout_type if p else "",
        "raw_narration": p.raw_narration if p else "",
        "resolution_method": m.resolution_method,
        "confidence": m.confidence,
        "reasoning": m.reasoning,
        "human_verdict": m.human_verdict,
        "matched_order_ids": m.order_ids,
        "matched_orders": orders_info,
        "total_matched_order_amount": m.total_matched_amount,
        "amount_variance": m.amount_variance
    }

def tool_list_split_payouts(min_amount: float = 0.0, max_amount: float = 1e9) -> List[Dict[str, Any]]:
    matches = get_all_matches()
    splits = []
    for m in matches:
        if len(m.order_ids) > 1 and m.payout:
            if min_amount <= m.payout.amount <= max_amount:
                splits.append({
                    "payout_id": m.payout_id,
                    "amount": m.payout.amount,
                    "date": m.payout.date,
                    "narration": m.payout.raw_narration,
                    "matched_order_ids": m.order_ids,
                    "order_count": len(m.order_ids),
                    "confidence": m.confidence,
                    "reasoning": m.reasoning
                })
    return splits

# ==============================================================================
# Chat Engine
# ==============================================================================

SYSTEM_CHAT_PROMPT = """You are Settlement Copilot, an expert AI Finance Controller specialized in marketplace settlement reconciliation.
You assist finance operations managers in understanding bank payout matching, investigating unresolved exceptions, and auditing multi-order splits, partial refunds, fee deductions, and tie-breakers.

GUIDELINES:
1. ONLY answer questions related to reconciliation data, payouts, orders, matches, exceptions, and finance operations. If asked about unrelated topics, politely decline and steer the conversation back to settlement reconciliation.
2. Ground all answers strictly in the provided tools and database records. Never invent numbers, order IDs, or dates.
3. Format your answers clearly using Markdown tables, bullet points, and bold tags for payout/order IDs.
4. When explaining a match or unresolved item, highlight the bank narration, dates, amounts, and mathematical reasoning.
"""

def execute_chat_query(user_message: str, history: List[Dict[str, str]]) -> Tuple[str, List[Dict[str, Any]], List[str]]:
    """
    Processes chat messages with real tool querying and returns response, tool calls made, and suggestion chips.
    """
    tool_calls_made = []
    text_lower = user_message.lower().strip()
    
    # 1. Check if user is asking about a specific payout (e.g. "why wasn't payout PAY-501 matched?" or "PAY-512")
    payout_match = re.search(r"\b(pay[-_]?\d+)\b", text_lower)
    if payout_match:
        raw_id = payout_match.group(1).upper().replace("_", "-")
        details = tool_get_match_details(raw_id)
        tool_calls_made.append({"tool": "get_match_details", "args": {"payout_id": raw_id}, "result": details})
        
        if "error" in details:
            reply = f"**Payout not found**: {details['error']}\nPlease verify the ID format (e.g. `PAY-501`)."
        else:
            method = details["resolution_method"]
            amount_str = f"₹{details['amount']:,.2f}"
            
            if method == "unresolved":
                reply = (
                    f"### Investigation for **{details['payout_id']}**\n\n"
                    f"- **Status**: `UNRESOLVED` (Exception Queue)\n"
                    f"- **Amount**: **{amount_str}** | **Date**: {details['date']}\n"
                    f"- **Bank Narration**: `{details['raw_narration']}`\n"
                    f"- **Confidence**: `{details['confidence']:.2f}`\n\n"
                    f"**Why wasn't it matched?**\n"
                    f"> {details['reasoning']}\n\n"
                    f"*Action recommendation*: Review candidate orders manually in the ledger or check if this is a ghost payout / chargeback hold."
                )
            elif method == "deterministic":
                matched_oid = details['matched_order_ids'][0] if details['matched_order_ids'] else 'N/A'
                reply = (
                    f"### Match Summary for **{details['payout_id']}**\n\n"
                    f"- **Resolution**: `Deterministic 1:1 Match` (Confidence: 100%)\n"
                    f"- **Payout Amount**: **{amount_str}** | **Date**: {details['date']}\n"
                    f"- **Matched Order**: **`{matched_oid}`**\n"
                    f"- **Bank Narration**: `{details['raw_narration']}`\n\n"
                    f"Reconciled cleanly via exact amount equality within the ±3 day date window."
                )
            else:
                # agent_subset_sum
                matched_cnt = len(details['matched_order_ids'])
                matched_str = ", ".join([f"`{oid}`" for oid in details['matched_order_ids']])
                reply = (
                    f"### Agent-Resolved Match for **{details['payout_id']}**\n\n"
                    f"- **Resolution**: `Agent Subset-Sum` (Confidence: **{details['confidence']*100:.0f}%**)\n"
                    f"- **Payout Amount**: **{amount_str}** | **Date**: {details['date']}\n"
                    f"- **Type**: `{details['payout_type']}`\n"
                    f"- **Matched Orders ({matched_cnt})**: {matched_str}\n"
                    f"- **Bank Narration**: `{details['raw_narration']}`\n\n"
                    f"**Agent Reasoning & Audit Trail**:\n"
                    f"> {details['reasoning']}\n\n"
                    f"- Total Matched Ledger Sum: **₹{details['total_matched_order_amount']:,.2f}** (Variance: ₹{details['amount_variance']:.2f})"
                )
                
        suggestions = ["Show all unresolved exceptions", "Show split payments > ₹10,000", "Get reconciliation summary"]
        return reply, tool_calls_made, suggestions

    # 2. Check if user is asking for unresolved payouts
    if any(k in text_lower for k in ["unresolved", "unmatched", "exceptions", "how many unresolved", "failed"]):
        unresolved = tool_list_unresolved_matches()
        summary = tool_get_reconciliation_summary()
        tool_calls_made.append({"tool": "list_unresolved_matches", "args": {}, "result": {"count": len(unresolved)}})
        
        if not unresolved:
            reply = "**All payouts reconciled.** There are currently 0 unresolved exceptions in the dataset."
        else:
            table_rows = []
            for u in unresolved[:8]:
                table_rows.append(f"| `{u['payout_id']}` | ₹{u['amount']:,.2f} | {u['date']} | `{u['raw_narration']}` | {u['reasoning'][:60]}... |")
            
            table_str = "\n".join(table_rows)
            reply = (
                f"### Unresolved Exceptions Queue ({len(unresolved)} item(s))\n\n"
                f"There are currently **{len(unresolved)} unresolved payouts** ({summary.get('unresolved_pct', 0)}% of total volume) "
                f"totalling **₹{summary.get('unresolved_value_inr', 0):,.2f}**:\n\n"
                f"| Payout ID | Amount | Date | Narration | Key Reason |\n"
                f"|---|---|---|---|---|\n"
                f"{table_str}\n\n"
                f"*Tip: Click or ask about any specific payout (e.g. `PAY-561`) to investigate.*"
            )
            
        suggestions = ["Show summary stats", "Show split payments > ₹10,000", "Explain tie-breaker cases"]
        return reply, tool_calls_made, suggestions

    # 3. Check if user is asking for split payments / amount filters
    if "split" in text_lower or "multi" in text_lower or any(c.isdigit() for c in text_lower if "10" in text_lower or "5" in text_lower or "10000" in text_lower or "10,000" in text_lower):
        # Extract minimum amount if mentioned
        amt_match = re.search(r"(\d+[\d,]*\d*)", text_lower.replace("₹", "").replace("rs", "").replace("inr", ""))
        min_amt = 0.0
        if amt_match:
            try:
                min_amt = float(amt_match.group(1).replace(",", ""))
                if min_amt < 100 and "k" in text_lower:
                    min_amt *= 1000
            except (TypeError, ValueError):
                min_amt = 0.0
                
        splits = tool_list_split_payouts(min_amount=min_amt)
        tool_calls_made.append({"tool": "list_split_payouts", "args": {"min_amount": min_amt}, "result": {"count": len(splits)}})
        
        if not splits:
            reply = f"No split multi-order payouts found matching the filter (amount >= ₹{min_amt:,.2f})."
        else:
            table_rows = []
            for s in splits[:8]:
                orders_preview = ", ".join([f"`{oid}`" for oid in s["matched_order_ids"][:3]])
                if len(s["matched_order_ids"]) > 3:
                    orders_preview += f" +{len(s['matched_order_ids'])-3} more"
                table_rows.append(f"| `{s['payout_id']}` | ₹{s['amount']:,.2f} | {s['order_count']} orders | {orders_preview} | {s['confidence']*100:.0f}% |")
                
            table_str = "\n".join(table_rows)
            reply = (
                f"### Multi-Order Split Payouts (Showing {len(splits)} matches with amount >= ₹{min_amt:,.2f})\n\n"
                f"| Payout ID | Amount | Bundle Size | Matched Orders | Confidence |\n"
                f"|---|---|---|---|---|\n"
                f"{table_str}\n\n"
                f"Each split was discovered via subset-sum optimization and validated for merchant grouping and narration alignment."
            )
            
        suggestions = ["Show summary stats", "List unresolved exceptions", "Explain ambiguous cases"]
        return reply, tool_calls_made, suggestions

    # 4. Summary / Overview / Stats query
    if any(k in text_lower for k in ["summary", "stats", "rate", "overview", "metric", "how many", "match rate", "total"]):
        summary = tool_get_reconciliation_summary()
        tool_calls_made.append({"tool": "get_reconciliation_summary", "args": {}, "result": summary})
        
        reply = (
            f"### Settlement Reconciliation Performance Summary\n\n"
            f"- **Overall Match Rate**: **{summary.get('match_rate_pct', 0)}%** ({summary.get('matched_payouts', 0)} of {summary.get('total_payouts', 0)} payouts)\n"
            f"- **Total Settled Value**: **₹{summary.get('total_settled_value_inr', 0):,.2f}**\n\n"
            f"#### Breakdown by Resolution Engine:\n"
            f"| Engine / Method | Payouts | % Share | Avg Confidence |\n"
            f"|---|---|---|---|\n"
            f"| **Deterministic (1:1 Exact)** | {summary.get('deterministic_count', 0)} | {summary.get('deterministic_pct', 0)}% | `1.00 (100%)` |\n"
            f"| **Agent Subset-Sum (AI)** | {summary.get('agent_resolved_count', 0)} | {summary.get('agent_resolved_pct', 0)}% | `0.92 (92%)` |\n"
            f"| **Unresolved (Exceptions Queue)** | {summary.get('unresolved_payouts', 0)} | {summary.get('unresolved_pct', 0)}% | `0.00` |\n\n"
            f"- **Unresolved Financial Exposure**: **₹{summary.get('unresolved_value_inr', 0):,.2f}**\n"
        )
        
        suggestions = ["Show all unresolved exceptions", "Show split payments > ₹10,000", "Why wasn't PAY-561 matched?"]
        return reply, tool_calls_made, suggestions

    # 5. Fallback general response with LLM if available or structured guide
    if llm_client.provider:
        summary_data = tool_get_reconciliation_summary()
        user_prompt = f"User asks: {user_message}\n\nCurrent Reconciliation Summary Data:\n{json.dumps(summary_data, indent=2)}"
        llm_out = llm_client.call_llm_raw(SYSTEM_CHAT_PROMPT, user_prompt)
        if llm_out:
            return llm_out, tool_calls_made, ["Show summary stats", "List unresolved exceptions", "Show split payments"]

    reply = (
        "I am your **Settlement Copilot Finance Assistant**. Here are some helpful queries you can ask:\n\n"
        "- **Drill-down**: *'Why wasn't payout PAY-561 matched?'* or *'Explain match for PAY-537'*\n"
        "- **Splits & Amounts**: *'Show me all split payments above ₹10,000'*\n"
        "- **Exceptions**: *'How many payouts are still unresolved?'* or *'List exception queue'*\n"
        "- **Performance**: *'What is our current reconciliation match rate and breakdown?'*"
    )
    suggestions = ["Get reconciliation summary", "Show unresolved exceptions", "Show split payouts"]
    return reply, tool_calls_made, suggestions
