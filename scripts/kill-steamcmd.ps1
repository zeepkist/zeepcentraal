$ErrorActionPreference = 'Stop'

$processes = Get-Process -Name 'steamcmd' -ErrorAction SilentlyContinue

if (-not $processes) {
	Write-Host 'No steamcmd.exe processes found.'
	exit 0
}

$processes | ForEach-Object {
	Write-Host "Stopping steamcmd.exe process $($_.Id)."
	Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "Stopped $($processes.Count) steamcmd.exe process(es)."
