<#
.SYNOPSIS
    打刻の自動化タスクを Windows タスクスケジューラに登録します。

.DESCRIPTION
    次の3つのタスクを登録します。

      DakokuAuto-PunchIn        ログオン / ロック解除の直後に出勤打刻
      DakokuAuto-RemindEvening  平日 20:00 に退勤リマインド（トースト通知）
      DakokuAuto-RemindMissing  平日 22:00 に退勤未打刻ならメール

    管理者権限は不要です（現在のユーザーのタスクとして登録されます）。

.PARAMETER Uninstall
    登録済みのタスクを削除します。

.EXAMPLE
    .\Install-DakokuTasks.ps1
    .\Install-DakokuTasks.ps1 -Uninstall
#>
[CmdletBinding()]
param([switch]$Uninstall)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$dakokuPath = Join-Path $scriptDir 'Dakoku.ps1'
$configPath = Join-Path $scriptDir 'dakoku.config.json'

$taskNames = @('DakokuAuto-PunchIn', 'DakokuAuto-RemindEvening', 'DakokuAuto-RemindMissing')

if ($Uninstall) {
    foreach ($name in $taskNames) {
        if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $name -Confirm:$false
            Write-Host "削除しました: $name" -ForegroundColor Yellow
        }
    }
    Write-Host '登録解除が完了しました。' -ForegroundColor Green
    return
}

if (-not (Test-Path $dakokuPath)) { throw "Dakoku.ps1 が見つかりません: $dakokuPath" }
if (-not (Test-Path $configPath)) {
    throw "dakoku.config.json が見つかりません。dakoku.config.example.json をコピーして作成してください: $configPath"
}

$config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$eveningTime = if ($config.PSObject.Properties.Name -contains 'eveningReminderTime') { $config.eveningReminderTime } else { '20:00' }
$missingTime = if ($config.PSObject.Properties.Name -contains 'missingPunchCheckTime') { $config.missingPunchCheckTime } else { '22:00' }

function New-DakokuAction {
    param([Parameter(Mandatory)][string]$Action)

    # -WindowStyle Hidden でコンソールウィンドウを出さずに実行する
    New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
        '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass ' +
        "-File `"$dakokuPath`" -Action $Action"
    )
}

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

# --- 1. 出勤打刻: ログオン + ロック解除 ---------------------------------
# SessionStateChangeTrigger (SessionUnlock) は cmdlet から作れないため XML で登録する。
$punchInXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>業務PCでの作業開始（ログオン / ロック解除）を検知して出勤打刻します。</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$env:USERDOMAIN\$env:USERNAME</UserId>
      <Delay>PT1M</Delay>
    </LogonTrigger>
    <SessionStateChangeTrigger>
      <Enabled>true</Enabled>
      <UserId>$env:USERDOMAIN\$env:USERNAME</UserId>
      <StateChange>SessionUnlock</StateChange>
      <Delay>PT1M</Delay>
    </SessionStateChangeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$env:USERDOMAIN\$env:USERNAME</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$dakokuPath" -Action PunchIn</Arguments>
    </Exec>
  </Actions>
</Task>
"@

Register-ScheduledTask -TaskName 'DakokuAuto-PunchIn' -Xml $punchInXml -Force | Out-Null
Write-Host '登録しました: DakokuAuto-PunchIn (ログオン / ロック解除の1分後)' -ForegroundColor Green

# --- 2. 退勤リマインド (平日 20:00) -------------------------------------
Register-ScheduledTask -TaskName 'DakokuAuto-RemindEvening' `
    -Action (New-DakokuAction -Action 'RemindEvening') `
    -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $eveningTime) `
    -Settings $settings -Principal $principal `
    -Description '退勤打刻のリマインドを表示します。' -Force | Out-Null
Write-Host "登録しました: DakokuAuto-RemindEvening (平日 $eveningTime)" -ForegroundColor Green

# --- 3. 未打刻チェック (平日 22:00) -------------------------------------
Register-ScheduledTask -TaskName 'DakokuAuto-RemindMissing' `
    -Action (New-DakokuAction -Action 'RemindMissing') `
    -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $missingTime) `
    -Settings $settings -Principal $principal `
    -Description '退勤打刻が未登録ならメールで通知します。' -Force | Out-Null
Write-Host "登録しました: DakokuAuto-RemindMissing (平日 $missingTime)" -ForegroundColor Green

Write-Host ''
Write-Host '登録が完了しました。次は初回ログインを行ってください:' -ForegroundColor Cyan
Write-Host "    powershell -ExecutionPolicy Bypass -File `"$dakokuPath`" -Action Login -Interactive"
