$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host "Starting Backend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm install; npm run dev" -WorkingDirectory $ROOT

Write-Host "Starting Channel Service..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd channel-service; npm install; npm run dev" -WorkingDirectory $ROOT

Write-Host "Starting AI Service..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ai-service; if (-not (Test-Path venv)) { python -m venv venv }; .\venv\Scripts\activate; pip install -r requirements.txt; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" -WorkingDirectory $ROOT

Write-Host "Starting Frontend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm install; npm run dev" -WorkingDirectory $ROOT

Write-Host "All local services started in separate windows!"
