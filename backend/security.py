"""
Input sanitization utilities for prompt injection prevention (CWE-94).
All user input passes through sanitize_input() before reaching any LLM.
"""
import re
import logging

logger = logging.getLogger(__name__)

# Hard limits
MAX_INPUT_LENGTH = 4000
MAX_MESSAGES = 20


_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?",
    r"disregard\s+(all\s+)?(previous|prior|above)\s+instructions?",
    r"you\s+are\s+now\s+(?!an?\s+(resume|ai|assistant))",
    r"system\s*:\s*",
    r"<\s*system\s*>",
    r"\[INST\]",
    r"###\s*instruction",
    r"act\s+as\s+(?!an?\s+(resume|ai|assistant))",
    r"jailbreak",
    r"dan\s+mode",
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS]


def sanitize_input(text: str) -> str:
    """
    Sanitize user input:
    - Enforce length limit
    - Strip null bytes and control characters (except newlines/tabs)
    - Detect and neutralize prompt injection patterns
    """
    if not isinstance(text, str):
        return ""
    text = text[:MAX_INPUT_LENGTH]
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    for pattern in _COMPILED:
        if pattern.search(text):
            logger.warning("Potential prompt injection detected, neutralizing.")
            text = pattern.sub("[removed]", text)
    return text.strip()
