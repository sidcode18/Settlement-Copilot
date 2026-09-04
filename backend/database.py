import os
import json
import sqlite3
from typing import List, Dict, Any, Optional
import pandas as pd
from backend.models import Payout, Order, MatchRecord

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "settlement.db"))

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db_if_needed():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS payouts (
            payout_id TEXT PRIMARY KEY,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            payout_type TEXT NOT NULL,
            raw_narration TEXT NOT NULL
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            merchant_id TEXT NOT NULL,
            amount REAL NOT NULL,
            order_date TEXT NOT NULL,
            status TEXT NOT NULL,
            fee_amount REAL NOT NULL DEFAULT 0.0
        )
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS matches (
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
    
    conn.commit()
    
    # Check if data exists; if not, populate from CSV if available
    cur.execute("SELECT COUNT(*) FROM payouts")
    count = cur.fetchone()[0]
    conn.close()
    
    if count == 0:
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
        payouts_csv = os.path.join(data_dir, "payouts.csv")
        orders_csv = os.path.join(data_dir, "orders.csv")
        if os.path.exists(payouts_csv) and os.path.exists(orders_csv):
            load_data_from_csv(payouts_csv, orders_csv)

def load_data_from_csv(payouts_path: str, orders_path: str):
    df_payouts = pd.read_csv(payouts_path)
    df_orders = pd.read_csv(orders_path)
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM matches")
    cur.execute("DELETE FROM payouts")
    cur.execute("DELETE FROM orders")
    
    df_payouts.to_sql("payouts", conn, if_exists="append", index=False)
    df_orders.to_sql("orders", conn, if_exists="append", index=False)
    
    conn.commit()
    conn.close()

def get_all_payouts() -> List[Payout]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT payout_id, amount, date, payout_type, raw_narration FROM payouts ORDER BY date ASC, payout_id ASC")
    rows = cur.fetchall()
    conn.close()
    return [Payout(**dict(row)) for row in rows]

def get_all_orders() -> List[Order]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT order_id, merchant_id, amount, order_date, status, fee_amount FROM orders ORDER BY order_date ASC")
    rows = cur.fetchall()
    conn.close()
    return [Order(**dict(row)) for row in rows]

def get_payout_by_id(payout_id: str) -> Optional[Payout]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT payout_id, amount, date, payout_type, raw_narration FROM payouts WHERE payout_id = ?", (payout_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return Payout(**dict(row))
    return None

def get_orders_by_ids(order_ids: List[str]) -> List[Order]:
    if not order_ids:
        return []
    conn = get_db_connection()
    cur = conn.cursor()
    placeholders = ",".join(["?"] * len(order_ids))
    cur.execute(f"SELECT order_id, merchant_id, amount, order_date, status, fee_amount FROM orders WHERE order_id IN ({placeholders})", order_ids)
    rows = cur.fetchall()
    conn.close()
    return [Order(**dict(row)) for row in rows]

def save_matches(matches: List[MatchRecord]):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM matches")
    
    for m in matches:
        cur.execute("""
            INSERT INTO matches (payout_id, order_ids, resolution_method, confidence, reasoning, human_verdict, ground_truth_order_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            m.payout_id,
            json.dumps(m.order_ids),
            m.resolution_method,
            m.confidence,
            m.reasoning or "",
            m.human_verdict,
            json.dumps(m.ground_truth_order_ids) if m.ground_truth_order_ids is not None else None
        ))
    
    conn.commit()
    conn.close()

def get_all_matches(search: Optional[str] = None, method: Optional[str] = None, status: Optional[str] = None) -> List[MatchRecord]:
    conn = get_db_connection()
    cur = conn.cursor()
    
    query = """
        SELECT m.payout_id, m.order_ids, m.resolution_method, m.confidence, m.reasoning, m.human_verdict, 
               m.ground_truth_order_ids, m.created_at,
               p.amount as payout_amount, p.date as payout_date, p.payout_type, p.raw_narration
        FROM matches m
        JOIN payouts p ON m.payout_id = p.payout_id
        ORDER BY p.date ASC, m.payout_id ASC
    """
    cur.execute(query)
    rows = cur.fetchall()
    conn.close()
    
    # Pre-fetch all orders into dict for fast lookup
    all_orders = {o.order_id: o for o in get_all_orders()}
    
    records = []
    for r in rows:
        order_ids_list = json.loads(r["order_ids"]) if r["order_ids"] else []
        gt_ids = json.loads(r["ground_truth_order_ids"]) if r["ground_truth_order_ids"] else None
        
        payout_obj = Payout(
            payout_id=r["payout_id"],
            amount=r["payout_amount"],
            date=r["payout_date"],
            payout_type=r["payout_type"],
            raw_narration=r["raw_narration"]
        )
        
        matched_order_objs = [all_orders[oid] for oid in order_ids_list if oid in all_orders]
        total_matched = sum(o.amount for o in matched_order_objs)
        variance = round(payout_obj.amount - total_matched, 2)
        
        rec = MatchRecord(
            payout_id=r["payout_id"],
            order_ids=order_ids_list,
            resolution_method=r["resolution_method"],
            confidence=r["confidence"],
            reasoning=r["reasoning"],
            human_verdict=r["human_verdict"],
            ground_truth_order_ids=gt_ids,
            created_at=r["created_at"],
            payout=payout_obj,
            matched_orders=matched_order_objs,
            total_matched_amount=total_matched,
            amount_variance=variance
        )
        
        # Apply filters
        if method and rec.resolution_method != method:
            continue
        if status == "reconciled" and rec.resolution_method == "unresolved":
            continue
        if status == "unresolved" and rec.resolution_method != "unresolved":
            continue
        if search:
            s = search.lower()
            in_payout = s in rec.payout_id.lower() or s in rec.payout.raw_narration.lower() or s in rec.payout.payout_type.lower()
            in_orders = any(s in oid.lower() for oid in rec.order_ids)
            in_reasoning = rec.reasoning and s in rec.reasoning.lower()
            if not (in_payout or in_orders or in_reasoning):
                continue
                
        records.append(rec)
        
    return records

def get_match_record(payout_id: str) -> Optional[MatchRecord]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT m.payout_id, m.order_ids, m.resolution_method, m.confidence, m.reasoning, m.human_verdict, 
               m.ground_truth_order_ids, m.created_at,
               p.amount as payout_amount, p.date as payout_date, p.payout_type, p.raw_narration
        FROM matches m
        JOIN payouts p ON m.payout_id = p.payout_id
        WHERE m.payout_id = ?
    """, (payout_id,))
    r = cur.fetchone()
    conn.close()
    
    if not r:
        return None
        
    order_ids_list = json.loads(r["order_ids"]) if r["order_ids"] else []
    gt_ids = json.loads(r["ground_truth_order_ids"]) if r["ground_truth_order_ids"] else None
    
    payout_obj = Payout(
        payout_id=r["payout_id"],
        amount=r["payout_amount"],
        date=r["payout_date"],
        payout_type=r["payout_type"],
        raw_narration=r["raw_narration"]
    )
    matched_orders = get_orders_by_ids(order_ids_list)
    total_matched = sum(o.amount for o in matched_orders)
    variance = round(payout_obj.amount - total_matched, 2)
    
    return MatchRecord(
        payout_id=r["payout_id"],
        order_ids=order_ids_list,
        resolution_method=r["resolution_method"],
        confidence=r["confidence"],
        reasoning=r["reasoning"],
        human_verdict=r["human_verdict"],
        ground_truth_order_ids=gt_ids,
        created_at=r["created_at"],
        payout=payout_obj,
        matched_orders=matched_orders,
        total_matched_amount=total_matched,
        amount_variance=variance
    )

def update_human_verdict(payout_id: str, verdict: str, manual_order_ids: Optional[List[str]] = None, notes: Optional[str] = None) -> bool:
    conn = get_db_connection()
    cur = conn.cursor()
    
    if manual_order_ids is not None:
        cur.execute("""
            UPDATE matches 
            SET human_verdict = ?, order_ids = ?, reasoning = COALESCE(?, reasoning)
            WHERE payout_id = ?
        """, (verdict, json.dumps(manual_order_ids), notes, payout_id))
    else:
        cur.execute("""
            UPDATE matches 
            SET human_verdict = ?, reasoning = CASE WHEN ? IS NOT NULL THEN reasoning || ' [Reviewer Note: ' || ? || ']' ELSE reasoning END
            WHERE payout_id = ?
        """, (verdict, notes, notes, payout_id))
        
    updated = cur.rowcount > 0
    conn.commit()
    conn.close()
    return updated
