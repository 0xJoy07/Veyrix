param([ValidateSet('all','node','python','chat')][string]$Service = 'all')
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
if ($Service -eq 'all') {
    foreach ($name in @('node','python','chat')) {
        # Visible windows are intentional: each service streams live logs here.
        Start-Process powershell.exe -ArgumentList @('-NoExit','-ExecutionPolicy','Bypass','-File',('"' + $PSCommandPath + '"'),'-Service',$name) -WorkingDirectory $projectRoot
    }
    return
}
$Host.UI.RawUI.WindowTitle = "Veyrix - $Service live logs"
Write-Host "Veyrix $Service | Live logs | Ctrl+C stops this service" -ForegroundColor Green
Write-Host 'Request bodies, OTPs, passwords and API keys are not logged.'
switch ($Service) {
    'node' { Set-Location (Join-Path $projectRoot 'setup/node'); & npm.cmd run dev }
    'python' { Set-Location (Join-Path $projectRoot 'setup/python'); & '.\.venv\Scripts\python.exe' -u main.py }
    'chat' { Set-Location (Join-Path $projectRoot 'chat'); & npm.cmd run dev }
}
