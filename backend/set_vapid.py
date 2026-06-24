import json, subprocess

with open("vapid_keys.json") as f:
    keys = json.load(f)

pub = keys["public_key"]
priv = keys["private_key"]

print("Public key:", pub)
print("Private key looks valid:", "BEGIN PRIVATE KEY" in priv)

subprocess.run([
    "fly", "secrets", "set",
    f"VAPID_PUBLIC_KEY={pub}",
    f"VAPID_PRIVATE_KEY={priv}",
], check=True)

print("Done! Fly.io will restart automatically.")