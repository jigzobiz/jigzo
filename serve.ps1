# =========================================================
#  Jigzo tiny local dev server (no Node/Python required)
#  Serves this folder over http://localhost:8123
#  Run:   powershell -ExecutionPolicy Bypass -File .\serve.ps1
#  Stop:  Ctrl+C
# =========================================================

param([int]$Port = 8123)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = $Port
$prefix = "http://localhost:$port/"

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.css'='text/css; charset=utf-8';   '.js'='application/javascript; charset=utf-8';
  '.jsx'='application/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif';
  '.svg'='image/svg+xml'; '.ico'='image/x-icon';
  '.otf'='font/otf'; '.ttf'='font/ttf'; '.woff'='font/woff'; '.woff2'='font/woff2';
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not start server on $prefix" -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host ""
Write-Host "  Jigzo dev server is running." -ForegroundColor Green
Write-Host "  Landing page : ${prefix}index.html"
Write-Host "  Puzzle flow  : ${prefix}create.html"
Write-Host "  Identity board: ${prefix}jigzo-identity-application.html"
Write-Host "  (Press Ctrl+C to stop)"
Write-Host ""

$rootFull = [System.IO.Path]::GetFullPath($root)

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $rel = $rel -replace '/', '\'
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))

    # block path traversal outside the served folder
    if (-not $full.StartsWith($rootFull)) {
      $res.StatusCode = 403
      $b = [System.Text.Encoding]::UTF8.GetBytes('403 Forbidden')
      $res.OutputStream.Write($b, 0, $b.Length)
    }
    elseif (Test-Path -LiteralPath $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ("  200  /{0}" -f ($rel -replace '\\','/'))
    }
    else {
      $res.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $res.OutputStream.Write($b, 0, $b.Length)
      Write-Host ("  404  /{0}" -f ($rel -replace '\\','/')) -ForegroundColor DarkYellow
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    $res.OutputStream.Close()
  }
}
