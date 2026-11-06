#Requires -Version 7.5
param(
    [Parameter(Mandatory,Position=0)][ValidateSet('start','stop','decision','usage')][string]$Action,
    [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$')][string]$Person,
    [ValidatePattern('^[a-zA-Z0-9-]+$')][string]$SessionId,
    [Parameter(Mandatory)][string]$Summary,
    [ValidateSet('mode','skill','plugin','tool','model')][string]$Kind,
    [string]$Name,
    [string]$Alternatives,
    [string]$Consequences,
    [Nullable[long]]$InputTokens,
    [Nullable[long]]$OutputTokens,
    [string]$TokenSource
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$now = [DateTimeOffset]::UtcNow
if ($Action -eq 'start') { $SessionId = $now.ToString('yyyyMMddTHHmmssfffZ') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) }
if (!$SessionId) { throw 'SessionId is required' }
$dir = Join-Path $root "logs/$Person/$SessionId"
$file = Join-Path $dir 'work.json'
function Save($path, $value) { ConvertTo-Json -InputObject $value -Depth 10 | Set-Content -LiteralPath $path -Encoding utf8 }
if ($Action -eq 'start') {
    New-Item -ItemType Directory -Path $dir | Out-Null
    Save $file ([ordered]@{person=$Person; session_id=$SessionId; started_at=$now.ToString('o'); ended_at=$null; duration_seconds=$null; task=$Summary; summary=$null; input_tokens=$null; output_tokens=$null; token_source=$null; token_unavailable_reason='Environment has not supplied exact session usage'})
    Save (Join-Path $dir 'decisions.json') @()
    Save (Join-Path $dir 'usage.json') @()
    Write-Output $SessionId
    return
}
if (!(Test-Path -LiteralPath $file)) { throw 'Unknown session' }
$session = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json -DateKind String
if ($session.ended_at) { throw 'Session already closed; start a new session' }
if ($Action -eq 'stop') {
    if (($null -ne $InputTokens -and $InputTokens -lt 0) -or ($null -ne $OutputTokens -and $OutputTokens -lt 0)) { throw 'Token counts must be nonnegative' }
    if (($null -ne $InputTokens -or $null -ne $OutputTokens) -and !$TokenSource) { throw 'TokenSource is required for measured tokens' }
    $session.ended_at = $now.ToString('o')
    $session.duration_seconds = [math]::Round(($now - [DateTimeOffset]::Parse($session.started_at)).TotalSeconds,3)
    $session.summary = $Summary
    $session.input_tokens = $InputTokens
    $session.output_tokens = $OutputTokens
    $session.token_source = $TokenSource
    if ($null -ne $InputTokens -and $null -ne $OutputTokens) { $session.token_unavailable_reason = $null }
    Save $file $session
} else {
    if ($Action -eq 'usage' -and (!$Kind -or !$Name)) { throw 'Kind and Name are required' }
    if ($Action -eq 'decision' -and (!$Alternatives -or !$Consequences)) { throw 'Alternatives and Consequences are required' }
    $target = if ($Action -eq 'usage') {'usage.json'} else {'decisions.json'}
    $path = Join-Path $dir $target
    $items = @(Get-Content -LiteralPath $path -Raw | ConvertFrom-Json -DateKind String)
    $entry = if ($Action -eq 'usage') { [ordered]@{at=$now.ToString('o'); kind=$Kind; name=$Name; purpose=$Summary} } else { [ordered]@{at=$now.ToString('o'); decision_and_context=$Summary; alternatives=$Alternatives; consequences=$Consequences} }
    Save $path @($items + $entry)
}

