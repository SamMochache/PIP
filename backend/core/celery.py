"""
Celery Application
==================
Celery is a task queue — it runs slow or scheduled work in the background
so that API requests return quickly.

We use it for:
  - Document ingestion (PDF parsing + embedding can take 10–30 seconds)
  - Scheduled FAISS re-indexing (e.g., every night at 2 AM via Airflow/Cron)

How it works:
  1. A Django view triggers a task: `ingest_document.delay(doc_id)`
  2. Celery picks it up from Redis (the broker)
  3. A Celery worker process runs the task in the background
  4. Result is stored back in Redis (the result backend)
"""

import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery("pip_support")

# Read config from Django settings — any setting prefixed CELERY_ is used
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks.py files in all installed apps
app.autodiscover_tasks()
