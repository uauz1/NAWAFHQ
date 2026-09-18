param(
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$TokenFile = Join-Path $Root "bridge-token.txt"

if (-not (Test-Path $TokenFile)) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  Set-Content -Path $TokenFile -Value $token -Encoding ascii
} else {
  $token = (Get-Content $TokenFile -Raw).Trim()
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NavWin32 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@

$targets = @{
  whatsapp = @{ type="protocol"; value="whatsapp:"; process="WhatsApp"; title="WhatsApp" }
  chrome    = @{ type="app"; value="chrome.exe"; process="chrome"; title="Chrome" }
  vscode    = @{ type="app"; value="code"; process="Code"; title="Visual Studio Code" }
  nawafhq   = @{ type="url"; value="https://nawaf-hq-v2.onrender.com/"; process="chrome"; title="NAWAF HQ" }
  mueen     = @{ type="url"; value="https://mueen-islamic-app.vercel.app/"; process="chrome"; title="مُعين" }
  qaddha    = @{ type="url"; value="https://qaddha.vercel.app/"; process="chrome"; title="قدّها" }
  githubhq  = @{ type="url"; value="https://github.com/uauz1/NAWAFHQ"; process="chrome"; title="GitHub" }
}

function Add-Cors($response) {
  $response.Headers["Access-Control-Allow-Origin"] = "*"
  $response.Headers["Access-Control-Allow-Headers"] = "Content-Type, X-NAV-Token"
  $response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
  $response.Headers["Access-Control-Allow-Private-Network"] = "true"
  $response.Headers["Cache-Control"] = "no-store"
}

function Send-Json($context, [int]$status, $obj) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $context.Response.StatusCode = $status
  $context.Response.ContentType = "application/json; charset=utf-8"
  Add-Cors $context.Response
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.OutputStream.Close()
}

function Get-Body($request) {
  $reader = New-Object IO.StreamReader($request.InputStream, $request.ContentEncoding)
  try { return ($reader.ReadToEnd() | ConvertFrom-Json) }
  finally { $reader.Close() }
}

function Get-Target([string]$name) {
  $key = ([string]$name).ToLowerInvariant()
  if (-not $targets.ContainsKey($key)) { throw "TARGET_NOT_ALLOWED" }
  return @{ key=$key; value=$targets[$key] }
}

function Open-Target([string]$name) {
  $t = Get-Target $name
  switch ($t.value.type) {
    "url" { Start-Process ([string]$t.value.value) }
    "protocol" {
      try { Start-Process ([string]$t.value.value) }
      catch {
        if ($t.key -eq "whatsapp") { Start-Process "https://web.whatsapp.com/" } else { throw }
      }
    }
    "app" {
      try { Start-Process ([string]$t.value.value) }
      catch {
        if ($t.key -eq "chrome") { Start-Process "https://www.google.com/" }
        elseif ($t.key -eq "vscode") {
          $candidates = @(
            "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe",
            "$env:ProgramFiles\Microsoft VS Code\Code.exe",
            "$env:ProgramFiles(x86)\Microsoft VS Code\Code.exe"
          ) | Where-Object { Test-Path $_ } | Select-Object -First 1
          if ($candidates) { Start-Process $candidates } else { throw "VSCODE_NOT_FOUND" }
        } else { throw }
      }
    }
    default { throw "UNSUPPORTED_TARGET_TYPE" }
  }
}

function Focus-Target([string]$name) {
  $t = Get-Target $name
  $shell = New-Object -ComObject WScript.Shell
  $ok = $false
  if ($t.value.title) { $ok = $shell.AppActivate([string]$t.value.title) }
  if (-not $ok -and $t.value.process) {
    $p = Get-Process -Name ([string]$t.value.process) -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($p) { $ok = $shell.AppActivate($p.Id) }
  }
  if (-not $ok) {
    Open-Target $name
    Start-Sleep -Milliseconds 900
    if ($t.value.title) { $ok = $shell.AppActivate([string]$t.value.title) }
  }
  if (-not $ok) { throw "TARGET_NOT_FOCUSED" }
  Start-Sleep -Milliseconds 120
}

