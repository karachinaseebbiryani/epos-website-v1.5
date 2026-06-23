"""
Tests for `_normalize_vapid_pem` — the function that repairs corrupted VAPID PEM
strings coming out of hosting env vars (Fly.io, Vercel, Railway etc.).

We hit a real production bug where the operator pasted the PEM via flyctl secrets
set "...\\n..." and `\\n` was stored as literal backslash-n (2 chars) instead of
real newlines. The cryptography library could find the PEM headers but the base64
body was polluted with backslash-n chars → "ASN.1 parsing error: invalid length".

These tests cover the 5 corruption patterns we've seen and ensure the normalizer
is idempotent on clean PEMs.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from cryptography.hazmat.primitives import serialization

# Skip the whole module if we can't import the backend (e.g. missing env locally).
try:
    from server import _generate_vapid_keys, _normalize_vapid_pem
except Exception as e:  # pragma: no cover
    pytest.skip(f"Cannot import server module: {e}", allow_module_level=True)


@pytest.fixture(scope="module")
def fresh_pem():
    """A genuinely-valid VAPID PEM private key, generated via py-vapid."""
    _, priv = _generate_vapid_keys()
    return priv


def _assert_parses(pem: str):
    """Ensure cryptography can load the (normalized) PEM. Returns the loaded key."""
    fixed = _normalize_vapid_pem(pem)
    return serialization.load_pem_private_key(fixed.encode(), password=None)


# ---------- corruption patterns ----------

def test_literal_backslash_n(fresh_pem):
    """`flyctl secrets set VAPID_PRIVATE_KEY="-----BEGIN...\\n..."` — real-world bug."""
    mangled = fresh_pem.replace("\n", "\\n")
    assert "\\n" in mangled
    assert "\n" not in mangled
    _assert_parses(mangled)


def test_no_newlines_at_all(fresh_pem):
    """Operator stripped every newline before pasting."""
    mangled = fresh_pem.replace("\n", "")
    assert "\n" not in mangled
    _assert_parses(mangled)


def test_wrapping_double_quotes(fresh_pem):
    """Value pasted with surrounding double quotes."""
    mangled = f'"{fresh_pem}"'
    _assert_parses(mangled)


def test_wrapping_single_quotes(fresh_pem):
    """Value pasted with surrounding single quotes."""
    mangled = f"'{fresh_pem}'"
    _assert_parses(mangled)


def test_quotes_plus_backslash_n(fresh_pem):
    """Combined: shell-escaped value with both quotes and literal \\n."""
    mangled = '"' + fresh_pem.replace("\n", "\\n") + '"'
    _assert_parses(mangled)


def test_crlf_line_endings(fresh_pem):
    """Windows-style CRLF endings instead of LF."""
    mangled = fresh_pem.replace("\n", "\r\n")
    _assert_parses(mangled)


def test_leading_trailing_whitespace(fresh_pem):
    """Random whitespace around the key (common from copy-paste)."""
    mangled = "  \n\n" + fresh_pem + "\n  \t  "
    _assert_parses(mangled)


# ---------- idempotency ----------

def test_clean_pem_unchanged(fresh_pem):
    """A pristine PEM should pass through with no destructive edits."""
    fixed = _normalize_vapid_pem(fresh_pem)
    # Either identical, or differs only by a trailing newline (we always end with \n).
    assert fixed == fresh_pem or fixed == fresh_pem + "\n"
    _assert_parses(fixed)


def test_double_normalize_stable(fresh_pem):
    """Running the normalizer twice should not change the result."""
    once = _normalize_vapid_pem(fresh_pem.replace("\n", "\\n"))
    twice = _normalize_vapid_pem(once)
    assert once == twice
    _assert_parses(twice)


# ---------- empty / None ----------

def test_empty_string():
    assert _normalize_vapid_pem("") == ""


def test_none_is_safe():
    # The function accepts None-ish values without exploding (the caller handles
    # the "key missing" case separately).
    assert _normalize_vapid_pem(None) is None or _normalize_vapid_pem("") == ""
