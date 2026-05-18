# Generates public/brush-patterns/rainbow.png (512px wide seamless HSL sweep + sparkle)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size

function Get-RgbFromHue([double]$hueDeg) {
  $h = ($hueDeg % 360) / 360
  $s = 0.94
  $l = 0.54
  if ($s -eq 0) { return [byte[]]@( [byte]($l * 255), [byte]($l * 255), [byte]($l * 255) ) }
  $q = if ($l -lt 0.5) { $l * (1 + $s) } else { $l + $s - $l * $s }
  $p = 2 * $l - $q
  function Hue2Rgb([double]$p, [double]$q, [double]$t) {
    if ($t -lt 0) { $t += 1 }
    if ($t -gt 1) { $t -= 1 }
    if ($t -lt 1 / 6) { return $p + ($q - $p) * 6 * $t }
    if ($t -lt 1 / 2) { return $q }
    if ($t -lt 2 / 3) { return $p + ($q - $p) * (2 / 3 - $t) * 6 }
    return $p
  }
  $r = [byte]([math]::Round(255 * (Hue2Rgb $p $q ($h + 1 / 3))))
  $g = [byte]([math]::Round(255 * (Hue2Rgb $p $q $h)))
  $b = [byte]([math]::Round(255 * (Hue2Rgb $p $q ($h - 1 / 3))))
  return ,@($r, $g, $b)
}

function Get-Hash([int]$x, [int]$y) {
  $n = [math]::Sin($x * 127.1 + $y * 311.7) * 43758.5453123
  return $n - [math]::Floor($n)
}

for ($y = 0; $y -lt $size; $y++) {
  for ($x = 0; $x -lt $size; $x++) {
    $hue = ($x / $size) * 360
    $rgb = Get-RgbFromHue $hue
    if ((Get-Hash $x $y) -gt 0.992) {
      $spark = 0.7 + (Get-Hash ($x + 17) ($y + 31)) * 0.3
      $rgb = @(
        [byte][math]::Min(255, [math]::Round($rgb[0] + (255 - $rgb[0]) * $spark)),
        [byte][math]::Min(255, [math]::Round($rgb[1] + (255 - $rgb[1]) * $spark)),
        [byte][math]::Min(255, [math]::Round($rgb[2] + (255 - $rgb[2]) * $spark))
      )
    }
    $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($rgb[0], $rgb[1], $rgb[2]))
  }
}

$root = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $root 'public\brush-patterns'
$out512 = Join-Path $outDir '_rainbow-src.png'
$bmp.Save($out512, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Wrote $out512"
