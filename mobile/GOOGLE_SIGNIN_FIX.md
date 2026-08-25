# Google Sign-In Fix Guide

## Problem Identified
Google Sign-In is failing because of **SHA-1 certificate fingerprint mismatch** between your app and Firebase Console configuration.

## Current Configuration

### Your Debug Keystore SHA-1
```
B8:C4:43:26:39:F5:D8:95:96:54:E3:3D:A8:B5:71:23:72:34:DE:AA
```

### Registered in Firebase (google-services.json)
```
C6:32:BF:35:DC:51:23:FA:C6:E1:68:EF:E2:C4:94:9A:B6:F2:1D:C2
```

**These don't match!** Google Sign-In requires the SHA-1 used to sign your APK to be registered in Firebase Console.

## Fix Steps

### 1. Add SHA-1 to Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select project: **karachinaseebbiryani-4f6d0**
3. Click gear icon → **Project Settings**
4. Select your Android app: `com.karachinaseeb.knb_customer`
5. Scroll to **SHA certificate fingerprints** section
6. Click **Add fingerprint** button
7. Paste this SHA-1:
   ```
   B8:C4:43:26:39:F5:D8:95:96:54:E3:3D:A8:B5:71:23:72:34:DE:AA
   ```
8. Click **Save**

### 2. Download Updated google-services.json

1. In Firebase Console, stay on the same page
2. Scroll down and click **Download google-services.json**
3. Replace the file at:
   ```
   D:\epos-website-v1.5\mobile\android\app\google-services.json
   ```

### 3. Clean and Rebuild

Run these commands in the mobile directory:

```bash
cd D:\epos-website-v1.5\mobile
flutter clean
flutter pub get
flutter run
```

Or if using Android Studio:
- **Build** → **Clean Project**
- **Build** → **Rebuild Project**
- Run the app

## Additional Information

### Your Firebase Configuration
- **Project ID**: karachinaseebbiryani-4f6d0
- **Project Number**: 557642081718
- **Package Name**: com.karachinaseeb.knb_customer
- **Google Web Client ID** (serverClientId): 
  ```
  557642081718-5fbtdcn4bf8fm5gtjns77ddpp4f9nbm9.apps.googleusercontent.com
  ```

### For Release Builds

If you're building a release APK/AAB, you'll also need to:

1. Get your release keystore SHA-1:
   ```bash
   keytool -list -v -keystore path/to/knb-release.jks -alias knb -storepass KnbRelease2026! -keypass KnbRelease2026!
   ```

2. Add that SHA-1 to Firebase Console as well (same steps as above)

### Debug Keystore Location
```
C:\Users\Jabran Ahmad Hanjra\.android\debug.keystore
```

### How to Get SHA-1 Anytime
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

Or using Android Studio's keytool:
```bash
"D:\ANDROID STUDIO\jbr\bin\keytool" -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

## Verification

After completing the fix:

1. Uninstall the app from your device/emulator completely
2. Rebuild and reinstall the app
3. Try Google Sign-In again
4. Check logcat for any errors:
   ```bash
   adb logcat | grep -i "google\|oauth\|signin"
   ```

## Common Issues

### Still Not Working?

1. **Wait 5-10 minutes** after updating Firebase Console - changes can take time to propagate
2. **Clear app data** on device: Settings → Apps → Karachi Naseeb → Storage → Clear Data
3. **Verify both OAuth clients exist** in Firebase Console:
   - Android client (client_type: 1)
   - Web client (client_type: 3)
4. **Check backend configuration** - ensure backend's `GOOGLE_CLIENT_ID` matches the web client ID

### Error: "Developer Error" or "Error 10"

This specifically indicates SHA-1 mismatch. The fix above resolves this.

### Error: "API not enabled"

Enable these APIs in Google Cloud Console:
- Google Sign-In API
- Google+ API (if required)

## Backend Configuration

Your backend at `https://knb-backend.fly.dev` should have this environment variable:

```
GOOGLE_CLIENT_ID=557642081718-5fbtdcn4bf8fm5gtjns77ddpp4f9nbm9.apps.googleusercontent.com
```

This must match the web client ID in your Firebase project.
