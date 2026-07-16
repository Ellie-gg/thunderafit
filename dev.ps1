# ThunderaFit - sobe Postgres, backend e frontend com um comando so.
# Uso:
#   .\dev.ps1        # sobe tudo
#   .\dev.ps1 down   # derruba tudo (containers + processos)
param(
    [ValidateSet("up", "down")]
    [string]$Action = "up"
)

# Não usamos $ErrorActionPreference = "Stop": docker-compose e npm escrevem
# progresso normal em stderr, e sob "Stop" isso vira NativeCommandError e
# derruba o script mesmo quando o comando teve sucesso (exit code 0). As
# etapas críticas abaixo checam $LASTEXITCODE explicitamente em vez disso.
$RootDir = $PSScriptRoot
$BackendPort = 3000
$FrontendPort = 3001
$PostgresContainer = "thunderafit_postgres"
$PidFile = Join-Path $RootDir ".dev-pids.json"
$TestEmailPersonal = "personal@thunderafit.test"
$TestEmailAluno = "aluno@thunderafit.test"
$TestPassword = "SenhaSegura@123"

function Wait-ForHttp {
    param([string]$Url, [string]$Label)
    # IMPORTANTE: usar 127.0.0.1, nunca "localhost", nas URLs passadas aqui.
    # Descoberto na validação real desta fase: Invoke-WebRequest, contra
    # "localhost", tenta primeiro IPv6 (::1) via WinHTTP e trava no timeout
    # inteiro antes de cair para IPv4 — mesmo com o servidor (0.0.0.0) já de
    # pé e respondendo instantaneamente por 127.0.0.1. Com o host correto,
    # 45x1s é folga de sobra para o cmd.exe/npm/ts-node-dev subir a frio.
    for ($i = 0; $i -lt 45; $i++) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
            if ($r.StatusCode -eq 200) {
                Write-Host "$Label respondendo."
                return $true
            }
        } catch {}
        Start-Sleep -Seconds 1
    }
    Write-Host "$Label nao respondeu a tempo." -ForegroundColor Red
    return $false
}

function Stop-Port {
    param([int]$Port, [string]$Label)
    # Start-Process -PassThru devolve o PID do cmd.exe /c "npm run dev", não
    # o node/next real que escuta a porta (npm/cmd encadeiam processos
    # filhos). Matar só esse PID deixa o processo real vivo e a porta
    # continua respondendo — descoberto na validação real desta fase. Achar
    # o PID de verdade pela porta via netstat e derrubar com /T (árvore
    # inteira) é o que realmente funciona aqui.
    $lines = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
    $procIds = $lines | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique
    if (-not $procIds) {
        Write-Host "$Label`: nada escutando na porta $Port."
        return
    }
    foreach ($procId in $procIds) {
        taskkill /F /T /PID $procId 2>$null | Out-Null
    }
    Write-Host "$Label`: processo(s) na porta $Port derrubado(s)."
}

function Stop-Dev {
    Write-Host "==> Parando backend e frontend..."
    Stop-Port -Port $BackendPort -Label "Backend"
    Stop-Port -Port $FrontendPort -Label "Frontend"
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host "==> Derrubando containers Docker..."
    Push-Location $RootDir
    docker-compose down
    Pop-Location
    Write-Host "Tudo parado."
}

function Test-PortFree {
    param([int]$Port, [string]$Label)
    $lines = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
    if ($lines) {
        $procIds = ($lines | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique) -join ", "
        Write-Host "$Label`: a porta $Port ja esta em uso (PID $procIds). Rode '.\dev.ps1 down' primeiro, ou libere a porta manualmente." -ForegroundColor Red
        exit 1
    }
}

if ($Action -eq "down") {
    Stop-Dev
    exit 0
}

Write-Host "==> Pre-checagem (Docker + portas livres)..."
docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker nao parece estar rodando (docker info falhou). Abra o Docker Desktop e tente de novo." -ForegroundColor Red
    exit 1
}
Test-PortFree -Port $BackendPort -Label "Backend"
Test-PortFree -Port $FrontendPort -Label "Frontend"

