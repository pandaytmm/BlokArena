Option Explicit

Dim fso, sh, base, edge, profile, i
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)

If Not BackendUp() Then
  sh.Run """" & base & "\start-backend-hidden.vbs""", 0, False
  For i = 1 To 40
    WScript.Sleep 500
    If BackendUp() Then Exit For
  Next
End If

edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(edge) Then
  profile = base & "\edge-profile"
  sh.Run """" & edge & """ --app=http://127.0.0.1:3010 --user-data-dir=""" & profile & """ --no-first-run --no-default-browser-check --window-size=1200,860", 1, False
Else
  sh.Run "http://127.0.0.1:3010", 1, False
End If

Function BackendUp()
  Dim req
  BackendUp = False
  On Error Resume Next
  Set req = CreateObject("MSXML2.XMLHTTP")
  req.Open "GET", "http://127.0.0.1:3010/api/bootstrap", False
  req.Send
  If Err.Number = 0 And req.Status = 200 Then BackendUp = True
  On Error GoTo 0
End Function
