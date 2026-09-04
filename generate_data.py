#!/usr/bin/env python3
"""
Synthetic Data Generator for Settlement Copilot
Generates ~70 orders and ~60 payouts reflecting realistic marketplace settlements:
- ~65% standard 1:1 matches
- ~20% split_multi_order (1 payout = 2-4 orders)
- ~10% refund_adjusted (payout = order - partial refund)
- ~5% fee_deducted (payout = order - platform fee)
- 4-5 ambiguous edge cases with multiple subset-sum candidates requiring narration/tie-breaker clues

Saves to data/payouts.csv, data/orders.csv, data/ground_truth.json, and SQLite.
"""

import os
import sys
import json
import random
import sqlite3
import argparse
from datetime import datetime, timedelta
import pandas as pd

MERCHANTS = [
    {"id": "MERCH_BLR_01", "name": "UrbanTrend Fashion", "prefix": "UTF"},
    {"id": "MERCH_MUM_02", "name": "Zenith Electronics", "prefix": "ZEN"},
    {"id": "MERCH_DEL_03", "name": "FreshGourmet Organics", "prefix": "FGO"},
    {"id": "MERCH_HYD_04", "name": "KiteSports Gear", "prefix": "KSG"},
    {"id": "MERCH_PUN_05", "name": "AuraHome Decor", "prefix": "AHD"},
]

BANK_PREFIXES = ["NEFT", "RTGS", "IMPS", "ACH", "SETL", "UPI"]

