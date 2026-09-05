# Karachi Naseeb Biryani - App & API Information

## Mobile App Details

**App Name:** Karachi Naseeb Biryani-PK
**Package Name:** `com.karachinaseeb.knb_customer`
**Platform:** Android (Flutter)

## Google Cloud API Key Configuration

### Current Setup ✅
**API Key:** `AIzaSyD55uTcF0f508i3m9SRfPHO_rTwNn7nFf0`

**Website Restrictions (Already Applied):**
- https://karachinaseebbiryani.com/*
- https://www.karachinaseebbiryani.com/*

### If Mobile App Uses Google Maps

**To add Android app restriction:**

1. Go to: https://console.cloud.google.com/google/maps-apis/credentials
2. Click your API key
3. Under "Application restrictions" → "Android apps"
4. Add:
   - Package name: `com.karachinaseeb.knb_customer`
   - SHA-1 fingerprint: [Get from your keystore - see below]

### Get SHA-1 Fingerprint

**For Debug/Testing:**
```bash
cd D:\epos-website-v1.5\mobile\android
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**For Production/Release:**
```bash
keytool -list -v -keystore D:\epos-website-v1.5\mobile\android\app\upload-keystore.jks -alias upload
```
(Password: check your key.properties file)

Look for the line that says "SHA1:" in the output.

---

## Google Play Console

**App Name:** Karachi Naseeb Biryani-PK
**Package Name:** com.karachinaseeb.knb_customer

If you're publishing on Google Play, use these same details.

---

## Cost Tracking

**Billing Account:** 01C25C-B58D81-F64042 or 018BF7-CBDB4E-91FF13
**Recent Charge:** £22 (Refund requested)

**To prevent future charges:**
✅ API key restricted to your domains
✅ Refund requested
⚠️ Set billing alert at £12 (if not done yet)
⚠️ Check if mobile app is also using Maps API (could be doubling costs)

---

## Quick Check: Is Mobile App Using Google Maps?

The mobile app might be using Google Maps for:
- Delivery tracking map
- Location selection
- Distance calculation

If yes, this could explain the high API usage (website + mobile = 2x the API calls).

**Solution if mobile app uses Maps:**
- Create separate API key for mobile
- Or switch mobile app to use OpenStreetMap (free)
- Or use static location instead of interactive map

---

## Summary of Current Protection

✅ Website API key restricted
✅ Refund requested from Google
⏳ Waiting for refund response (24-48 hours)
❓ Need to check: Is mobile app also using Google Maps API?

If mobile app is using Maps, that's likely where most of the £22 charge came from (more users on mobile than website typically).
