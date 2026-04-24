#!/bin/bash
set -e
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
