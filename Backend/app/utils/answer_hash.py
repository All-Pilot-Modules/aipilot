import hashlib
import json
from typing import Any


def compute_answer_hash(answer: Any) -> str:
    """
    Stable content fingerprint for a student answer payload.

    Same answer content -> same hash, always. Any change to the answer
    (a different selected option, an edited blank, retyped text) produces
    a different hash. Used to detect whether an answer changed after a
    speculative (background) grading job started, so a stale AI result
    is never shown for content the student has since edited.
    """
    if isinstance(answer, str):
        canonical = answer.strip()
    else:
        # sort_keys makes the JSON deterministic regardless of key order
        canonical = json.dumps(answer, sort_keys=True, default=str)

    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
