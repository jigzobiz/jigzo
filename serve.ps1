# =========================================================
#  Jigzo tiny local dev server (no Node/Python required)
#  Listens on ALL interfaces (0.0.0.0), port 5501, so this PC
#  and other devices on the same Wi-Fi (e.g. your phone) can
#  open it. localhost keeps working too.
#  Run:   powershell -ExecutionPolicy Bypass -File .\serve.ps1
#  Stop:  Ctrl+C
#
#  Uses a raw TcpListener (not HttpListener) on purpose: binding
#  0.0.0.0 with a socket needs no admin rights and no http.sys
#  URL reservation, so LAN access works out of the box.
# =========================================================

param([int]$Port = 5501)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = $Port

# --- find this PC's LAN IPv4 (the adapter that actually reaches the router) ---
function Get-LocalIPv4 {
  # 1) the up adapter that has a default gateway = the one on your Wi-Fi/LAN
  try {
    $ip = (Get-NetIPConfiguration -ErrorAction Stop |
      Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
      Select-Object -First 1 -ExpandProperty IPv4Address).IPAddress
    if ($ip) { return $ip }
  } catch {}
  # 2) any real IPv4 that isn't loopback or link-local, lowest interface metric first
  try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
      Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress
    if ($ip) { return $ip }
  } catch {}
  # 3) last resort via DNS
  try {
    $ip = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object { $_.AddressFamily -eq 'InterNetwork' -and
                     $_.IPAddressToString -notlike '127.*' -and
                     $_.IPAddressToString -notlike '169.254.*' } |
      Select-Object -First 1
    if ($ip) { return $ip.IPAddressToString }
  } catch {}
  return $null
}

$localIP = Get-LocalIPv4

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.css'='text/css; charset=utf-8';   '.js'='application/javascript; charset=utf-8';
  '.jsx'='application/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif';
  '.svg'='image/svg+xml'; '.ico'='image/x-icon';
  '.otf'='font/otf'; '.ttf'='font/ttf'; '.woff'='font/woff'; '.woff2'='font/woff2';
}

$rootFull = [System.IO.Path]::GetFullPath($root)

function Send-Response($stream, [int]$status, [string]$statusText, [string]$contentType, [byte[]]$body, [bool]$headOnly) {
  if ($null -eq $body) { $body = New-Object byte[] 0 }
  $head = "HTTP/1.1 $status $statusText`r`n" +
          "Content-Type: $contentType`r`n" +
          "Content-Length: $($body.Length)`r`n" +
          "Access-Control-Allow-Origin: *`r`n" +
          "Connection: close`r`n`r`n"
  $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($headBytes, 0, $headBytes.Length)
  if (-not $headOnly -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

# Bind all interfaces. Prefer a dual-stack (IPv6 + IPv4) socket so BOTH the LAN
# IPv4 and localhost work whether localhost resolves to 127.0.0.1 or ::1; fall
# back to IPv4-only if dual-stack isn't available. Neither needs elevation.
$listener = $null
try {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::IPv6Any, $port)
  $listener.Server.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::IPv6, [System.Net.Sockets.SocketOptionName]::IPv6Only, 0)
  $listener.Start()
} catch {
  try { if ($listener) { $listener.Stop() } } catch {}
  try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
    $listener.Start()
  } catch {
    Write-Host "Could not start server on port $port (is it already in use?)." -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
  }
}

Write-Host ""
Write-Host "  Jigzo dev server is running (listening on 0.0.0.0:$port)." -ForegroundColor Green
Write-Host "  On this PC   : http://localhost:$port/index.html   (create.html, etc.)"
if ($localIP) {
  Write-Host ""
  Write-Host "  On your phone (same Wi-Fi), open:" -ForegroundColor Cyan
  Write-Host ("  http://{0}:{1}/index.html" -f $localIP, $port) -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  If the phone can't connect, allow it through Windows Firewall once" -ForegroundColor DarkGray
  Write-Host "  (run in an elevated PowerShell):" -ForegroundColor DarkGray
  Write-Host ("    netsh advfirewall firewall add rule name=`"Jigzo dev $port`" dir=in action=allow protocol=TCP localport=$port") -ForegroundColor DarkGray
}
else {
  Write-Host ""
  Write-Host "  Listening on all interfaces, but couldn't auto-detect this PC's LAN IPv4." -ForegroundColor Yellow
  Write-Host "  Run 'ipconfig', note the IPv4 Address, then open http://<that-ip>:$port/index.html on your phone."
}
Write-Host "  (Press Ctrl+C to stop)"
Write-Host ""

while ($true) {
  try {
    $client = $listener.AcceptTcpClient()
  } catch {
    break
  }
  try {
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 5000
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000

    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); continue }
    # drain the rest of the request headers (stop at the blank line; don't read into a body)
    while (($line = $reader.ReadLine()) -ne $null -and $line -ne '') {}

    $parts = $requestLine -split ' '
    $method = $parts[0]
    $target = if ($parts.Count -ge 2) { $parts[1] } else { '/' }
    $headOnly = ($method -eq 'HEAD')

    $path = ($target -split '\?')[0]
    $rel = [System.Uri]::UnescapeDataString($path).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $rel = $rel -replace '/', '\'
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))

    if (-not $full.StartsWith($rootFull)) {
      # block path traversal outside the served folder
      $b = [System.Text.Encoding]::UTF8.GetBytes('403 Forbidden')
      Send-Response $stream 403 'Forbidden' 'text/plain; charset=utf-8' $b $headOnly
      Write-Host ("  403  /{0}" -f ($rel -replace '\\','/')) -ForegroundColor DarkYellow
    }
    elseif (Test-Path -LiteralPath $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      Send-Response $stream 200 'OK' $ct $bytes $headOnly
      Write-Host ("  200  /{0}" -f ($rel -replace '\\','/'))
    }
    else {
      $b = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $b $headOnly
      Write-Host ("  404  /{0}" -f ($rel -replace '\\','/')) -ForegroundColor DarkYellow
    }
  } catch {
    # slow/rude client or write error — just move on
  } finally {
    try { $client.Close() } catch {}
  }
}
