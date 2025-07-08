# Windows UI Automation script for clicking elements
# Usage: .\click.ps1 <processName> <elementId?>
# elementId is optional. If not provided, the script will list all elements.

param(
    [Parameter(Mandatory=$true)]
    [string]$ProcessName,
    
    [Parameter(Mandatory=$false)]
    [string]$ElementId
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$mappingFile = "$env:TEMP\opus-ui-paths.json"

# Define clickable control types
$clickableControlTypes = @(
    [System.Windows.Automation.ControlType]::Button
    [System.Windows.Automation.ControlType]::Edit
    [System.Windows.Automation.ControlType]::CheckBox
    [System.Windows.Automation.ControlType]::RadioButton
    [System.Windows.Automation.ControlType]::ComboBox
    [System.Windows.Automation.ControlType]::Tab
    [System.Windows.Automation.ControlType]::TabItem
    [System.Windows.Automation.ControlType]::MenuItem
    [System.Windows.Automation.ControlType]::Hyperlink
    [System.Windows.Automation.ControlType]::List
    [System.Windows.Automation.ControlType]::ListItem
)

function Get-UIElementInfo {
    param($Element, $Path, $FlatList, $IdCounter)
    
    try {
        $controlType = $Element.Current.ControlType
        $name = $Element.Current.Name
        $automationId = $Element.Current.AutomationId
        $className = $Element.Current.ClassName
        $helpText = $Element.Current.HelpText
        $value = ""
        
        # Try to get value pattern
        $valuePattern = $null
        try {
            $valuePattern = $Element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
            if ($valuePattern) {
                $value = $valuePattern.Current.Value
            }
        } catch {}
        
        $isClickable = $false
        
        # Check if element is clickable
        if ($clickableControlTypes -contains $controlType) {
            $isClickable = $true
        }
        
        # Check if element has invoke pattern (clickable)
        try {
            $invokePattern = $Element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
            if ($invokePattern) {
                $isClickable = $true
            }
        } catch {}
        
        # Add to flat list if clickable and has meaningful info
        if ($isClickable -and ($name -ne "" -or $automationId -ne "" -or $helpText -ne "")) {
            $elementInfo = @{
                id = $IdCounter.Value
                AXRole = $controlType.ProgrammaticName -replace "^ControlType\.", ""
                AXTitle = $name
                AXHelp = $helpText
                AXValue = $value
                AXDescription = $automationId
                AXSubrole = $className
            }
            
            $FlatList.Add(@{
                Path = $Path
                Info = $elementInfo
            })
            
            $IdCounter.Value++
        }
        
        # Process children
        $children = $Element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
        for ($i = 0; $i -lt $children.Count; $i++) {
            $childPath = $Path + @($i)
            Get-UIElementInfo -Element $children[$i] -Path $childPath -FlatList $FlatList -IdCounter $IdCounter
        }
    } catch {
        # Silently ignore inaccessible elements
    }
}

function Get-ProcessMainWindow {
    param([string]$ProcessName)
    
    # Remove .exe extension if present
    $ProcessName = $ProcessName -replace '\.exe$', ''
    
    $processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    if (-not $processes) {
        Write-Output "App not running: $ProcessName"
        return $null
    }
    
    foreach ($proc in $processes) {
        if ($proc.MainWindowHandle -ne 0) {
            $element = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)
            if ($element) {
                return $element
            }
        }
    }
    
    # If no main window found, try to find by process ID
    $processId = $processes[0].Id
    $rootElement = [System.Windows.Automation.AutomationElement]::RootElement
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $processId)
    $windows = $rootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
    
    if ($windows.Count -gt 0) {
        return $windows[0]
    }
    
    return $null
}

function Dump-AppUI {
    param([string]$ProcessName)
    
    $window = Get-ProcessMainWindow -ProcessName $ProcessName
    if (-not $window) {
        return
    }
    
    $flatList = New-Object System.Collections.ArrayList
    $idCounter = @{ Value = 0 }
    
    Get-UIElementInfo -Element $window -Path @(0) -FlatList $flatList -IdCounter $idCounter
    
    # Build ID to path mapping
    $idToPath = @{}
    $outputList = @()
    
    foreach ($item in $flatList) {
        $info = $item.Info
        $path = $item.Path
        $idToPath[$info.id.ToString()] = ($path | ForEach-Object { $_.ToString() }) -join "."
        $outputList += $info
    }
    
    # Output JSON
    $json = $outputList | ConvertTo-Json -Depth 10
    Write-Output $json
    
    # Save mapping file
    $idToPath | ConvertTo-Json | Out-File -FilePath $mappingFile -Encoding UTF8
}

function Click-ElementById {
    param(
        [string]$ProcessName,
        [string]$ElementId
    )
    
    $window = Get-ProcessMainWindow -ProcessName $ProcessName
    if (-not $window) {
        return
    }
    
    # Load mapping file
    if (-not (Test-Path $mappingFile)) {
        Write-Output "Mapping file not found"
        return
    }
    
    $mapping = Get-Content $mappingFile | ConvertFrom-Json
    $pathStr = $mapping.$ElementId
    
    if (-not $pathStr) {
        Write-Output "Element ID not found in mapping"
        return
    }
    
    $path = $pathStr.Split('.') | ForEach-Object { [int]$_ }
    
    # Navigate to element
    $element = $window
    for ($i = 1; $i -lt $path.Count; $i++) {
        $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
        if ($path[$i] -ge $children.Count) {
            Write-Output "Invalid path: child index out of bounds"
            return
        }
        $element = $children[$path[$i]]
    }
    
    # Try to click the element
    try {
        # Try Invoke pattern first
        $invokePattern = $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        if ($invokePattern) {
            $invokePattern.Invoke()
            Write-Output "Clicked element id $ElementId"
            return
        }
    } catch {}
    
    try {
        # Try Toggle pattern
        $togglePattern = $element.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
        if ($togglePattern) {
            $togglePattern.Toggle()
            Write-Output "Clicked element id $ElementId"
            return
        }
    } catch {}
    
    try {
        # Try Selection Item pattern
        $selectionItemPattern = $element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        if ($selectionItemPattern) {
            $selectionItemPattern.Select()
            Write-Output "Clicked element id $ElementId"
            return
        }
    } catch {}
    
    # Fall back to simulating mouse click
    try {
        $rect = $element.Current.BoundingRectangle
        $centerX = $rect.X + $rect.Width / 2
        $centerY = $rect.Y + $rect.Height / 2
        
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($centerX, $centerY)
        
        Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseClick {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
}
"@
        
        [MouseClick]::mouse_event([MouseClick]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        [MouseClick]::mouse_event([MouseClick]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        
        Write-Output "Clicked element id $ElementId"
    } catch {
        Write-Output "Failed to click element: $_"
    }
}

# Main execution
if ($ElementId) {
    Click-ElementById -ProcessName $ProcessName -ElementId $ElementId
} else {
    Dump-AppUI -ProcessName $ProcessName
}
