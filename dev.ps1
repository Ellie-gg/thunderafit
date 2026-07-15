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
    # 120x1s: iniciar via cmd.exe /c "npm run dev" tem overhead maior que
    # rodar o comando direto (resolução do wrapper do npm + compilação do
    # ts-node-dev/next na primeira vez), e variou bastante entre execuções
    # neste ambiente — 30s e depois 60s ainda não bastaram algumas vezes.
    for ($i = 0; $i -lt 120; $i++) {
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

function Stop-Dev {
    if (Test-Path $PidFile) {
        $pidData = Get-Content $PidFile | ConvertFrom-Json
        foreach ($procId in @($pidData.backend, $pidData.frontend)) {
            if ($procId) {
                try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    Write-Host "==> Derrubando containers Docker..."
    Push-Location $RootDir
    docker-compose down
    Pop-Location
    Write-Host "Tudo parado."
}

if ($Action -eq "down") {
    Stop-Dev
    exit 0
}

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

if (-not (Wait-ForHttp "http://localhost:$BackendPort/health" "Backend")) {
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

if (-not (Wait-ForHttp "http://localhost:$FrontendPort/login" "Frontend")) {
    Write-Host "Veja $RootDir\.dev-frontend.log e .dev-frontend.err.log"
    exit 1
}

@{ backend = $backendProc.Id; frontend = $frontendProc.Id } | ConvertTo-Json | Set-Content $PidFile

Write-Host "==> Garantindo usuario de teste (Personal + Aluno ja vinculados)..."
try {
    Invoke-RestMethod -Uri "http://localhost:$BackendPort/api/auth/register" -Method Post -ContentType "application/json" `
        -Body (@{ email = $TestEmailPersonal; password = $TestPassword; role = "PERSONAL" } | ConvertTo-Json) -ErrorAction SilentlyContinue | Out-Null
} catch {}
try {
    Invoke-RestMethod -Uri "http://localhost:$BackendPort/api/auth/register" -Method Post -ContentType "application/json" `
        -Body (@{ email = $TestEmailAluno; password = $TestPassword; role = "ALUNO" } | ConvertTo-Json) -ErrorAction SilentlyContinue | Out-Null
} catch {}

$personalLogin = Invoke-RestMethod -Uri "http://localhost:$BackendPort/api/auth/login" -Method Post -ContentType "application/json" `
    -Body (@{ email = $TestEmailPersonal; password = $TestPassword } | ConvertTo-Json)
$alunoLogin = Invoke-RestMethod -Uri "http://localhost:$BackendPort/api/auth/login" -Method Post -ContentType "application/json" `
    -Body (@{ email = $TestEmailAluno; password = $TestPassword } | ConvertTo-Json)

try {
    Invoke-RestMethod -Uri "http://localhost:$BackendPort/api/relations" -Method Post -ContentType "application/json" `
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
