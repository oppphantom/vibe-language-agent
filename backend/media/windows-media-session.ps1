param(
  [ValidateSet('list','play','pause','seek','next','previous','play-range')]
  [string]$Action='list',
  [string]$Provider='',
  [long]$PositionMs=0,
  [long]$EndPositionMs=0,
  [string]$PlayerPath=''
)

$ErrorActionPreference='Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
$script:AsTask=[System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1} |
  Select-Object -First 1

function Wait-WinRt {
  param([Parameter(Mandatory=$true)]$Operation,[Parameter(Mandatory=$true)][Type]$ResultType)
  $task=$script:AsTask.MakeGenericMethod($ResultType).Invoke($null,@($Operation))
  try {$task.Wait()} catch {if($null -ne $task.Exception){throw $task.Exception.Flatten().InnerException};throw}
  $task.Result
}

function Matches-Provider([string]$SourceId,[string]$RequestedProvider) {
  if([string]::IsNullOrWhiteSpace($RequestedProvider)){return $true}
  $source=$SourceId.ToLowerInvariant()
  switch($RequestedProvider.ToLowerInvariant()){
    'qqmusic' {return $source.Contains('qqmusic')}
    'netease' {return $source.Contains('cloudmusic') -or $source.Contains('netease')}
    default {return $source.Contains($RequestedProvider.ToLowerInvariant())}
  }
}

function Estimated-PositionMs($Session) {
  $timeline=$Session.GetTimelineProperties()
  $position=$timeline.Position.TotalMilliseconds
  if($Session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'){
    $age=([DateTimeOffset]::Now-$timeline.LastUpdatedTime).TotalMilliseconds
    if($age -gt 0 -and $age -lt 10000){$position+=$age}
  }
  if($timeline.EndTime.TotalMilliseconds -gt 0){$position=[math]::Min($position,$timeline.EndTime.TotalMilliseconds)}
  [math]::Round($position)
}

$manager=Wait-WinRt ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$matching=@($manager.GetSessions() | Where-Object {Matches-Provider $_.SourceAppUserModelId $Provider})

if($Action -ne 'list'){
  if($matching.Count -eq 0){throw "No Windows media session matches provider '$Provider'."}
  if($matching.Count -gt 1){throw "More than one Windows media session matches provider '$Provider'."}
  $session=$matching[0]
  switch($Action){
    'play' {$ok=Wait-WinRt ($session.TryPlayAsync()) ([bool])}
    'pause' {$ok=Wait-WinRt ($session.TryPauseAsync()) ([bool])}
    'next' {$ok=Wait-WinRt ($session.TrySkipNextAsync()) ([bool])}
    'previous' {$ok=Wait-WinRt ($session.TrySkipPreviousAsync()) ([bool])}
    'seek' {
      if($PositionMs -lt 0){throw 'PositionMs must not be negative.'}
      $ok=Wait-WinRt ($session.TryChangePlaybackPositionAsync($PositionMs*[TimeSpan]::TicksPerMillisecond)) ([bool])
    }
    'play-range' {
      if($EndPositionMs -le $PositionMs){throw 'EndPositionMs must be greater than PositionMs.'}
      if($Provider.ToLowerInvariant() -eq 'qqmusic'){
        if([string]::IsNullOrWhiteSpace($PlayerPath) -or -not (Test-Path -LiteralPath $PlayerPath -PathType Leaf)){throw 'PlayerPath must identify QQMusic.exe.'}
        $initial=Estimated-PositionMs $session
        $seconds=($PositionMs/1000.0).ToString('0.###',[Globalization.CultureInfo]::InvariantCulture)
        Start-Process -FilePath $PlayerPath -ArgumentList @('/seekto',$seconds)
        $deadline=[DateTime]::UtcNow.AddSeconds(5);$watch=[Diagnostics.Stopwatch]::StartNew()
        do {
          Start-Sleep -Milliseconds 15;$current=Estimated-PositionMs $session
          $near=[math]::Abs($current-$PositionMs) -le 1500;$changed=[math]::Abs($current-$initial) -ge 400
        } while((-not $near -or (-not $changed -and $watch.ElapsedMilliseconds -lt 400)) -and [DateTime]::UtcNow -lt $deadline)
      } else {
        $ok=Wait-WinRt ($session.TryChangePlaybackPositionAsync($PositionMs*[TimeSpan]::TicksPerMillisecond)) ([bool])
        if(-not $ok){throw 'The seek request was rejected.'}
      }
      $ok=Wait-WinRt ($session.TryPlayAsync()) ([bool]);if(-not $ok){throw 'The play request was rejected.'}
      $current=Estimated-PositionMs $session
      $lead=if($Provider.ToLowerInvariant() -eq 'qqmusic'){1100}else{0}
      $remaining=[math]::Max(0,$EndPositionMs-$current-$lead);$range=[Diagnostics.Stopwatch]::StartNew()
      while($range.ElapsedMilliseconds -lt $remaining){$left=$remaining-$range.ElapsedMilliseconds;Start-Sleep -Milliseconds ([math]::Max(1,[math]::Min(12,$left)))}
      $ok=Wait-WinRt ($session.TryPauseAsync()) ([bool])
    }
  }
  if(-not $ok){throw "The '$Action' request was rejected by '$($session.SourceAppUserModelId)'."}
}

$output=foreach($session in $matching){
  $media=Wait-WinRt ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $timeline=$session.GetTimelineProperties();$playback=$session.GetPlaybackInfo()
  [ordered]@{
    sourceId=$session.SourceAppUserModelId;title=$media.Title;artist=$media.Artist;album=$media.AlbumTitle
    playbackStatus=$playback.PlaybackStatus.ToString();positionMs=[math]::Round($timeline.Position.TotalMilliseconds)
    endMs=[math]::Round($timeline.EndTime.TotalMilliseconds)
  }
}
@($output) | ConvertTo-Json -Depth 3 -Compress
