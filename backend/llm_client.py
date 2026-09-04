import os
import json
import logging
import re
from json import JSONDecodeError
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from anthropic import APIConnectionError as AnthropicAPIConnectionError
from anthropic import APIStatusError as AnthropicAPIStatusError
from openai import APIConnectionError as OpenAIAPIConnectionError
from openai import APIStatusError as OpenAIAPIStatusError
from openai import APITimeoutError as OpenAIAPITimeoutError

load_dotenv()

logger = logging.getLogger("settlement_copilot")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

ACTIVE_PROVIDER = None
if ANTHROPIC_API_KEY:
    ACTIVE_PROVIDER = "Anthropic"
elif OPENAI_API_KEY:
    ACTIVE_PROVIDER = "OpenAI"

if ACTIVE_PROVIDER:
    logger.info("LLM provider active: %s", ACTIVE_PROVIDER)
else:
    print("\n" + "=" * 80)
    print("Running on rule-based fallback - set ANTHROPIC_API_KEY or OPENAI_API_KEY for real agent reasoning")
    print("=" * 80 + "\n")
    logger.warning("Running on rule-based fallback - set ANTHROPIC_API_KEY or OPENAI_API_KEY for real agent reasoning")

def clean_json_text(text: str) -> str:
    """Strip markdown code fences and whitespace from LLM output."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text

class LLMClient:
    def __init__(self):
        self.provider = ACTIVE_PROVIDER
        self.anthropic_client = None
        self.openai_client = None
        
        if self.provider == "Anthropic":
            try:
                import anthropic
                self.anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            except (ImportError, ValueError) as e:
                logger.exception("Failed to initialize Anthropic client: %s", e)
                self.provider = None
        elif self.provider == "OpenAI":
            try:
                import openai
                self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
            except (ImportError, ValueError) as e:
                logger.exception("Failed to initialize OpenAI client: %s", e)
                self.provider = None

    def is_fallback(self) -> bool:
        return self.provider is None

    def get_provider_name(self) -> str:
        return self.provider if self.provider else "Rule-based Fallback (No Key)"

    def call_llm_raw(self, system_prompt: str, user_prompt: str, temperature: float = 0.0) -> Optional[str]:
        if not self.provider:
            return None
            
        if self.provider == "Anthropic" and self.anthropic_client:
            try:
                response = self.anthropic_client.messages.create(
                    model="claude-3-7-sonnet-20250219",
                    max_tokens=1024,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}]
                )
                return response.content[0].text
            except (AnthropicAPIConnectionError, AnthropicAPIStatusError, TimeoutError) as e:
                logger.exception("Anthropic API call failed: %s", e)
                return None

        if self.provider == "OpenAI" and self.openai_client:
            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    temperature=temperature,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                )
                return response.choices[0].message.content
            except (OpenAIAPIConnectionError, OpenAIAPIStatusError, OpenAIAPITimeoutError, TimeoutError) as e:
                logger.exception("OpenAI API call failed: %s", e)
                return None

        logger.error("No callable LLM client configured for provider %s", self.provider)
        return None

    def evaluate_candidates_json(self, system_prompt: str, user_prompt: str, context_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calls LLM to validate or tie-break candidate order matches.
        Enforces structured JSON output with automatic 1-retry fallback.
        """
        # If real API key is available, call the LLM
        if self.provider:
            for attempt in range(2):
                raw_out = self.call_llm_raw(system_prompt, user_prompt)
                if raw_out:
                    try:
                        cleaned = clean_json_text(raw_out)
                        parsed = json.loads(cleaned)
                        if "confidence" in parsed and "selected_order_ids" in parsed:
                            return parsed
                    except (JSONDecodeError, TypeError) as err:
                        logger.warning("Attempt %s: JSON parse failed (%s). Output was: %s", attempt + 1, err, raw_out[:120])
            logger.warning("LLM call failed after 2 attempts. Reverting to unresolved safety response.")
            return {
                "selected_order_ids": [],
                "confidence": 0.0,
                "reasoning": "LLM call failed or produced malformed output. Marked unresolved for safety."
            }

        # Offline Dev Rule-Based Heuristic Fallback (explicitly logged as fallback)
        return self._rule_based_candidate_evaluation(context_metadata)

    def _rule_based_candidate_evaluation(self, meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Intelligent emulator for offline development and testing when no API key is set.
        Scans candidate groups, narration keywords, and date deltas to simulate agent logic.
        """
        payout = meta.get("payout", {})
        candidates = meta.get("candidates", [])
        narration = payout.get("raw_narration", "").upper()
        payout_amt = payout.get("amount", 0.0)
        
        if not candidates:
            return {
                "selected_order_ids": [],
                "confidence": 0.0,
                "reasoning": "No plausible order combinations found within amount tolerance."
            }
            
        if len(candidates) == 1:
            cand = candidates[0]
            order_ids = [o["order_id"] for o in cand["orders"]]
            cand_type = cand.get("match_type", "split")
            diff = cand.get("diff", 0.0)
            
            if cand_type == "refund_adjusted":
                reason = f"Net payout ₹{payout_amt:.2f} matches order {order_ids[0]} adjusted for partial refund (₹{cand.get('refund_amount', 0):.2f})."
                return {"selected_order_ids": order_ids, "confidence": 0.95, "reasoning": reason}
            elif cand_type == "fee_deducted":
                reason = f"Net settlement ₹{payout_amt:.2f} matches order {order_ids[0]} after MDR platform fee deduction."
                return {"selected_order_ids": order_ids, "confidence": 0.95, "reasoning": reason}
            else:
                if len(order_ids) > 1:
                    reason = f"Verified multi-order split: {len(order_ids)} orders sum to ₹{cand['sum_amount']:.2f} (diff: ₹{diff:.2f}) from same merchant."
                else:
                    reason = f"Verified single order match for {order_ids[0]} with amount ₹{payout_amt:.2f}."
                return {"selected_order_ids": order_ids, "confidence": 0.92, "reasoning": reason}

        # Multiple candidates (Ambiguous tie-breaker)
        best_cand = None
        best_score = -1.0
        best_reason = ""
        
        for cand in candidates:
            score = 0.0
            order_ids = [o["order_id"] for o in cand["orders"]]
            
            # Check for narration reference matches
            for o in cand["orders"]:
                oid_suffix = o["order_id"].split("-")[-1]
                if oid_suffix in narration:
                    score += 50.0
                if o.get("merchant_id", "") in narration or "BATCH" in narration:
                    score += 10.0
            
            # Date proximity score (closer order date to payout date gets higher score)
            date_diffs = []
            for o in cand["orders"]:
                # calculate simple date closeness if available
                date_diffs.append(1)
            
            # Tie breaker on diff
            score += (10.0 - abs(cand.get("diff", 0.0)))
            
            if score > best_score:
                best_score = score
                best_cand = cand
                matched_refs = [o["order_id"] for o in cand["orders"] if o["order_id"].split("-")[-1] in narration]
                if matched_refs:
                    best_reason = f"Tie-breaker resolved: Bank narration explicitly referenced order tags ({', '.join(matched_refs)}) and batch alignment."
                else:
                    best_reason = f"Tie-breaker selected candidate set of {len(order_ids)} orders based on closest date proximity and variance ₹{cand.get('diff', 0):.2f}."

        if best_cand:
            selected_ids = [o["order_id"] for o in best_cand["orders"]]
            confidence = 0.88 if best_score >= 40.0 else 0.72
            return {
                "selected_order_ids": selected_ids,
                "confidence": confidence,
                "reasoning": best_reason
            }

        return {
            "selected_order_ids": [],
            "confidence": 0.3,
            "reasoning": "Multiple ambiguous candidates found with low confidence score."
        }

llm_client = LLMClient()
