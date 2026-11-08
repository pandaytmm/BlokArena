Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)

Dim req, up
up = False
On Error Resume Next
Set req = CreateObject("MSXML2.XMLHTTP")
req.Open "GET", "http://127.0.0.1:3010/api/bootstrap", False
req.Send
If Err.Number = 0 And req.Status = 200 Then up = True
On Error GoTo 0

If Not up Then
  sh.Run """" & base & "\start-backend-hidden.vbs""", 0, False
End If
