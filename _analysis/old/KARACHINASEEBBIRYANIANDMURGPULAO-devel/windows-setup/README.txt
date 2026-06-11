============================================================
  KARACHI NASEEB BIRYANI AND MURG PULAO - RestoPOS
  Windows Quick Start Guide
============================================================

There are ONLY 2 STEPS:

  STEP 1 - Run 1_INSTALL.bat (ONCE, on first install)
  STEP 2 - Double-click the "RestoPOS" desktop icon (every day after)

------------------------------------------------------------
  BEFORE STEP 1: Make sure these 3 are installed on Windows
------------------------------------------------------------

  1. Python 3.12  ->  https://www.python.org/downloads/release/python-3128/
                      TICK "Add Python to PATH" during install!

                      IMPORTANT: Use Python 3.12 (NOT 3.13 or 3.14).
                      Newer versions don't have prebuilt wheels for
                      all packages yet and install will fail with
                      "Failed to build wheel for pydantic-core".

  2. Node.js LTS  ->  https://nodejs.org/
                      Accept all defaults.

  3. MongoDB      ->  https://www.mongodb.com/try/download/community
                      TICK "Install MongoDB as a Service"!

  RESTART the computer after installing those three.

------------------------------------------------------------
  STEP 1 - FIRST TIME SETUP
------------------------------------------------------------

  Double-click:   1_INSTALL.bat

  This will:
    - Check Python, Node, MongoDB are OK
    - Create config files (.env)
    - Install all Python + JavaScript packages
    - Build the frontend (takes ~2 minutes, done only once)
    - Download cloudflared for optional remote access
    - Create a "RestoPOS" shortcut on your Desktop

  Takes 5-10 minutes depending on internet speed.

------------------------------------------------------------
  STEP 2 - DAILY USE
------------------------------------------------------------

  Double-click "RestoPOS" on your Desktop

  - Everything starts SILENTLY in the background
  - No command windows appear
  - Browser opens automatically at http://localhost:8001
  - First launch: ~5 seconds

  LOGIN:  admin@restaurant.com
          admin123

  (Change this password from Settings > Users BEFORE going live.)

------------------------------------------------------------
  TO STOP THE APP
------------------------------------------------------------

  Either:
    - Restart the computer (simplest), OR
    - Double-click  STOP_RESTOPOS.bat

  Your data is always safe - MongoDB stores it.

------------------------------------------------------------
  REMOTE ACCESS FROM ANYWHERE (optional)
------------------------------------------------------------

  When RestoPOS is running, cloudflared.exe creates a random
  temporary public URL like:

     https://some-random-words.trycloudflare.com

  It's written in:  cloudflared.log  (in the project folder)

  Open that URL from any phone/laptop anywhere in the world
  to access your POS. The URL changes each restart.

------------------------------------------------------------
  COMMON ISSUES
------------------------------------------------------------

  "Python not found"     ->  You forgot to tick "Add Python to PATH".
                              Reinstall Python with that checkbox ticked.

  "Failed to build wheel  ->  You have Python 3.13 or 3.14.
   for pydantic-core"         Uninstall it (Settings > Apps) and
                              install Python 3.12 instead:
                              https://www.python.org/downloads/release/python-3128/

  "Mongo not running"    ->  Press Win+R, type services.msc, find
                          "MongoDB Server", right-click, Start.

  App opens blank     ->  Wait 5 seconds and refresh the browser.

  "Port 8001 in use"  ->  Run STOP_RESTOPOS.bat, then start again.

------------------------------------------------------------
  FEATURES
------------------------------------------------------------

  - POS / Sales with sticky Current Order panel
  - Menu Management with drag-and-drop reordering
  - Old Orders (search + reprint any receipt)
  - X / Z Reports with auto-email / auto-WhatsApp
  - Voice Assistant (Urdu / Punjabi)           *
  - Custom Logo / Branding (drag-drop upload)
  - Inventory, Expenses, Vendors, Refunds
  - Multi-user + per-user permissions

  * Voice Assistant needs an EMERGENT_LLM_KEY in backend\.env
    Get yours from Emergent > Profile > Universal Key

============================================================
