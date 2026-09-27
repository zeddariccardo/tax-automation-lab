#requires -Version 7.0
# Run as the Windows user who owns the six existing synthetic credentials.
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TalS07Credential {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
 public struct Entry { public uint Flags, Type; public string TargetName, Comment; public long LastWritten; public uint Size; public IntPtr Blob; public uint Persist, AttributeCount; public IntPtr Attributes; public string Alias, UserName; }
 [DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool Read(string target,uint type,uint flags,out IntPtr ptr);
 [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr ptr);
 public static string[] Get(string target) {
  IntPtr p; if(!Read(target,1,0,out p)) throw new Exception("CREDENTIAL_UNAVAILABLE");
  try { var c=Marshal.PtrToStructure<Entry>(p); return new[]{c.UserName,Marshal.PtrToStringUni(c.Blob,(int)c.Size/2)}; }
  finally {CredFree(p);}
 }
}
'@

$names=@('contribuente-a','contribuente-b','studio-a-admin','studio-a-professionista','studio-b-admin','dual-role')
$result=@{}
foreach($name in $names) {
 $c=[TalS07Credential]::Get("TAL-S04-auth-$name")
 if($c[0] -ne "$name@tal-s04.test") {throw 'SYNTHETIC_USERNAME_MISMATCH'}
 $result[$name]=@{email=$c[0];password=$c[1]}
}

$node=(Get-Command node -ErrorAction Stop).Source
$info=[Diagnostics.ProcessStartInfo]::new()
$info.FileName=$node;$info.UseShellExecute=$false;$info.CreateNoWindow=$true
$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
$info.ArgumentList.Add((Join-Path $PSScriptRoot 'auth-hosted-smoke.mjs'))
$p=[Diagnostics.Process]::new();$p.StartInfo=$info;[void]$p.Start()
$out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
try {$p.StandardInput.Write(($result|ConvertTo-Json -Compress));$p.StandardInput.Close();$p.WaitForExit();Write-Output $out.Result}
finally {$result=$null;$c=$null}
if($p.ExitCode -ne 0){throw 'Hosted smoke failed; raw stderr withheld.'}