def generate_dataset(seed: int = 42, output_dir: str = "data"):
    random.seed(seed)
    os.makedirs(output_dir, exist_ok=True)
    
    start_date = datetime(2026, 3, 1)
    
    orders = []
    payouts = []
    ground_truth = {}
    
    order_counter = 1001
    payout_counter = 501
    
    # ---------------------------------------------------------
    # 1. Standard 1:1 Matches (~36 payouts, 36 orders) ~60%
    # ---------------------------------------------------------
    for _ in range(36):
        merch = random.choice(MERCHANTS)
        o_date = start_date + timedelta(days=random.randint(0, 20))
        p_date = o_date + timedelta(days=random.randint(0, 2))
        
        amount = round(random.uniform(450, 9500), 2)
        fee = 0.0
        
        order_id = f"ORD-{merch['prefix']}-{order_counter}"
        order_counter += 1
        
        payout_id = f"PAY-{payout_counter}"
        payout_counter += 1
        
        bank_pfx = random.choice(BANK_PREFIXES)
        narration = f"{bank_pfx}-SETL-{random.randint(10000, 99999)}-{merch['prefix']}-RAZORP"
        
        orders.append({
            "order_id": order_id,
            "merchant_id": merch["id"],
            "amount": amount,
            "order_date": o_date.strftime("%Y-%m-%d"),
            "status": "paid",
            "fee_amount": fee
        })
        
        payouts.append({
            "payout_id": payout_id,
            "amount": amount,
            "date": p_date.strftime("%Y-%m-%d"),
            "payout_type": "standard",
            "raw_narration": narration
        })
        
        ground_truth[payout_id] = {
            "payout_id": payout_id,
            "order_ids": [order_id],
            "payout_type": "standard",
            "is_ambiguous": False,
            "expected_method": "deterministic",
            "expected_reasoning_hint": f"Exact amount match ₹{amount:.2f} for {order_id}"
        }

    # ---------------------------------------------------------
    # 2. Split Multi-Order (~12 payouts, 28 orders) ~20%
    # ---------------------------------------------------------
    for i in range(12):
        merch = random.choice(MERCHANTS)
        batch_date = start_date + timedelta(days=random.randint(2, 22))
        p_date = batch_date + timedelta(days=random.randint(1, 3))
        
        num_sub_orders = random.choice([2, 2, 3, 3, 4])
        sub_order_ids = []
        sub_amounts = []
        
        batch_id = f"BATCH{random.randint(100, 999)}"
        
        for _ in range(num_sub_orders):
            o_date = batch_date - timedelta(days=random.randint(0, 2))
            amt = round(random.uniform(800, 4800), 2)
            o_id = f"ORD-{merch['prefix']}-{order_counter}"
            order_counter += 1
            
            orders.append({
                "order_id": o_id,
                "merchant_id": merch["id"],
                "amount": amt,
                "order_date": o_date.strftime("%Y-%m-%d"),
                "status": "paid",
                "fee_amount": 0.0
            })
            sub_order_ids.append(o_id)
            sub_amounts.append(amt)
            
        payout_amount = round(sum(sub_amounts), 2)
        payout_id = f"PAY-{payout_counter}"
        payout_counter += 1
        
        bank_pfx = random.choice(["NEFT", "RTGS", "ACH", "SETL"])
        narration = f"{bank_pfx}-BULK-SETL-{batch_id}-{merch['id']}-RZP"
        
        payouts.append({
            "payout_id": payout_id,
            "amount": payout_amount,
            "date": p_date.strftime("%Y-%m-%d"),
            "payout_type": "split_multi_order",
            "raw_narration": narration
        })
        
        ground_truth[payout_id] = {
            "payout_id": payout_id,
            "order_ids": sub_order_ids,
            "payout_type": "split_multi_order",
            "is_ambiguous": False,
            "expected_method": "agent_subset_sum",
            "expected_reasoning_hint": f"Payout ₹{payout_amount:.2f} matches batch sum of {len(sub_order_ids)} orders: {', '.join(sub_order_ids)}"
        }

    # ---------------------------------------------------------
    # 3. Refund-Adjusted Payouts (~6 payouts, 6 orders) ~10%
    # ---------------------------------------------------------
    for _ in range(6):
        merch = random.choice(MERCHANTS)
        o_date = start_date + timedelta(days=random.randint(3, 20))
        p_date = o_date + timedelta(days=random.randint(1, 4))
        
        full_amount = round(random.uniform(3000, 12000), 2)
        refund_amount = round(random.uniform(400, min(2000, full_amount * 0.4)), 2)
        payout_amount = round(full_amount - refund_amount, 2)
        
        order_id = f"ORD-{merch['prefix']}-{order_counter}"
        order_counter += 1
        
        orders.append({
            "order_id": order_id,
            "merchant_id": merch["id"],
            "amount": full_amount,
            "order_date": o_date.strftime("%Y-%m-%d"),
            "status": "partially_refunded",
            "fee_amount": 0.0
        })
        
        payout_id = f"PAY-{payout_counter}"
        payout_counter += 1
        
        bank_pfx = random.choice(["NEFT", "SETL", "IMPS"])
        narration = f"{bank_pfx}-REF-ADJ-{random.randint(1000, 9999)}-{order_id}-NET"
        
        payouts.append({
            "payout_id": payout_id,
            "amount": payout_amount,
            "date": p_date.strftime("%Y-%m-%d"),
            "payout_type": "refund_adjusted",
            "raw_narration": narration
        })
        
        ground_truth[payout_id] = {
            "payout_id": payout_id,
            "order_ids": [order_id],
            "payout_type": "refund_adjusted",
            "is_ambiguous": False,
            "expected_method": "agent_subset_sum",
            "expected_reasoning_hint": f"Net payout ₹{payout_amount:.2f} reflects order {order_id} (₹{full_amount:.2f}) adjusted for partial refund of ₹{refund_amount:.2f}"
        }

    # ---------------------------------------------------------
    # 4. Fee-Deducted Payouts (~3 payouts, 3 orders) ~5%
    # ---------------------------------------------------------
    for _ in range(3):
        merch = random.choice(MERCHANTS)
        o_date = start_date + timedelta(days=random.randint(4, 22))
        p_date = o_date + timedelta(days=random.randint(1, 3))
        
        full_amount = round(random.uniform(5000, 15000), 2)
        fee = round(full_amount * 0.02 + 10.0, 2)
        payout_amount = round(full_amount - fee, 2)
        
        order_id = f"ORD-{merch['prefix']}-{order_counter}"
        order_counter += 1
        
        orders.append({
            "order_id": order_id,
            "merchant_id": merch["id"],
            "amount": full_amount,
            "order_date": o_date.strftime("%Y-%m-%d"),
            "status": "paid",
            "fee_amount": fee
        })
        
        payout_id = f"PAY-{payout_counter}"
        payout_counter += 1
        
        bank_pfx = random.choice(["RTGS", "NEFT", "SETL"])
        narration = f"{bank_pfx}-MDR-DED-SETL-{merch['prefix']}-TXN{random.randint(100, 999)}"
        
        payouts.append({
            "payout_id": payout_id,
            "amount": payout_amount,
            "date": p_date.strftime("%Y-%m-%d"),
            "payout_type": "fee_deducted",
            "raw_narration": narration
        })
        
        ground_truth[payout_id] = {
            "payout_id": payout_id,
            "order_ids": [order_id],
            "payout_type": "fee_deducted",
            "is_ambiguous": False,
            "expected_method": "agent_subset_sum",
            "expected_reasoning_hint": f"Net settlement ₹{payout_amount:.2f} matches {order_id} (₹{full_amount:.2f}) after ₹{fee:.2f} MDR fee deduction"
        }

    # ---------------------------------------------------------
    # 5. Genuinely Ambiguous Edge Cases (4 payouts, with 2+ subset-sum candidates)
    # ---------------------------------------------------------
    # Case A: Same sum from 2 different order pairs for the same merchant
    merch_amb_1 = MERCHANTS[0]  # UTF
    base_date_a = start_date + timedelta(days=10)
    
    # Candidate Pair 1: ₹2,400 + ₹1,600 = ₹4,000 (Target Pair)
    ord_a1 = f"ORD-{merch_amb_1['prefix']}-{order_counter}"
    order_counter += 1
    ord_a2 = f"ORD-{merch_amb_1['prefix']}-{order_counter}"
    order_counter += 1
    orders.append({"order_id": ord_a1, "merchant_id": merch_amb_1["id"], "amount": 2400.0, "order_date": (base_date_a).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    orders.append({"order_id": ord_a2, "merchant_id": merch_amb_1["id"], "amount": 1600.0, "order_date": (base_date_a).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    
    # Candidate Pair 2 (Distractor): ₹2,500 + ₹1,500 = ₹4,000
    ord_a3 = f"ORD-{merch_amb_1['prefix']}-{order_counter}"
    order_counter += 1
    ord_a4 = f"ORD-{merch_amb_1['prefix']}-{order_counter}"
    order_counter += 1
    orders.append({"order_id": ord_a3, "merchant_id": merch_amb_1["id"], "amount": 2500.0, "order_date": (base_date_a + timedelta(days=6)).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    orders.append({"order_id": ord_a4, "merchant_id": merch_amb_1["id"], "amount": 1500.0, "order_date": (base_date_a + timedelta(days=6)).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    
    pay_amb_1 = f"PAY-{payout_counter}"
    payout_counter += 1
    payouts.append({
        "payout_id": pay_amb_1,
        "amount": 4000.0,
        "date": (base_date_a + timedelta(days=1)).strftime("%Y-%m-%d"),
        "payout_type": "split_multi_order",
        "raw_narration": f"NEFT-SETL-BATCH-A-REF-{ord_a1[-4:]}-{ord_a2[-4:]}-UTF"
    })
    ground_truth[pay_amb_1] = {
        "payout_id": pay_amb_1,
        "order_ids": [ord_a1, ord_a2],
        "payout_type": "ambiguous_tie_breaker",
        "is_ambiguous": True,
        "expected_method": "agent_subset_sum",
        "expected_reasoning_hint": f"Tie-breaker resolved via narration reference ({ord_a1[-4:]}/{ord_a2[-4:]}) and exact date alignment for Batch A orders"
    }

    # Case B: Multi-candidate split for Zenith Electronics
    merch_amb_2 = MERCHANTS[1]  # ZEN
    base_date_b = start_date + timedelta(days=14)
    
    ord_b1 = f"ORD-{merch_amb_2['prefix']}-{order_counter}"
    order_counter += 1
    orders.append({"order_id": ord_b1, "merchant_id": merch_amb_2["id"], "amount": 7200.0, "order_date": (base_date_b - timedelta(days=5)).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    
    ord_b2 = f"ORD-{merch_amb_2['prefix']}-{order_counter}"
    order_counter += 1
    ord_b3 = f"ORD-{merch_amb_2['prefix']}-{order_counter}"
    order_counter += 1
    orders.append({"order_id": ord_b2, "merchant_id": merch_amb_2["id"], "amount": 4200.0, "order_date": (base_date_b).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    orders.append({"order_id": ord_b3, "merchant_id": merch_amb_2["id"], "amount": 3000.0, "order_date": (base_date_b).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    
    pay_amb_2 = f"PAY-{payout_counter}"
    payout_counter += 1
    payouts.append({
        "payout_id": pay_amb_2,
        "amount": 7200.0,
        "date": (base_date_b + timedelta(days=1)).strftime("%Y-%m-%d"),
        "payout_type": "split_multi_order",
        "raw_narration": f"RTGS-SPLIT-BATCH-2X-ZEN-REF-{ord_b2[-4:]}"
    })
    ground_truth[pay_amb_2] = {
        "payout_id": pay_amb_2,
        "order_ids": [ord_b2, ord_b3],
        "payout_type": "ambiguous_tie_breaker",
        "is_ambiguous": True,
        "expected_method": "agent_subset_sum",
        "expected_reasoning_hint": f"Narration 'SPLIT-BATCH-2X' and reference '{ord_b2[-4:]}' selects the 2-order bundle over older single order"
    }

    # Case C: 3 candidate triplets for FreshGourmet (FGO)
    merch_amb_3 = MERCHANTS[2]  # FGO
    base_date_c = start_date + timedelta(days=18)
    
    ord_c1 = f"ORD-{merch_amb_3['prefix']}-{order_counter}"
    order_counter += 1
    ord_c2 = f"ORD-{merch_amb_3['prefix']}-{order_counter}"
    order_counter += 1
    ord_c3 = f"ORD-{merch_amb_3['prefix']}-{order_counter}"
    order_counter += 1
    orders.append({"order_id": ord_c1, "merchant_id": merch_amb_3["id"], "amount": 1100.0, "order_date": base_date_c.strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    orders.append({"order_id": ord_c2, "merchant_id": merch_amb_3["id"], "amount": 1400.0, "order_date": base_date_c.strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    orders.append({"order_id": ord_c3, "merchant_id": merch_amb_3["id"], "amount": 1500.0, "order_date": base_date_c.strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    
    ord_c4 = f"ORD-{merch_amb_3['prefix']}-{order_counter}"
    order_counter += 1
    ord_c5 = f"ORD-{merch_amb_3['prefix']}-{order_counter}"
    order_counter += 1
    ord_c6 = f"ORD-{merch_amb_3['prefix']}-{order_counter}"
    order_counter += 1
    orders.append({"order_id": ord_c4, "merchant_id": merch_amb_3["id"], "amount": 2000.0, "order_date": (base_date_c + timedelta(days=7)).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    orders.append({"order_id": ord_c5, "merchant_id": merch_amb_3["id"], "amount": 1000.0, "order_date": (base_date_c + timedelta(days=7)).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    orders.append({"order_id": ord_c6, "merchant_id": merch_amb_3["id"], "amount": 1002.0, "order_date": (base_date_c + timedelta(days=7)).strftime("%Y-%m-%d"), "status": "paid", "fee_amount": 0.0})
    
    pay_amb_3 = f"PAY-{payout_counter}"
    payout_counter += 1
    payouts.append({
        "payout_id": pay_amb_3,
        "amount": 4000.0,
        "date": (base_date_c + timedelta(days=1)).strftime("%Y-%m-%d"),
        "payout_type": "split_multi_order",
        "raw_narration": f"ACH-FGO-PRODUCE-SETL-DATE{base_date_c.strftime('%d%m')}-RZP"
    })
    ground_truth[pay_amb_3] = {
        "payout_id": pay_amb_3,
        "order_ids": [ord_c1, ord_c2, ord_c3],
        "payout_type": "ambiguous_tie_breaker",
        "is_ambiguous": True,
        "expected_method": "agent_subset_sum",
        "expected_reasoning_hint": f"Matched exact date {base_date_c.strftime('%d%m')} from narration with 3-order produce batch"
    }

    # Case D: Unresolvable Ghost Payout
    pay_unresolved = f"PAY-{payout_counter}"
    payout_counter += 1
    payouts.append({
        "payout_id": pay_unresolved,
        "amount": 18450.75,
        "date": (start_date + timedelta(days=12)).strftime("%Y-%m-%d"),
        "payout_type": "standard",
        "raw_narration": "UPI-SETL-UNKNOWN-CHARGEBACK-HOLD-99881"
    })
    ground_truth[pay_unresolved] = {
        "payout_id": pay_unresolved,
        "order_ids": [],
        "payout_type": "unresolved",
        "is_ambiguous": False,
        "expected_method": "unresolved",
        "expected_reasoning_hint": "No corresponding internal order found in ledger (unmatched exception)"
    }

    # Save to DataFrame and CSV
    df_orders = pd.DataFrame(orders)
    df_payouts = pd.DataFrame(payouts)
    
    orders_csv = os.path.join(output_dir, "orders.csv")
    payouts_csv = os.path.join(output_dir, "payouts.csv")
    gt_json = os.path.join(output_dir, "ground_truth.json")
    
    df_orders.to_csv(orders_csv, index=False)
    df_payouts.to_csv(payouts_csv, index=False)
    
    with open(gt_json, "w") as f:
        json.dump(ground_truth, f, indent=2)
        
    # Also initialize SQLite DB
    db_path = os.path.join(output_dir, "settlement.db")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("DROP TABLE IF EXISTS payouts")
    cur.execute("DROP TABLE IF EXISTS orders")
    cur.execute("DROP TABLE IF EXISTS matches")
    
    cur.execute("""
        CREATE TABLE payouts (
            payout_id TEXT PRIMARY KEY,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            payout_type TEXT NOT NULL,
            raw_narration TEXT NOT NULL
        )
    """)
    
    cur.execute("""
        CREATE TABLE orders (
            order_id TEXT PRIMARY KEY,
            merchant_id TEXT NOT NULL,
            amount REAL NOT NULL,
            order_date TEXT NOT NULL,
            status TEXT NOT NULL,
            fee_amount REAL NOT NULL DEFAULT 0.0
        )
    """)
    
    cur.execute("""
        CREATE TABLE matches (
            payout_id TEXT PRIMARY KEY,
            order_ids TEXT NOT NULL,
            resolution_method TEXT NOT NULL,
            confidence REAL NOT NULL,
            reasoning TEXT,
            human_verdict TEXT DEFAULT NULL,
            ground_truth_order_ids TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (payout_id) REFERENCES payouts(payout_id)
        )
    """)
    
    df_payouts.to_sql("payouts", conn, if_exists="append", index=False)
    df_orders.to_sql("orders", conn, if_exists="append", index=False)
    
    conn.commit()
    conn.close()
    
    print(f"Generated {len(orders)} orders and {len(payouts)} payouts successfully.")
    print(f"Outputs written to {orders_csv}, {payouts_csv}, {gt_json}, and SQLite DB at {db_path}.")
    
    return len(orders), len(payouts)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic settlement data")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--outdir", type=str, default="data", help="Output directory")
    args = parser.parse_args()
    
    generate_dataset(seed=args.seed, output_dir=args.outdir)
