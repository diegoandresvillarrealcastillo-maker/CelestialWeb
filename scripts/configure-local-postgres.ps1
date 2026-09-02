$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$statusPath = Join-Path $env:TEMP 'celestial-local-db.status'
$psqlPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$plainPassword = $null
$passwordPointer = [IntPtr]::Zero

try {
    Set-Location -LiteralPath $projectRoot
    [System.IO.File]::WriteAllText($statusPath, 'running', $utf8NoBom)

    $securePassword = Read-Host 'Contrasena actual del usuario postgres' -AsSecureString
    $passwordPointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw 'La contrasena no puede estar vacia.'
    }

    $env:PGPASSWORD = $plainPassword
    & $psqlPath -h localhost -p 2007 -U postgres -d celestial -tAc 'SELECT 1' | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'PostgreSQL rechazo la contrasena.'
    }

    $encodedPassword = [System.Uri]::EscapeDataString($plainPassword)
    $randomBytes = New-Object byte[] 48
    $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $randomGenerator.GetBytes($randomBytes)
    $ipHashSecret = [Convert]::ToBase64String($randomBytes)
    $randomGenerator.Dispose()

    $envLines = @(
        'NODE_ENV=development'
        'PORT=4000'
        "DATABASE_URL=postgresql://postgres:${encodedPassword}@localhost:2007/celestial"
        'DATABASE_SSL=false'
        'WEB_ORIGIN=http://localhost:3000'
        'PUBLIC_API_URL=http://localhost:4000'
        'NEXT_PUBLIC_SITE_URL=http://localhost:3000'
        'NEXT_PUBLIC_API_URL=http://localhost:4000'
        'TRUST_PROXY=false'
        'SESSION_COOKIE_NAME=celestial_session'
        'SESSION_TTL_HOURS=24'
        "IP_HASH_SECRET=$ipHashSecret"
    )
    [System.IO.File]::WriteAllLines((Join-Path $projectRoot '.env'), $envLines, $utf8NoBom)

    & npm.cmd run db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la migracion de la base de datos.' }

    & npm.cmd run db:seed
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la carga inicial del catalogo.' }

    [System.IO.File]::WriteAllText($statusPath, 'success', $utf8NoBom)
    Write-Host ''
    Write-Host 'CONEXION, MIGRACIONES Y CATALOGO LISTOS.' -ForegroundColor Green
}
catch {
    [System.IO.File]::WriteAllText($statusPath, "error: $($_.Exception.Message)", $utf8NoBom)
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $plainPassword = $null
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}

Read-Host 'Presiona Enter para cerrar'
