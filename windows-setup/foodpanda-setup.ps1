<#
  FoodPanda two-account window setup (KNB POS)
  --------------------------------------------
  Creates two independent desktop/taskbar windows, each signed into a DIFFERENT
  FoodPanda partner account.

  WHY THIS IS NEEDED
  Chrome keeps ONE cookie jar per profile per website. Two ordinary windows on
  partner.foodpanda.com therefore share a single login - which is why pressing
  "FoodPanda 2" in the POS kept showing account 1. The only way to hold two
  logins at once is to give each account its own Chrome PROFILE. That is what
  this script wires up.

  Launch it from 3_FOODPANDA_WINDOWS.bat (handles the execution policy).
#>

$ErrorActionPreference = "Stop"
$FP_URL     = "https://partner.foodpanda.com/live-orders"
$SetupDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$IconDir    = Join-Path $SetupDir "icons"
$Desktop    = [Environment]::GetFolderPath("Desktop")

function Write-Head($text) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Magenta
    Write-Host $text -ForegroundColor Magenta
    Write-Host "============================================================" -ForegroundColor Magenta
}
function Write-Step($text) { Write-Host ""; Write-Host $text -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  OK  $text" -ForegroundColor Green }
function Write-Warn2($text){ Write-Host "  !!  $text" -ForegroundColor Yellow }

Write-Head "KARACHI NASEEB BIRYANI - FoodPanda 1 and 2 window setup"

# ---------------------------------------------------------------- find Chrome
Write-Step "[1/5] Looking for Google Chrome..."
# The @( ) around the pipeline matters: with a single match Where-Object returns
# a bare string, and $chromeCandidates[0] would then hand back its first CHARACTER.
$chromeCandidates = @(@(
    (Join-Path $env:ProgramFiles        "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA        "Google\Chrome\Application\chrome.exe")
) | Where-Object { $_ -and (Test-Path $_) })

if (-not $chromeCandidates) {
    try {
        $reg = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction Stop)."(default)"
        if ($reg -and (Test-Path $reg)) { $chromeCandidates = @($reg) }
    } catch { }
}
if (-not $chromeCandidates) {
    Write-Warn2 "Google Chrome was not found on this computer."
    Write-Host  "     Install Chrome from https://www.google.com/chrome then run this again."
    Read-Host "Press Enter to close"; exit 1
}
$Chrome = $chromeCandidates[0]
Write-Ok "Chrome: $Chrome"

$UserData = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
if (-not (Test-Path $UserData)) {
    Write-Warn2 "Chrome user data folder not found. Open Chrome once, then run this again."
    Read-Host "Press Enter to close"; exit 1
}

# ------------------------------------------------------------- list profiles
Write-Step "[2/5] Reading your Chrome profiles..."
$profiles = @()
try {
    $localState = Get-Content -Raw -LiteralPath (Join-Path $UserData "Local State") | ConvertFrom-Json
    foreach ($p in $localState.profile.info_cache.PSObject.Properties) {
        if (Test-Path (Join-Path $UserData $p.Name)) {
            $profiles += [pscustomobject]@{ Dir = $p.Name; Name = $p.Value.name }
        }
    }
} catch {
    Write-Warn2 "Could not read the profile list ($($_.Exception.Message)). Falling back to 'Default'."
    $profiles = @([pscustomobject]@{ Dir = "Default"; Name = "Default" })
}
if (-not $profiles) { $profiles = @([pscustomobject]@{ Dir = "Default"; Name = "Default" }) }

for ($i = 0; $i -lt $profiles.Count; $i++) {
    Write-Host ("   [{0}] {1}   (folder: {2})" -f ($i + 1), $profiles[$i].Name, $profiles[$i].Dir)
}

function Select-Profile($label, $defaultIndex) {
    while ($true) {
        $ans = Read-Host "   Which profile should $label use? Enter a number (blank = $defaultIndex)"
        if ([string]::IsNullOrWhiteSpace($ans)) { $ans = "$defaultIndex" }
        $n = 0
        if ([int]::TryParse($ans, [ref]$n) -and $n -ge 1 -and $n -le $profiles.Count) {
            return $profiles[$n - 1]
        }
        Write-Warn2 "Enter a number between 1 and $($profiles.Count)."
    }
}

# ------------------------------------------------------- choose the profiles
Write-Step "[3/5] Assigning an account to each window"
Write-Host  "   FoodPanda 1 normally uses the profile you already browse with."
$fp1 = Select-Profile "FoodPanda 1" 1

Write-Host ""
Write-Host "   FoodPanda 2 MUST use a different profile, otherwise both windows"
Write-Host "   share the same login - that is the problem we are fixing."
Write-Host "   [N] Create a brand new profile just for FoodPanda 2  (recommended)"
$fp2Dir = $null; $fp2Label = $null
while (-not $fp2Dir) {
    $ans = Read-Host "   Enter a profile number, or N for a new one (blank = N)"
    if ([string]::IsNullOrWhiteSpace($ans)) { $ans = "N" }
    if ($ans -match '^[Nn]$') {
        $fp2Dir = "FoodPanda2"; $fp2Label = "FoodPanda 2 (new profile)"
        Write-Ok "Chrome will create the profile folder '$fp2Dir' the first time the window opens."
    } else {
        $n = 0
        if ([int]::TryParse($ans, [ref]$n) -and $n -ge 1 -and $n -le $profiles.Count) {
            if ($profiles[$n - 1].Dir -eq $fp1.Dir) {
                Write-Warn2 "That is the same profile as FoodPanda 1 - the logins would clash. Pick another, or N."
            } else {
                $fp2Dir = $profiles[$n - 1].Dir; $fp2Label = $profiles[$n - 1].Name
            }
        } else { Write-Warn2 "Enter a valid number, or N." }
    }
}

# ------------------------------------------------- work out window placement
# Side-by-side halves of the primary screen, so staff always know which window
# is which without hunting through the taskbar.
$posArgs1 = ""; $posArgs2 = ""
try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $wa   = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $half = [int]($wa.Width / 2)
    $posArgs1 = "--window-position=$($wa.X),$($wa.Y) --window-size=$half,$($wa.Height)"
    $posArgs2 = "--window-position=$($wa.X + $half),$($wa.Y) --window-size=$half,$($wa.Height)"
    Write-Ok "FoodPanda 1 will open on the left half, FoodPanda 2 on the right half."
} catch {
    Write-Warn2 "Could not detect the screen size - windows will open wherever Chrome likes."
}

