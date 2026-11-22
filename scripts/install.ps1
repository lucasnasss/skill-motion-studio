[CmdletBinding()]
param(
    [ValidateSet('User', 'Project')]
    [string]$Scope = 'User',

    [ValidateSet('codex', 'claude', 'antigravity')]
    [string[]]$Targets = @('codex', 'claude', 'antigravity'),

    [string]$ProjectRoot,

    [switch]$CopyFallback,

    [switch]$Update,

    [switch]$SkipDependencies
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

if (-not $SkipDependencies) {
    Push-Location $source
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci terminou com código $LASTEXITCODE" }
    }
    finally {
        Pop-Location
    }
}

if ($Scope -eq 'Project') {
    if (-not $ProjectRoot) { throw 'Informe -ProjectRoot para instalação no projeto.' }
    $resolvedProject = (Resolve-Path -LiteralPath $ProjectRoot).Path
}
else {
    $resolvedProject = $null
}

$userProfile = [Environment]::GetFolderPath('UserProfile')
$destinations = [System.Collections.Generic.List[string]]::new()

foreach ($target in $Targets) {
    if ($Scope -eq 'User') {
        switch ($target) {
            'codex' { $destination = Join-Path $userProfile '.agents\skills\motion-studio' }
            'claude' { $destination = Join-Path $userProfile '.claude\skills\motion-studio' }
            'antigravity' { $destination = Join-Path $userProfile '.gemini\config\skills\motion-studio' }
        }
    }
    else {
        switch ($target) {
            'codex' { $destination = Join-Path $resolvedProject '.agents\skills\motion-studio' }
            'claude' { $destination = Join-Path $resolvedProject '.claude\skills\motion-studio' }
            'antigravity' { $destination = Join-Path $resolvedProject '.agents\skills\motion-studio' }
        }
    }
    if (-not $destinations.Contains($destination)) { $destinations.Add($destination) }
}

foreach ($destination in $destinations) {
    if (Test-Path -LiteralPath $destination) {
        $item = Get-Item -LiteralPath $destination -Force
        $linkTarget = @($item.Target) | Select-Object -First 1
        if ($linkTarget -and ((Resolve-Path -LiteralPath $linkTarget).Path -eq $source)) {
            Write-Host "Já instalado: $destination"
            continue
        }
        if ($Update -and $linkTarget) {
            Write-Warning "Atualizando apenas o link existente: $destination (origem anterior: $linkTarget)"
            Remove-Item -LiteralPath $destination -Force
        }
        else {
            throw "O destino já existe e não será substituído: $destination. Use -Update somente para trocar um link/junction existente."
        }
    }
    $parent = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    try {
        New-Item -ItemType Junction -Path $destination -Target $source | Out-Null
        Write-Host "Link criado: $destination -> $source"
    }
    catch {
        if (-not $CopyFallback) { throw }
        Write-Warning "Links não estão disponíveis. Criando cópia divergente em $destination."
        Copy-Item -LiteralPath $source -Destination $destination -Recurse
    }
}

Write-Host 'Instalação concluída. Reinicie o cliente ou recarregue as skills.'