Write-Host "==> Subindo PostgreSQL (docker-compose up -d)..."
Push-Location $RootDir
npm run db:up
Pop-Location

Write-Host "==> Aguardando Postgres ficar saudavel..."
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
    $status = docker inspect --format='{{.State.Health.Status}}' $PostgresContainer 2>$null
    if ($status -eq "healthy") { $healthy = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $healthy) {
    Write-Host "Postgres nao ficou saudavel a tempo." -ForegroundColor Red
    exit 1
}
Write-Host "Postgres saudavel."

Write-Host "==> Rodando migrations..."
Push-Location $RootDir
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Write-Host "Falha ao rodar migrations." -ForegroundColor Red; Pop-Location; exit 1 }

Write-Host "==> Populando catalogo de exercicios (idempotente)..."
npm run db:seed
Pop-Location

Write-Host "==> Subindo backend (porta $BackendPort)..."
$backendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory $RootDir `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $RootDir ".dev-backend.log") `
    -RedirectStandardError (Join-Path $RootDir ".dev-backend.err.log")

if (-not (Wait-ForHttp "http://127.0.0.1:$BackendPort/health" "Backend")) {
    Write-Host "Veja $RootDir\.dev-backend.log e .dev-backend.err.log"
    exit 1
}

Write-Host "==> Subindo frontend (porta $FrontendPort)..."
$frontendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory (Join-Path $RootDir "frontend") `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $RootDir ".dev-frontend.log") `
    -RedirectStandardError (Join-Path $RootDir ".dev-frontend.err.log")

if (-not (Wait-ForHttp "http://127.0.0.1:$FrontendPort/login" "Frontend")) {
    Write-Host "Veja $RootDir\.dev-frontend.log e .dev-frontend.err.log"
    exit 1
}

@{ backend = $backendProc.Id; frontend = $frontendProc.Id } | ConvertTo-Json | Set-Content $PidFile

Write-Host "==> Garantindo usuario de teste (Personal + Aluno ja vinculados)..."
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/auth/register" -Method Post -ContentType "application/json" `
        -Body (@{ email = $TestEmailPersonal; password = $TestPassword; role = "PERSONAL" } | ConvertTo-Json) -ErrorAction SilentlyContinue | Out-Null
} catch {}
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/auth/register" -Method Post -ContentType "application/json" `
        -Body (@{ email = $TestEmailAluno; password = $TestPassword; role = "ALUNO" } | ConvertTo-Json) -ErrorAction SilentlyContinue | Out-Null
} catch {}

$personalLogin = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/auth/login" -Method Post -ContentType "application/json" `
    -Body (@{ email = $TestEmailPersonal; password = $TestPassword } | ConvertTo-Json)
$alunoLogin = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/auth/login" -Method Post -ContentType "application/json" `
    -Body (@{ email = $TestEmailAluno; password = $TestPassword } | ConvertTo-Json)

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/relations" -Method Post -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $($personalLogin.accessToken)" } `
        -Body (@{ alunoId = $alunoLogin.user.id } | ConvertTo-Json) -ErrorAction SilentlyContinue | Out-Null
} catch {}

$credFile = Join-Path $RootDir "TEST_CREDENTIALS.txt"
@"
ThunderaFit - Credenciais de Teste (geradas por dev.ps1)
Gerado em: $(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")

Personal Trainer:
  email: $TestEmailPersonal
  senha: $TestPassword

Aluno (ja vinculado ao Personal acima):
  email: $TestEmailAluno
  senha: $TestPassword

Login do aluno pelo frontend: http://localhost:$FrontendPort/login
Uso do Personal (sem tela propria nesta fase): via curl/Postman, header
"Authorization: Bearer <accessToken>" obtido em POST /api/auth/login.
"@ | Set-Content $credFile

Write-Host "Credenciais de teste salvas em $credFile (arquivo no .gitignore)."

Write-Host ""
Write-Host "ThunderaFit rodando:"
Write-Host "  Backend:  http://localhost:$BackendPort"
Write-Host "  Frontend: http://localhost:$FrontendPort"
Write-Host ""
Write-Host "Para derrubar tudo: .\dev.ps1 down"
