' ===================================================================
' RestoPOS - Daily Silent Launcher
' Double-click this file (or the desktop shortcut) to start RestoPOS
' Everything runs HIDDEN in the background - no CMD windows visible
'
' Architecture: backend (port 8001) serves both API and built frontend.
' Single port = single origin = fast, no proxy needed, tunnel-ready.
' ===================================================================

Option Explicit
Dim WshShell, fso, scriptDir, projectDir, Q
Dim cloudflaredExe, cloudflaredLog, cmdStr

Q = Chr(34) ' double-quote character

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

' --- Sanity check: did the user run setup first? ---
If Not fso.FileExists(projectDir & "\backend\.env") Then
  MsgBox "First time setup not done yet." & vbCrLf & vbCrLf & _
    "Please double-click 1_INSTALL.bat in this folder first." & vbCrLf & _
    "It only needs to run ONCE.", vbExclamation, "RestoPOS Setup Required"
  WScript.Quit
End If

If Not fso.FolderExists(projectDir & "\frontend\build") Then
  MsgBox "Frontend has not been built yet." & vbCrLf & vbCrLf & _
    "Please run 1_INSTALL.bat (it will build the frontend in ~2 minutes)." & vbCrLf & _
    "After that, this launcher will start instantly every time.", _
    vbExclamation, "RestoPOS Build Required"
  WScript.Quit
End If

' --- Kill any leftover instance on our port (silent) ---
WshShell.Run "cmd /c for /f " & Q & "tokens=5" & Q & " %a in ('netstat -aon ^| findstr " & Q & ":8001" & Q & " ^| findstr " & Q & "LISTENING" & Q & "') do taskkill /F /PID %a >nul 2>&1", 0, True

' --- Start backend hidden (also serves the built frontend at "/") ---
cmdStr = "cmd /c cd /d " & Q & projectDir & "\backend" & Q & " && python -m uvicorn server:app --host 0.0.0.0 --port 8001 > nul 2>&1"
WshShell.Run cmdStr, 0, False

' --- Start Cloudflare Tunnel hidden (for remote access from anywhere) ---
cloudflaredExe = scriptDir & "\cloudflared.exe"
cloudflaredLog = projectDir & "\cloudflared.log"
If fso.FileExists(cloudflaredExe) Then
  If fso.FileExists(cloudflaredLog) Then fso.DeleteFile cloudflaredLog, True
  cmdStr = Q & cloudflaredExe & Q & " tunnel --url http://localhost:8001 --logfile " & Q & cloudflaredLog & Q & " --loglevel info"
  WshShell.Run cmdStr, 0, False
End If

' --- Wait for backend to start ---
WScript.Sleep 4000

' --- Open browser ---
WshShell.Run "http://localhost:8001", 1, False

' Done - this VBS exits, services keep running in background
