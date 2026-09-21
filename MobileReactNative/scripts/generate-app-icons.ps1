param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$mobileRoot = Split-Path -Parent $PSScriptRoot
$brandingRoot = Join-Path $mobileRoot 'assets\branding'
$resourceRoot = Join-Path $mobileRoot 'android\app\src\main\res'
$backgroundColor = [System.Drawing.ColorTranslator]::FromHtml('#FFF8EC')

function New-IconBitmap {
  param(
    [System.Drawing.Image]$Source,
    [int]$Size,
    [bool]$Transparent
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    if ($Transparent) {
      $graphics.Clear([System.Drawing.Color]::Transparent)
    } else {
      $graphics.Clear($backgroundColor)
    }

    # The generated artwork already contains transparent breathing room. Scaling
    # it to 88% keeps the visible mark inside Android's central adaptive safe zone.
    $artSize = [int][Math]::Round($Size * 0.88)
    $offset = [int][Math]::Round(($Size - $artSize) / 2)
    $graphics.DrawImage($Source, $offset, $offset, $artSize, $artSize)
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

function Save-Png {
  param(
    [System.Drawing.Image]$Image,
    [string]$Path
  )
  $Image.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath))
try {
  $foregroundMasterPath = Join-Path $brandingRoot 'app-icon-foreground-v6-quiz-book.png'
  Copy-Item -LiteralPath $SourcePath -Destination $foregroundMasterPath -Force

  $master = New-IconBitmap -Source $source -Size 1254 -Transparent $false
  try {
    Save-Png -Image $master -Path (Join-Path $brandingRoot 'app-icon-master-v6-quiz-book.png')
  } finally {
    $master.Dispose()
  }

  $foreground = New-IconBitmap -Source $source -Size 432 -Transparent $true
  try {
    Save-Png -Image $foreground -Path (Join-Path $resourceRoot 'drawable-nodpi\ic_launcher_foreground.png')
  } finally {
    $foreground.Dispose()
  }

  $densitySizes = [ordered]@{
    'mipmap-mdpi' = 48
    'mipmap-hdpi' = 72
    'mipmap-xhdpi' = 96
    'mipmap-xxhdpi' = 144
    'mipmap-xxxhdpi' = 192
  }
  foreach ($entry in $densitySizes.GetEnumerator()) {
    $icon = New-IconBitmap -Source $source -Size $entry.Value -Transparent $false
    try {
      $densityRoot = Join-Path $resourceRoot $entry.Key
      Save-Png -Image $icon -Path (Join-Path $densityRoot 'ic_launcher.png')
      Save-Png -Image $icon -Path (Join-Path $densityRoot 'ic_launcher_round.png')
    } finally {
      $icon.Dispose()
    }
  }
} finally {
  $source.Dispose()
}
