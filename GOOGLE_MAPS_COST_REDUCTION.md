# Google Maps API Cost Reduction Plan

## Current Problem
- £22 charge for Google Maps API usage
- API key exposed in public HTML (can be stolen)
- Map loads on EVERY page (even pages that don't need it)
- No restrictions on API key usage

---

## Immediate Fixes (Do Today)

### 1. Restrict API Key (CRITICAL - Stop Unauthorized Use)

**Go to:** https://console.cloud.google.com/google/maps-apis/credentials

**Steps:**
1. Click your API key: `AIzaSyD55uTcF0f508i3m9SRfPHO_rTwNn7nFf0`
2. **Application restrictions:**
   - Select "HTTP referrers (web sites)"
   - Add:
     ```
     https://www.karachinaseebbiryani.com/*
     https://karachinaseebbiryani.com/*
     http://localhost:3000/* (for development)
     ```
   - Click "Add an item" for each
3. **API restrictions:**
   - Select "Restrict key"
   - Enable ONLY these APIs:
     - ✅ Maps JavaScript API
     - ✅ Maps Embed API
     - ✅ Geocoding API (if you use it)
     - ❌ Disable all others
4. Click **SAVE**

**Result:** Others can't steal your key, saves money immediately.

### 2. Set Up Cost Alerts

**Go to:** https://console.cloud.google.com/billing/01C25C-B58D81-F64042/budgets

1. Click "Create Budget"
2. Name: "Monthly Maps Budget"
3. Budget amount: **$15 USD** (~£12)
4. Set alerts at:
   - 50% ($7.50)
   - 80% ($12)
   - 100% ($15)
5. Add your email
6. Click "Finish"

**Result:** You'll get email warnings before costs get high.

### 3. Load Maps Only Where Needed (Reduce Usage)

**Current problem:** Map loads on EVERY page (even homepage, menu, etc.)

**Solution:** Load it only on pages that use it:
- Contact page (has map)
- Delivery page (has delivery zone map)
- Checkout page (for address validation - if you use it)

---

## Code Changes to Reduce Costs

### Option A: Lazy Load Maps (Easy - Keep Current Setup)

Only load the Maps API when user visits a page with a map.

**Current:** Map API loads in `index.html` on every page
**Better:** Load it dynamically only when needed

I'll create a helper function for this.

### Option B: Use Static Map Image (FREE - Best for Most Cases)

For contact page, use a static image instead of interactive map:

```html
<img 
  src="https://maps.googleapis.com/maps/api/staticmap?center=31.476160,74.416299&zoom=15&size=600x400&markers=color:red%7C31.476160,74.416299&key=YOUR_KEY"
  alt="Restaurant location map"
/>
```

**Pricing:** Static Maps = $2 per 1,000 loads (vs $7 for JavaScript API)

### Option C: Use OpenStreetMap (100% FREE)

Replace Google Maps with Leaflet.js + OpenStreetMap:
- Zero cost, unlimited usage
- Almost identical look and feel
- 10-minute implementation

---

## Recommended Immediate Plan

### **Step 1: Restrict API Key** (Do now - 2 minutes)
Prevents unauthorized use, could save 50-80% of costs.

### **Step 2: Set Billing Alert** (2 minutes)
Get warned before costs exceed £15/month.

### **Step 3: Replace Contact Page Map** (Optional - 10 minutes)
Use static map image instead of interactive map on contact page.
- Current: $7 per 1,000 loads
- Static: $2 per 1,000 loads
- Savings: 70%

### **Step 4: Evaluate Delivery Zone Map**
Keep interactive map on delivery page (customers need to see radius).
Optimize by caching map tiles.

---

## Monthly Cost Projection After Fixes

**Current:** £22/month (exceeding free tier)

**After API restrictions:** £5-8/month
**After static maps:** £2-4/month  
**After OpenStreetMap:** £0/month

---

## Long-term Solution: Switch to OpenStreetMap

**Benefits:**
- 100% free forever
- No API keys needed
- No billing
- Same functionality

**Implementation time:** 30 minutes

**Libraries to use:**
- Leaflet.js (map rendering)
- React-Leaflet (React wrapper)
- OpenStreetMap tiles (free)

Would you like me to implement this? It would eliminate the Google Maps cost entirely.

---

## What Pages Currently Use Maps?

Let me check which pages actually need the map:

**Pages with maps:**
1. `/contact` - Has embedded map showing restaurant location
2. `/delivery` - Has delivery zone map with radius circle
3. Possibly checkout? (for address validation)

**Pages that DON'T need maps:**
- Homepage
- Menu page
- Orders page
- FAQ page
- About page
- Offers page
- etc.

**Problem:** Map API loads on ALL pages (wasteful!)

---

## Quick Win: Lazy Load Maps Script

Instead of loading maps in `index.html`, load it only when needed:

```javascript
// Load Google Maps only when a map component mounts
function loadGoogleMaps(callback) {
  if (window.google && window.google.maps) {
    callback();
    return;
  }
  
  const script = document.createElement('script');
  script.src = 'https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=places,geometry';
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.head.appendChild(script);
}

// In your map component:
useEffect(() => {
  loadGoogleMaps(() => {
    // Initialize map here
  });
}, []);
```

This loads the API only on pages with maps, not every page.

**Savings:** Could reduce API calls by 80-90%

---

## My Recommendation

**Today (5 minutes):**
1. ✅ Restrict API key to your domains only
2. ✅ Set billing alert at £12

**This week (30 minutes):**
3. ✅ Implement lazy loading for maps
4. ✅ Use static map on contact page

**Result:** Costs drop from £22 to £3-5/month

**OR... switch to OpenStreetMap (free forever)**

Let me know which option you prefer and I'll implement it.

---

## How to Check Your Current Usage

**Go to:** https://console.cloud.google.com/google/maps-apis/metrics

1. Select date range: Last 30 days
2. Look at:
   - Maps JavaScript API: How many map loads?
   - Geocoding API: How many address lookups?
   - Distance Matrix API: How many distance calculations?

This shows exactly what's costing money.