# -------------------------------------------------------- create the shortcuts
Write-Step "[4/5] Creating the desktop shortcuts..."
$shell = New-Object -ComObject WScript.Shell

function New-FpShortcut($fileName, $profileDir, $iconFile, $posArgs, $desc) {
    $lnk = Join-Path $Desktop $fileName
    $sc  = $shell.CreateShortcut($lnk)
    $sc.TargetPath       = $Chrome
    # --app= strips the address bar so it opens as its own taskbar window, and
    # --profile-directory is what actually keeps the two logins apart.
    $sc.Arguments        = "--profile-directory=`"$profileDir`" --app=$FP_URL $posArgs"
    $sc.WorkingDirectory = Split-Path -Parent $Chrome
    $sc.Description      = $desc
    $icon = Join-Path $IconDir $iconFile
    if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }
    $sc.Save()
    Write-Ok "$fileName  ->  profile '$profileDir'"
    return $lnk
}

$lnk1 = New-FpShortcut "FoodPanda 1.lnk" $fp1.Dir "foodpanda-1.ico" $posArgs1 "FoodPanda partner account 1 - live orders"
$lnk2 = New-FpShortcut "FoodPanda 2.lnk" $fp2Dir  "foodpanda-2.ico" $posArgs2 "FoodPanda partner account 2 - live orders [$fp2Label]"

# ------------------------------------------------------------------ finish up
Write-Step "[5/5] Almost done"
Write-Host "   Two shortcuts are now on your Desktop, with a pink 1 and a pink 2."
Write-Host ""
Write-Host "   TO PIN THEM (do this once, inside EACH window):" -ForegroundColor White
Write-Host "     Use Chrome's own shortcut tool - other ways of pinning collapse"
Write-Host "     into a plain Chrome button:"
Write-Host "       1. 3-dots menu -> 'Save and share' -> 'Create shortcut...'"
Write-Host "          (older Chrome: 'More tools' -> 'Create shortcut...')"
Write-Host "       2. Name it (FoodPanda 1 or 2), TICK 'Open as window', Create"
Write-Host "       3. Right-click the NEW desktop icon -> Pin to taskbar"
Write-Host "     Drag the pins so 1 sits LEFT of 2  (left = account 1)"
Write-Host ""
Write-Host "   FIRST TIME ONLY: open each window and sign in with THAT"
Write-Host "   account's credentials. Chrome remembers each one separately"
Write-Host "   from then on."
Write-Host ""

$open = Read-Host "   Open both windows now so you can sign in? (Y/N, blank = Y)"
if ([string]::IsNullOrWhiteSpace($open) -or $open -match '^[Yy]$') {
    Start-Process -FilePath $lnk1
    Start-Sleep -Seconds 3   # let Chrome settle before it creates the 2nd profile
    Start-Process -FilePath $lnk2
    Write-Ok "Opened. Sign account 1 into the LEFT window and account 2 into the RIGHT one."
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Read-Host "Press Enter to close"
