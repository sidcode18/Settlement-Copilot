#!/bin/bash
set -e

echo "================================================================="
echo "        Launching Settlement Copilot (AI Finance Controller)    "
echo "================================================================="

# Find Python interpreter
if [ -f ".venv/bin/python" ]; then
    PYTHON_BIN=".venv/bin/python"
    UVICORN_BIN=".venv/bin/uvicorn"
elif command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
    UVICORN_BIN="uvicorn"
elif [ -f "/opt/anaconda3/bin/python" ]; then
    PYTHON_BIN="/opt/anaconda3/bin/python"
    UVICORN_BIN="/opt/anaconda3/bin/uvicorn"
else
    echo " Error: Python 3 not found."
    exit 1
fi

# Generate initial dataset if missing
if [ ! -f "data/payouts.csv" ] || [ ! -f "data/orders.csv" ]; then
    echo " Generating synthetic settlement dataset..."
    $PYTHON_BIN generate_data.py --seed 42
fi

echo "Starting Settlement Copilot Unified Server on http://127.0.0.1:8000 ..."
$UVICORN_BIN backend.main:app --host 0.0.0.0 --port 8000