function Type-IntoTarget([string]$name, [string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { throw "TEXT_REQUIRED" }
  if ($text.Length -gt 5000) { throw "TEXT_TOO_LONG" }
  Focus-Target $name
  Set-Clipboard -Value $text
  Start-Sleep -Milliseconds 80
  $shell = New-Object -ComObject WScript.Shell
  $shell.SendKeys("^v")
}

function Send-Hotkey([string]$name, [string]$target) {
  if ($target) { Focus-Target $target }
  $keys = @{
    "enter" = "{ENTER}"
    "esc" = "{ESC}"
    "tab" = "{TAB}"
    "shift+tab" = "+{TAB}"
    "ctrl+l" = "^l"
    "ctrl+t" = "^t"
    "ctrl+w" = "^w"
    "ctrl+s" = "^s"
    "ctrl+f" = "^f"
  }
  $k = ([string]$name).ToLowerInvariant()
  if (-not $keys.ContainsKey($k)) { throw "HOTKEY_NOT_ALLOWED" }
  $shell = New-Object -ComObject WScript.Shell
  $shell.SendKeys($keys[$k])
}

function Click-Point([int]$x, [int]$y) {
  if ($x -lt 0 -or $y -lt 0 -or $x -gt 10000 -or $y -gt 10000) { throw "INVALID_COORDINATES" }
  [NavWin32]::SetCursorPos($x, $y) | Out-Null
  Start-Sleep -Milliseconds 60
  [NavWin32]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)
  [NavWin32]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try { $listener.Start() }
catch {
  Write-Host "NAV Bridge could not start on $prefix" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host ""
Write-Host "NAV Windows Bridge v2 is running" -ForegroundColor Green
Write-Host "Address: $prefix"
Write-Host "Pairing token:"
Write-Host $token -ForegroundColor Cyan
Write-Host ""
Write-Host "Keep this window open while NAV controls this PC."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request

    if ($req.HttpMethod -eq "OPTIONS") {
      Send-Json $ctx 200 @{ ok=$true }
      continue
    }

    if ($req.Url.AbsolutePath -eq "/health" -and $req.HttpMethod -eq "GET") {
      Send-Json $ctx 200 @{
        ok=$true
        service="NAV Windows Bridge"
        version="2.0"
        capabilities=@("open","focus","type","hotkey","click")
      }
      continue
    }

    if ($req.Url.AbsolutePath -ne "/command" -or $req.HttpMethod -ne "POST") {
      Send-Json $ctx 404 @{ ok=$false; error="NOT_FOUND" }
      continue
    }

    try { $body = Get-Body $req }
    catch { Send-Json $ctx 400 @{ ok=$false; error="INVALID_JSON" }; continue }

    $provided = [string]$body.token
    if (-not $provided) { $provided = [string]$req.Headers["X-NAV-Token"] }
    if ($provided -ne $token) {
      Send-Json $ctx 401 @{ ok=$false; error="UNAUTHORIZED" }
      continue
    }

    $action = ([string]$body.action).ToLowerInvariant()
    try {
      switch ($action) {
        "open" {
          Open-Target ([string]$body.target)
          Send-Json $ctx 200 @{ok=$true;executed=$true;action=$action;target=$body.target}
        }
        "focus" {
          Focus-Target ([string]$body.target)
          Send-Json $ctx 200 @{ok=$true;executed=$true;action=$action;target=$body.target}
        }
        "type" {
          Type-IntoTarget ([string]$body.target) ([string]$body.text)
          Send-Json $ctx 200 @{ok=$true;executed=$true;action=$action;target=$body.target;characters=([string]$body.text).Length}
        }
        "hotkey" {
          Send-Hotkey ([string]$body.hotkey) ([string]$body.target)
          Send-Json $ctx 200 @{ok=$true;executed=$true;action=$action;hotkey=$body.hotkey;target=$body.target}
        }
        "click" {
          Click-Point ([int]$body.x) ([int]$body.y)
          Send-Json $ctx 200 @{ok=$true;executed=$true;action=$action;x=[int]$body.x;y=[int]$body.y}
        }
        default { Send-Json $ctx 400 @{ok=$false;error="ACTION_NOT_ALLOWED"} }
      }
    } catch {
      Send-Json $ctx 400 @{ok=$false;error=$_.Exception.Message;action=$action}
    }
  }
}
finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}