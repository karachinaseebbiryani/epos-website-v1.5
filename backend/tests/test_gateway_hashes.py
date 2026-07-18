"""Offline unit vectors for the JazzCash HMAC + EasyPaisa AES helpers.
Run: python test_gateway_hashes.py  (from the backend directory)
No server or DB needed — copies of the hash logic are validated against
independent recomputation, mirroring exactly what server.py does."""
import hashlib, hmac, base64

# --- JazzCash secure hash (mirror of _jazzcash_secure_hash) ---
def jazzcash_secure_hash(fields, salt):
    vals = [str(v) for k, v in sorted(fields.items())
            if k.lower().startswith("pp") and k != "pp_SecureHash"
            and str(v).strip() != ""]
    msg = salt + "&" + "&".join(vals)
    return hmac.new(salt.encode("utf-8"), msg.encode("utf-8"),
                    hashlib.sha256).hexdigest().upper()

salt = "t50v9z2u2t"
fields = {
    "pp_Version": "1.1",
    "pp_TxnType": "",          # empty -> must be EXCLUDED
    "pp_Language": "EN",
    "pp_MerchantID": "MC12345",
    "pp_Password": "pw123",
    "pp_TxnRefNo": "T20260718120000abcd",
    "pp_Amount": "150000",
    "pp_TxnCurrency": "PKR",
    "pp_TxnDateTime": "20260718120000",
    "pp_TxnExpiryDateTime": "20260718130000",
    "pp_BillReference": "ORDABC123",
    "pp_Description": "Food order",
    "pp_ReturnURL": "http://localhost:8001/api/payments/jazzcash/return",
}
h = jazzcash_secure_hash(fields, salt)

# Independent recomputation: hand-sorted keys, empties dropped.
expected_order = ["pp_Amount", "pp_BillReference", "pp_Description", "pp_Language",
                  "pp_MerchantID", "pp_Password", "pp_ReturnURL", "pp_TxnCurrency",
                  "pp_TxnDateTime", "pp_TxnExpiryDateTime", "pp_TxnRefNo", "pp_Version"]
manual_msg = salt + "&" + "&".join(str(fields[k]) for k in expected_order)
manual = hmac.new(salt.encode(), manual_msg.encode(), hashlib.sha256).hexdigest().upper()
assert h == manual, f"hash mismatch:\n{h}\n{manual}"
assert len(h) == 64 and h == h.upper()

# Verification symmetry: response with pp_SecureHash included verifies with the same fn.
resp = dict(fields)
resp["pp_SecureHash"] = h
assert jazzcash_secure_hash(resp, salt) == h, "pp_SecureHash must be excluded when verifying"

# Tamper detection.
tampered = dict(resp); tampered["pp_Amount"] = "1"
assert jazzcash_secure_hash(tampered, salt) != h
print("JazzCash HMAC vectors: OK")

# --- EasyPaisa merchantHashedReq (mirror of _easypay_hashed_req) ---
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding as crypto_pad

def easypay_hashed_req(fields, hash_key):
    plaintext = "&".join(f"{k}={v}" for k, v in sorted(fields.items())
                         if str(v) != "")
    padder = crypto_pad.PKCS7(128).padder()
    padded = padder.update(plaintext.encode("utf-8")) + padder.finalize()
    enc = Cipher(algorithms.AES(hash_key.encode("utf-8")), modes.ECB()).encryptor()
    return base64.b64encode(enc.update(padded) + enc.finalize()).decode()

key = "0123456789abcdef"  # 16 chars = AES-128
ep_fields = {
    "storeId": "5342",
    "amount": "1500.0",
    "postBackURL": "http://localhost:8001/api/payments/easypaisa/return?ref=EP2607181200aa",
    "orderRefNum": "EP2607181200aa",
    "expiryDate": "20260718 130000",
    "autoRedirect": "1",
    "paymentMethod": "MA_PAYMENT_METHOD",
    "mobileNum": "03001234567",
    "timeStamp": "2026-07-18T12:00:00",
}
token = easypay_hashed_req(ep_fields, key)

# Round-trip: decrypt and confirm the exact sorted plaintext.
dec = Cipher(algorithms.AES(key.encode()), modes.ECB()).decryptor()
padded = dec.update(base64.b64decode(token)) + dec.finalize()
unpadder = crypto_pad.PKCS7(128).unpadder()
plain = (unpadder.update(padded) + unpadder.finalize()).decode()
expected_plain = "&".join(f"{k}={ep_fields[k]}" for k in sorted(ep_fields))
assert plain == expected_plain, f"plaintext mismatch:\n{plain}\n{expected_plain}"
assert plain.startswith("amount="), "alphabetical sort must put amount first"
print("EasyPaisa AES vectors: OK")
print("ALL HASH VECTORS PASS")
