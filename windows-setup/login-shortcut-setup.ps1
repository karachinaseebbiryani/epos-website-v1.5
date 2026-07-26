<#
  KNB Admin Login - one-click desktop shortcut
  ---------------------------------------------
  Puts a single big red "K" icon on the Desktop that opens the admin sign-in
  page directly in its own window. The browser's saved password fills itself
  in, so the only thing to do is click the red Sign In button.

  Run from 4_LOGIN_SHORTCUT.bat (handles the execution policy).
#>

$ErrorActionPreference = "Stop"
$LOGIN_URL = "https://www.karachinaseebbiryani.com/admin/sign-in"
$SetupDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$IconDir   = Join-Path $SetupDir "icons"
$Desktop   = [Environment]::GetFolderPath("Desktop")

function Head($t){ Write-Host ""; Write-Host "============================================================" -ForegroundColor Red; Write-Host $t -ForegroundColor Red; Write-Host "============================================================" -ForegroundColor Red }
function Ok($t){ Write-Host "  OK  $t" -ForegroundColor Green }
function Warn2($t){ Write-Host "  !!  $t" -ForegroundColor Yellow }

Head "KARACHI NASEEB - One-click login shortcut"

# find Chrome (@( ) guard: a single match must stay an array)
$cands = @(@(
    (Join-Path $env:ProgramFiles        "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA        "Google\Chrome\Application\chrome.exe")
) | Where-Object { $_ -and (Test-Path $_) })
if (-not $cands) {
    try {
        $reg = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction Stop)."(default)"
        if ($reg -and (Test-Path $reg)) { $cands = @($reg) }
    } catch { }
}
if (-not $cands) {
    Warn2 "Google Chrome was not found. Install it from https://www.google.com/chrome and run this again."
    Read-Host "Press Enter to close"; exit 1
}
$Chrome = $cands[0]
Ok "Chrome: $Chrome"

# create the shortcut
$shell = New-Object -ComObject WScript.Shell
$lnk = Join-Path $Desktop "KNB Login.lnk"
$sc  = $shell.CreateShortcut($lnk)
$sc.TargetPath       = $Chrome
$sc.Arguments        = "--app=$LOGIN_URL"
$sc.WorkingDirectory = Split-Path -Parent $Chrome
$sc.Description      = "Open the Karachi Naseeb admin login"
$icon = Join-Path $IconDir "knb-login.ico"
if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }
$sc.Save()
Ok "Created Desktop shortcut: 'KNB Login' (big red K)"

Write-Host ""
Write-Host "  NEXT - do this ONCE so the password saves:" -ForegroundColor White
Write-Host "    1. Double-click the red 'KNB Login' icon."
Write-Host "    2. Type the email and password ONE time."
Write-Host "    3. When Chrome asks 'Save password?' click SAVE."
Write-Host "  After that it fills in by itself - he only clicks the red Sign In button."
Write-Host ""
Write-Host "  TO PIN IT to the taskbar (recommended):" -ForegroundColor White
Write-Host "    Right-click 'KNB Login' -> Show more options -> Pin to taskbar"
Write-Host ""

$open = Read-Host "  Open it now to sign in and save the password? (Y/N, blank = Y)"
if ([string]::IsNullOrWhiteSpace($open) -or $open -match '^[Yy]$') {
    Start-Process -FilePath $lnk
    Ok "Opened. Sign in once and click SAVE when Chrome offers to remember the password."
}
Write-Host ""
Write-Host "Done." -ForegroundColor Green
Read-Host "Press Enter to close"
