#requires -Version 5.1

<#
.SYNOPSIS
Opens a Chrome window in one cell of a 2x2 grid on a selected display.

.EXAMPLE
.\Spawn-ChromeGrid.ps1 -Display 2 -Position 3

.EXAMPLE
.\Spawn-ChromeGrid.ps1 -Display 1 -Position 2 -Url 'https://example.com'

.EXAMPLE
.\Spawn-ChromeGrid.ps1 -ListDisplays

.NOTES
Positions are 1=top-left, 2=top-right, 3=bottom-left, and 4=bottom-right.
By default, the grid covers the display's working area, excluding its taskbar.
#>
[CmdletBinding()]
param(
    [int] $Display,

    [int] $Position,

    [string] $Url = 'chrome://newtab',

    [string] $ChromePath,

    [switch] $IncludeTaskbar,

    [switch] $ListDisplays,

    [ValidateRange(1, 60)]
    [int] $TimeoutSeconds = 15
)

$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'This script requires Windows.'
}

Add-Type -AssemblyName System.Windows.Forms
if (-not ('ChromeGridNativeV2' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public struct ChromeGridRectV2
{
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

public static class ChromeGridNativeV2
{
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder className, int maxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(
        IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int command);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out ChromeGridRectV2 rect);

    [DllImport("user32.dll")]
    public static extern uint GetDpiForWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetricsForDpi(int index, uint dpi);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(
        IntPtr hWnd, int attribute, out ChromeGridRectV2 value, int valueSize);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

    public static long[] GetChromeWindows()
    {
        var windows = new List<long>();
        EnumWindows(delegate (IntPtr hWnd, IntPtr lParam) {
            if (!IsWindowVisible(hWnd)) return true;

            var className = new StringBuilder(256);
            GetClassName(hWnd, className, className.Capacity);
            if (className.ToString() != "Chrome_WidgetWin_1") return true;

            uint processId;
            GetWindowThreadProcessId(hWnd, out processId);
            try {
                using (var process = System.Diagnostics.Process.GetProcessById((int)processId)) {
                    if (String.Equals(process.ProcessName, "chrome", StringComparison.OrdinalIgnoreCase))
                        windows.Add(hWnd.ToInt64());
                }
            } catch { }
            return true;
        }, IntPtr.Zero);
        return windows.ToArray();
    }
}
'@
}

# Per-monitor-v2 DPI awareness makes Screen coordinates and SetWindowPos coordinates
# use the same physical-pixel coordinate system, including on mixed-DPI setups.
[void] [ChromeGridNativeV2]::SetProcessDpiAwarenessContext([IntPtr]::new(-4))

$screens = @([System.Windows.Forms.Screen]::AllScreens)

if ($ListDisplays) {
    for ($index = 0; $index -lt $screens.Count; $index++) {
        $screen = $screens[$index]
        [pscustomobject]@{
            Display     = $index + 1
            Device      = $screen.DeviceName
            Primary     = $screen.Primary
            Bounds      = '{0},{1} {2}x{3}' -f $screen.Bounds.X, $screen.Bounds.Y, $screen.Bounds.Width, $screen.Bounds.Height
            WorkingArea = '{0},{1} {2}x{3}' -f $screen.WorkingArea.X, $screen.WorkingArea.Y, $screen.WorkingArea.Width, $screen.WorkingArea.Height
        }
    }
    return
}

if ($Display -lt 1 -or $Display -gt $screens.Count) {
    throw "Display must be between 1 and $($screens.Count). Run with -ListDisplays to see the numbering."
}
if ($Position -lt 1 -or $Position -gt 4) {
    throw 'Position must be 1 (top-left), 2 (top-right), 3 (bottom-left), or 4 (bottom-right).'
}

if (-not $ChromePath) {
    $candidates = @(
        (Get-ItemProperty -Path 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
        (Get-ItemProperty -Path 'Registry::HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
    $ChromePath = $candidates | Select-Object -First 1
}
if (-not $ChromePath -or -not (Test-Path -LiteralPath $ChromePath)) {
    throw 'Chrome was not found. Pass its full executable path with -ChromePath.'
}

$area = if ($IncludeTaskbar) { $screens[$Display - 1].Bounds } else { $screens[$Display - 1].WorkingArea }
$leftWidth = [int] [Math]::Floor($area.Width / 2)
$topHeight = [int] [Math]::Floor($area.Height / 2)
$rightWidth = $area.Width - $leftWidth
$bottomHeight = $area.Height - $topHeight

$column = ($Position - 1) % 2
$row = [int] [Math]::Floor(($Position - 1) / 2)
$x = if ($column -eq 0) { $area.X } else { $area.X + $leftWidth }
$y = if ($row -eq 0) { $area.Y } else { $area.Y + $topHeight }
$width = if ($column -eq 0) { $leftWidth } else { $rightWidth }
$height = if ($row -eq 0) { $topHeight } else { $bottomHeight }

$existingWindows = @{}
foreach ($handle in [ChromeGridNativeV2]::GetChromeWindows()) {
    $existingWindows[$handle] = $true
}

# Chrome may create the window in an already-running process, so the process
# returned by Start-Process cannot reliably identify the new top-level window.
Start-Process -FilePath $ChromePath -ArgumentList @('--new-window', $Url) | Out-Null

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
$newHandle = $null
do {
    foreach ($handle in [ChromeGridNativeV2]::GetChromeWindows()) {
        if (-not $existingWindows.ContainsKey($handle)) {
            $newHandle = [IntPtr]::new($handle)
            break
        }
    }
    if (-not $newHandle) { Start-Sleep -Milliseconds 100 }
} while (-not $newHandle -and [DateTime]::UtcNow -lt $deadline)

if (-not $newHandle) {
    throw "Chrome started, but its new window was not detected within $TimeoutSeconds seconds."
}

# Restore first in case Chrome reused remembered maximized state, then assign an
# initial rectangle so DWM can calculate the window's current visible frame.
[void] [ChromeGridNativeV2]::ShowWindow($newHandle, 9) # SW_RESTORE
[void] [ChromeGridNativeV2]::SetWindowPos($newHandle, [IntPtr]::Zero, $x, $y, $width, $height, 0x0044)
Start-Sleep -Milliseconds 150

# GetWindowRect includes Chrome's transparent resize borders. DWM's extended
# frame bounds describe what is actually visible. Compensate for the difference
# so adjacent visible frames touch and no desktop background shows through.
$windowRect = [ChromeGridRectV2]::new()
$visibleRect = [ChromeGridRectV2]::new()
$gotWindowRect = [ChromeGridNativeV2]::GetWindowRect($newHandle, [ref] $windowRect)
$dwmResult = [ChromeGridNativeV2]::DwmGetWindowAttribute(
    $newHandle,
    9, # DWMWA_EXTENDED_FRAME_BOUNDS
    [ref] $visibleRect,
    [System.Runtime.InteropServices.Marshal]::SizeOf([type] [ChromeGridRectV2])
)

if ($gotWindowRect -and $dwmResult -eq 0) {
    $insetLeft = $visibleRect.Left - $windowRect.Left
    $insetTop = $visibleRect.Top - $windowRect.Top
    $insetRight = $windowRect.Right - $visibleRect.Right
    $insetBottom = $windowRect.Bottom - $visibleRect.Bottom

    # Some Chrome/Windows combinations report the transparent resize region as
    # part of DWM's extended frame too. The system resize metrics provide the
    # correct fallback and automatically scale for the destination display DPI.
    $windowDpi = [ChromeGridNativeV2]::GetDpiForWindow($newHandle)
    if ($windowDpi -eq 0) { $windowDpi = 96 }
    $resizeBorder =
        [ChromeGridNativeV2]::GetSystemMetricsForDpi(32, $windowDpi) + # SM_CXSIZEFRAME
        [ChromeGridNativeV2]::GetSystemMetricsForDpi(92, $windowDpi)   # SM_CXPADDEDBORDER
    # Chrome's visible side edge begins one physical pixel inside Windows'
    # reported resize zone. Using the full metric makes each cell 1-2 pixels
    # too wide where two horizontally adjacent windows overlap.
    $horizontalResizeBorder = [Math]::Max(0, $resizeBorder - 1)
    $insetLeft = [Math]::Max($insetLeft, $horizontalResizeBorder)
    $insetRight = [Math]::Max($insetRight, $horizontalResizeBorder)
    $insetBottom = [Math]::Max($insetBottom, $resizeBorder)

    $outerX = $x - $insetLeft
    $outerY = $y - $insetTop
    $outerWidth = $width + $insetLeft + $insetRight
    $outerHeight = $height + $insetTop + $insetBottom
} else {
    # DWM composition should always be available on supported Windows versions,
    # but retain the original behavior if its frame query unexpectedly fails.
    $outerX = $x
    $outerY = $y
    $outerWidth = $width
    $outerHeight = $height
}

for ($attempt = 0; $attempt -lt 2; $attempt++) {
    [void] [ChromeGridNativeV2]::SetWindowPos(
        $newHandle,
        [IntPtr]::Zero,
        $outerX,
        $outerY,
        $outerWidth,
        $outerHeight,
        0x0044
    )
    if ($attempt -eq 0) { Start-Sleep -Milliseconds 100 }
}

[pscustomobject]@{
    Display  = $Display
    Position = $Position
    X        = $x
    Y        = $y
    Width    = $width
    Height   = $height
    Url      = $Url
}
