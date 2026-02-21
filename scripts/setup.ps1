$ErrorActionPreference = "Stop"

Write-Host "== ValerPay setup =="

Write-Host "1) Backend deps"
Push-Location "$PSScriptRoot\..\src\backend"
npm install
Pop-Location

Write-Host "2) Frontend admin deps"
Push-Location "$PSScriptRoot\..\src\frontend\admin"
npm install
Pop-Location

Write-Host "3) Frontend user deps"
Push-Location "$PSScriptRoot\..\src\frontend\user"
npm install
Pop-Location

Write-Host "Done. Copy env templates next:"
Write-Host "  Copy-Item ..\.env.example ..\src\backend\.env"
Write-Host "  Copy-Item ..\.env.example ..\src\frontend\admin\.env.local"
Write-Host "  Copy-Item ..\.env.example ..\src\frontend\user\.env.local"
