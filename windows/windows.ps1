# Windows script to get window information
# Usage: .\windows.ps1

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WindowInfo {
    public string pid { get; set; }
    public string name { get; set; }
    public string app { get; set; }
}

public class WindowHelper {
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    
    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    
    [DllImport("user32.dll")]
    private static extern int GetWindowTextLength(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    
    public static List<WindowInfo> GetWindows() {
        var windows = new List<WindowInfo>();
        
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            if (IsWindowVisible(hWnd)) {
                int length = GetWindowTextLength(hWnd);
                if (length > 0) {
                    StringBuilder sb = new StringBuilder(length + 1);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    
                    uint processId;
                    GetWindowThreadProcessId(hWnd, out processId);
                    
                    windows.Add(new WindowInfo {
                        pid = processId.ToString(),
                        name = sb.ToString(),
                        app = GetProcessName(processId)
                    });
                }
            }
            return true;
        }, IntPtr.Zero);
        
        return windows;
    }
    
    private static string GetProcessName(uint processId) {
        try {
            var process = System.Diagnostics.Process.GetProcessById((int)processId);
            return process.ProcessName;
        } catch {
            return "";
        }
    }
}
"@

$windows = [WindowHelper]::GetWindows()

# Filter out system windows and duplicates
$filteredWindows = $windows | Where-Object { 
    $_.name -ne "" -and 
    $_.app -ne "" -and 
    $_.app -notmatch "^(ApplicationFrameHost|SearchHost|ShellExperienceHost|SystemSettings|TextInputHost)$"
} | Group-Object -Property pid | ForEach-Object {
    # For each process, take the window with the longest name (usually the main window)
    $_.Group | Sort-Object { $_.name.Length } -Descending | Select-Object -First 1
}

# Convert to JSON and output
$filteredWindows | ConvertTo-Json -Compress
