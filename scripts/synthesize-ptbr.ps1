param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,
  [string]$VoiceName = 'Microsoft Maria',
  [double]$SpeakingRate = 1.08,
  [string]$FilePrefix = 'narracao'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]

function Wait-WinRtOperation {
  param(
    [Parameter(Mandatory = $true)]$Operation,
    [Parameter(Mandatory = $true)][Type]$ResultType
  )

  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.IsGenericMethod -and
      $_.GetParameters().Count -eq 1
    } |
    Select-Object -First 1

  $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$project = Get-Content -LiteralPath $resolvedProject -Raw | ConvertFrom-Json
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$audioDirectory = Join-Path $root 'public\audio'
New-Item -ItemType Directory -Path $audioDirectory -Force | Out-Null

$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices |
  Where-Object { $_.DisplayName -eq $VoiceName } |
  Select-Object -First 1

if (-not $voice) {
  $voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices |
    Where-Object { $_.Language -eq 'pt-BR' } |
    Select-Object -First 1
}

if (-not $voice) {
  throw 'Nenhuma voz pt-BR do Windows OneCore foi encontrada.'
}

$synthesizer = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$synthesizer.Voice = $voice
$synthesizer.Options.SpeakingRate = $SpeakingRate

try {
  foreach ($scene in $project.scenes) {
    if ([string]::IsNullOrWhiteSpace([string]$scene.narration)) {
      continue
    }

    $fileName = '{0}-{1}.wav' -f $FilePrefix, $scene.id
    $target = Join-Path $audioDirectory $fileName
    $operation = $synthesizer.SynthesizeTextToStreamAsync([string]$scene.narration)
    $speechStream = Wait-WinRtOperation -Operation $operation -ResultType ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $inputStream = $speechStream.GetInputStreamAt(0)
    $source = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($inputStream)
    $destination = [System.IO.File]::Create($target)

    try {
      $source.CopyTo($destination)
    }
    finally {
      $destination.Dispose()
      $source.Dispose()
      $inputStream.Dispose()
      $speechStream.Dispose()
    }

    Write-Output ("{0}`t{1}" -f $scene.id, $target)
  }
}
finally {
  $synthesizer.Dispose()
}
