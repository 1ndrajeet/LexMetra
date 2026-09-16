# backend/app/lib/logger.py
"""
Centralized logging for LexMetra.
Set VERBOSE = True for dev/debug, False for quiet production.
"""
import logging
import sys
import time

# ---------------- CONFIG ----------------
VERBOSE = True    # ← flip to False to silence all LexMetra pipeline logs

if VERBOSE:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
else:
    logging.basicConfig(level=logging.WARNING, force=True)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


class Timer:
    """Context manager for step timing."""
    def __init__(self, logger: logging.Logger, label: str):
        self.logger = logger
        self.label = label
        self.start = None

    def __enter__(self):
        self.start = time.perf_counter()
        if VERBOSE:
            self.logger.info(f"→ {self.label}")
        return self

    def __exit__(self, *exc):
        elapsed = (time.perf_counter() - self.start) * 1000
        if VERBOSE:
            mark = "✓" if exc[0] is None else "✗"
            self.logger.info(f"{mark} {self.label}  ({elapsed:.0f} ms)")