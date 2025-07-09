# Windows keyboard simulation script
# Usage: .\key.ps1 <processName> <keyString>
# keyString format: "^l" for Ctrl+L, "cmd+a" for Ctrl+A on Windows, etc.

param(
    [Parameter(Mandatory=$true)]
    [string]$ProcessName,
    
    [Parameter(Mandatory=$true)]
    [string]$KeyString
)

Add-Type -AssemblyName System.Windows.Forms

# Remove .exe extension if present
$ProcessName = $ProcessName -replace '\.exe$', ''

# Get the process and activate its window
$processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
if (-not $processes) {
    $errorJson = @{ error = "App not running: $ProcessName" } | ConvertTo-Json -Compress
    Write-Output $errorJson
    exit 1
}

# Find the process with a main window
$targetProcess = $null
foreach ($proc in $processes) {
    if ($proc.MainWindowHandle -ne 0) {
        $targetProcess = $proc
        break
    }
}

if (-not $targetProcess) {
    $errorJson = @{ error = "No window found for process: $ProcessName" } | ConvertTo-Json -Compress
    Write-Output $errorJson
    exit 1
}

# Activate the window
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    }
"@

[Win32]::ShowWindow($targetProcess.MainWindowHandle, 9) # SW_RESTORE
[Win32]::SetForegroundWindow($targetProcess.MainWindowHandle)

# Small delay to ensure window is active
Start-Sleep -Milliseconds 100

# Parse and send the key string
function Send-KeyCombination {
    param([string]$Keys)
    
    # Handle special key combinations
    # Convert Mac-style to Windows-style
    $Keys = $Keys -replace 'cmd\+', '^'  # cmd+ -> Ctrl
    $Keys = $Keys -replace 'command\+', '^'  # command+ -> Ctrl
    $Keys = $Keys -replace 'option\+', '%'  # option+ -> Alt
    $Keys = $Keys -replace 'opt\+', '%'  # opt+ -> Alt
    $Keys = $Keys -replace 'ctrl\+', '^'  # ctrl+ -> Ctrl
    $Keys = $Keys -replace 'control\+', '^'  # control+ -> Ctrl
    $Keys = $Keys -replace 'alt\+', '%'  # alt+ -> Alt
    $Keys = $Keys -replace 'shift\+', '+'  # shift+ -> Shift
    
    # Handle special keys
    $Keys = $Keys -replace '\breturn\b', '{ENTER}'
    $Keys = $Keys -replace '\benter\b', '{ENTER}'
    $Keys = $Keys -replace '\btab\b', '{TAB}'
    $Keys = $Keys -replace '\besc\b', '{ESC}'
    $Keys = $Keys -replace '\bescape\b', '{ESC}'
    $Keys = $Keys -replace '\bbackspace\b', '{BACKSPACE}'
    $Keys = $Keys -replace '\bdelete\b', '{DELETE}'
    $Keys = $Keys -replace '\bup\b', '{UP}'
    $Keys = $Keys -replace '\bdown\b', '{DOWN}'
    $Keys = $Keys -replace '\bleft\b', '{LEFT}'
    $Keys = $Keys -replace '\bright\b', '{RIGHT}'
    $Keys = $Keys -replace '\bhome\b', '{HOME}'
    $Keys = $Keys -replace '\bend\b', '{END}'
    $Keys = $Keys -replace '\bpgup\b', '{PGUP}'
    $Keys = $Keys -replace '\bpageup\b', '{PGUP}'
    $Keys = $Keys -replace '\bpgdn\b', '{PGDN}'
    $Keys = $Keys -replace '\bpagedown\b', '{PGDN}'
    $Keys = $Keys -replace '\bf1\b', '{F1}'
    $Keys = $Keys -replace '\bf2\b', '{F2}'
    $Keys = $Keys -replace '\bf3\b', '{F3}'
    $Keys = $Keys -replace '\bf4\b', '{F4}'
    $Keys = $Keys -replace '\bf5\b', '{F5}'
    $Keys = $Keys -replace '\bf6\b', '{F6}'
    $Keys = $Keys -replace '\bf7\b', '{F7}'
    $Keys = $Keys -replace '\bf8\b', '{F8}'
    $Keys = $Keys -replace '\bf9\b', '{F9}'
    $Keys = $Keys -replace '\bf10\b', '{F10}'
    $Keys = $Keys -replace '\bf11\b', '{F11}'
    $Keys = $Keys -replace '\bf12\b', '{F12}'
    
    [System.Windows.Forms.SendKeys]::SendWait($Keys)
}

try {
    Send-KeyCombination -Keys $KeyString
    Write-Output "Sent key: $KeyString"
} catch {
    $errorJson = @{ error = "Failed to send key: $_" } | ConvertTo-Json -Compress
    Write-Output $errorJson
    exit 1
}
