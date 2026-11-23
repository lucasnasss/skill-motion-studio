param(
  [Parameter(Mandatory = $true)][string]$Text,
  [Parameter(Mandatory = $true)][string]$Output,
  [string]$VoiceName = 'Microsoft Maria',
  [double]$Speed = 1.0,
  [switch]$ListVoices
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
if ($ListVoices) {
  [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { "{0}`t{1}`t{2}" -f $_.DisplayName,$_.Language,$_.Gender }
  exit 0
}
function Wait-WinRtOperation {
  param([Parameter(Mandatory = $true)]$Operation,[Parameter(Mandatory = $true)][Type]$ResultType)
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation)); $task.Wait(); $task.Result
}
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object {$_.DisplayName -eq $VoiceName} | Select-Object -First 1
if (-not $voice) {$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object {$_.Language -eq 'pt-BR'} | Select-Object -First 1}
if (-not $voice) {throw 'Nenhuma voz pt-BR do Windows OneCore foi encontrada.'}
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$synth.Voice = $voice; $synth.Options.SpeakingRate = $Speed
try {
  $stream = Wait-WinRtOperation $synth.SynthesizeTextToStreamAsync($Text) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $input = $stream.GetInputStreamAt(0); $source = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($input)
  $parent = Split-Path -Parent $Output; if ($parent) {New-Item -ItemType Directory -Path $parent -Force | Out-Null}
  $destination = [System.IO.File]::Create($Output)
  try {$source.CopyTo($destination)} finally {$destination.Dispose(); $source.Dispose(); $input.Dispose(); $stream.Dispose()}
} finally {$synth.Dispose()}
Write-Output ((Resolve-Path -LiteralPath $Output).Path)
