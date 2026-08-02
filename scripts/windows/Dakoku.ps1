<#
.SYNOPSIS
    ソニーミュージック打刻システム (dakoku.sonymusic.co.jp) の打刻自動化・リマインド。

.DESCRIPTION
    業務PC上で動作します。認証トークンは保存せず、専用の Edge プロファイルに
    残っている SSO セッションから毎回取得します。SSO が切れてトークンを取得
    できなくなった場合は、Outlook 経由でメール通知します。

.PARAMETER Action
    PunchIn        出勤打刻（ログオン検知タスクから呼ばれる）
    PunchOut       退勤打刻
    Status         現在の打刻状態を表示
    RemindEvening  退勤リマインド（20時）
    RemindMissing  未打刻チェック（22時）— 退勤打刻が無ければメール
    Login          SSO ログインをやり直す（初回セットアップ・セッション切れ時）

.PARAMETER Interactive
    ブラウザを画面に表示します。初回ログイン時と、トラブルシュート時に使います。

.EXAMPLE
    .\Dakoku.ps1 -Action Login -Interactive
    .\Dakoku.ps1 -Action Status
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('PunchIn', 'PunchOut', 'Status', 'RemindEvening', 'RemindMissing', 'Login')]
    [string]$Action,

    [switch]$Interactive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:LogDir       = Join-Path $env:LOCALAPPDATA 'DakokuAuto\logs'
$script:StateFile    = Join-Path $env:LOCALAPPDATA 'DakokuAuto\state.json'
$script:CachedApiKey = $null

#region ---------- 基盤 ----------

function Write-Log {
    param([string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO')

    if (-not (Test-Path $script:LogDir)) {
        New-Item -ItemType Directory -Path $script:LogDir -Force | Out-Null
    }
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    $logFile = Join-Path $script:LogDir ('dakoku-{0}.log' -f (Get-Date -Format 'yyyy-MM'))
    Add-Content -Path $logFile -Value $line -Encoding UTF8

    switch ($Level) {
        'ERROR' { Write-Host $line -ForegroundColor Red }
        'WARN'  { Write-Host $line -ForegroundColor Yellow }
        default { Write-Host $line }
    }
}

function Get-DakokuConfig {
    $path = Join-Path $script:ScriptDir 'dakoku.config.json'
    if (-not (Test-Path $path)) {
        throw "設定ファイルが見つかりません: $path`ndakoku.config.example.json をコピーして作成してください。"
    }

    $cfg = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json

    foreach ($required in @('apiBase', 'mailTo', 'browserProfileDir')) {
        if (-not $cfg.PSObject.Properties.Name.Contains($required) -or -not $cfg.$required) {
            throw "設定 '$required' が未設定です: $path"
        }
    }
    if ($null -eq $cfg.latitude -or $null -eq $cfg.longitude) {
        throw "latitude / longitude が未設定です。実際の勤務地の座標を $path に設定してください。"
    }

    # 環境変数展開 (%LOCALAPPDATA% など)
    $cfg.browserProfileDir = [Environment]::ExpandEnvironmentVariables($cfg.browserProfileDir)
    return $cfg
}

function Get-DakokuApiKey {
    <#
        打刻サイトの API キーは、フロントエンドの JS バンドルに埋め込まれた固定値です。
        リポジトリに書き込まずに済ませるため、実行時にサイトから読み取ります。
        キーがローテーションされても自動で追随します。

        設定に apiKey が明示されている場合はそちらを優先します。
    #>
    param([Parameter(Mandatory)]$Config)

    if ($Config.PSObject.Properties.Name -contains 'apiKey' -and $Config.apiKey) {
        return $Config.apiKey
    }
    if ($script:CachedApiKey) { return $script:CachedApiKey }

    $siteBase = ($Config.siteUrl -replace '/index\.html$', '')
    $indexHtml = Invoke-RestMethod -Uri $Config.siteUrl -TimeoutSec 30

    if ($indexHtml -notmatch 'src="([^"]*static/js/main\.[a-f0-9]+\.js)"') {
        throw 'API キーを取得できませんでした（打刻サイトの構成が変わった可能性があります）。dakoku.config.json に apiKey を手動で設定してください。'
    }
    $bundleUrl = $Matches[1]
    if ($bundleUrl -notmatch '^https?://') {
        $bundleUrl = '{0}/{1}' -f ($siteBase -replace '/site$', ''), ($bundleUrl -replace '^\./|^/', '')
    }

    $bundle = Invoke-RestMethod -Uri $bundleUrl -TimeoutSec 60
    if ($bundle -notmatch 'prd:\{endpoint:"[^"]*",apikey:"([^"]+)"\}') {
        throw 'JS バンドルから API キーを抽出できませんでした。dakoku.config.json に apiKey を手動で設定してください。'
    }

    $script:CachedApiKey = $Matches[1]
    Write-Log 'API キーを打刻サイトから取得しました。'
    return $script:CachedApiKey
}

function Send-DakokuMail {
    <#
        業務PC の Outlook を COM 経由で使ってメールを送ります。
        SMTP のパスワードや資格情報を保存する必要がありません。
    #>
    param(
        [Parameter(Mandatory)][string]$To,
        [Parameter(Mandatory)][string]$Subject,
        [Parameter(Mandatory)][string]$Body
    )

    try {
        $outlook = New-Object -ComObject Outlook.Application
        $mail = $outlook.CreateItem(0)   # olMailItem
        $mail.To      = $To
        $mail.Subject = $Subject
        $mail.Body    = $Body
        $mail.Send()
        Write-Log "メール送信: $Subject -> $To"
        return $true
    }
    catch {
        Write-Log "メール送信に失敗しました: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

function Show-DakokuToast {
    param([Parameter(Mandatory)][string]$Message)

    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
            [Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $texts = $template.GetElementsByTagName('text')
        $texts.Item(0).AppendChild($template.CreateTextNode('打刻')) | Out-Null
        $texts.Item(1).AppendChild($template.CreateTextNode($Message)) | Out-Null

        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('DakokuAuto').Show($toast)
    }
    catch {
        # トースト表示は補助的な機能なので、失敗しても処理は続行する
        Write-Log "トースト通知を表示できませんでした: $($_.Exception.Message)" -Level WARN
    }
}

#endregion

#region ---------- トークン取得 (SSO) ----------

function Find-EdgeExecutable {
    $candidates = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    throw 'Microsoft Edge が見つかりませんでした。'
}

function Get-DakokuToken {
    <#
        専用 Edge プロファイルで打刻サイトの SSO ログインへ遷移し、
        リダイレクト後の URL に含まれる JWT を CDP 経由で拾います。

        トークンはディスクに保存しません（有効期間は発行から6時間）。
        SSO セッションが切れている場合は $null を返します。
    #>
    param(
        [Parameter(Mandatory)]$Config,
        [switch]$ShowWindow,
        [int]$TimeoutSeconds = 60
    )

    $edge = Find-EdgeExecutable
    if (-not (Test-Path $Config.browserProfileDir)) {
        New-Item -ItemType Directory -Path $Config.browserProfileDir -Force | Out-Null
    }

    $port = if ($Config.PSObject.Properties.Name.Contains('debugPort')) { $Config.debugPort } else { 9222 }

    $edgeArgs = @(
        "--remote-debugging-port=$port"
        "--user-data-dir=`"$($Config.browserProfileDir)`""
        '--no-first-run'
        '--no-default-browser-check'
        '--disable-features=Translate,OptimizationGuideModelDownloading'
    )
    if (-not $ShowWindow) {
        $edgeArgs += '--headless=new'
    }
    $edgeArgs += "$($Config.apiBase)/login"

    Write-Log ("Edge を起動して SSO ログインへ遷移します (headless={0})" -f (-not $ShowWindow))
    $proc = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru

    $token = $null
    try {
        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
        while ((Get-Date) -lt $deadline) {
            Start-Sleep -Milliseconds 700
            try {
                $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 5
            }
            catch {
                continue   # デバッグポートがまだ開いていない
            }

            foreach ($t in $targets) {
                if ($t.url -match 'token=([A-Za-z0-9._-]+)') {
                    $token = $Matches[1]
                    break
                }
            }
            if ($token) { break }
        }
    }
    finally {
        if ($proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
        # Edge は子プロセスを残すことがあるため、同じプロファイルのものを掃除する
        Get-Process msedge -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -eq $edge } |
            Where-Object { $_.StartTime -gt (Get-Date).AddSeconds(-$TimeoutSeconds - 10) } |
            Stop-Process -Force -ErrorAction SilentlyContinue
    }

    if (-not $token) {
        Write-Log 'SSO からトークンを取得できませんでした。セッションが切れている可能性があります。' -Level WARN
        return $null
    }

    Write-Log 'トークンを取得しました。'
    return $token
}

function Assert-TokenOrNotify {
    <#
        トークンが取れなかった場合に、ユーザーの要望どおりメールで知らせます。
        1日に何度も同じメールを送らないよう、通知済みフラグを状態ファイルに持ちます。
    #>
    param([Parameter(Mandatory)]$Config, $Token, [string]$Context)

    if ($Token) {
        Set-DakokuState -Key 'authFailureNotifiedOn' -Value $null
        return $true
    }

    $today = Get-Date -Format 'yyyy-MM-dd'
    if ((Get-DakokuState -Key 'authFailureNotifiedOn') -eq $today) {
        Write-Log '認証失敗の通知は本日すでに送信済みのため、送信をスキップします。'
        return $false
    }

    $body = @"
打刻の自動処理が、打刻システムにログインできませんでした。

発生時刻: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
処理内容: $Context

ブラウザに保存されている SSO セッションが期限切れになったと思われます。
業務PC で次のコマンドを実行し、ログインし直してください。

    powershell -ExecutionPolicy Bypass -File "$($script:ScriptDir)\Dakoku.ps1" -Action Login -Interactive

復旧するまで自動打刻は動作しません。打刻は手動で行ってください。
ログ: $($script:LogDir)
"@

    Send-DakokuMail -To $Config.mailTo -Subject '[打刻] 自動打刻がログインできませんでした（要対応）' -Body $body | Out-Null
    Show-DakokuToast -Message '打刻システムにログインできませんでした。再ログインが必要です。'
    Set-DakokuState -Key 'authFailureNotifiedOn' -Value $today
    return $false
}

#endregion

#region ---------- API ----------

function Invoke-DakokuApi {
    param(
        [Parameter(Mandatory)]$Config,
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][ValidateSet('GET', 'POST')][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        $Body
    )

    $headers = @{
        'x-api-key'     = (Get-DakokuApiKey -Config $Config)
        'Authorization' = "bearer $Token"
    }
    $uri = '{0}{1}' -f $Config.apiBase, $Path
    $cacheBuster = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    $uri += $(if ($uri -match '\?') { "&_=$cacheBuster" } else { "?_=$cacheBuster" })

    if ($Method -eq 'GET') {
        return Invoke-RestMethod -Method GET -Uri $uri -Headers $headers -TimeoutSec 30
    }

    return Invoke-RestMethod -Method POST -Uri $uri -Headers $headers -TimeoutSec 30 `
        -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Compress)
}

function Get-LatestRecord {
    param([Parameter(Mandatory)]$Config, [Parameter(Mandatory)][string]$Token)

    try {
        return Invoke-DakokuApi -Config $Config -Token $Token -Method GET -Path '/record/latest'
    }
    catch {
        Write-Log "打刻状態の取得に失敗しました: $($_.Exception.Message)" -Level ERROR
        return $null
    }
}

function Test-PunchedIn {
    param($Record)
    if (-not $Record) { return $false }
    foreach ($name in @('startTime', 'startWork', 'startWorkTime', 'workStartTime')) {
        if ($Record.PSObject.Properties.Name -contains $name -and $Record.$name) { return $true }
    }
    return $false
}

function Test-PunchedOut {
    param($Record)
    if (-not $Record) { return $false }
    foreach ($name in @('endTime', 'endWork', 'endWorkTime', 'workEndTime')) {
        if ($Record.PSObject.Properties.Name -contains $name -and $Record.$name) { return $true }
    }
    return $false
}

function Invoke-Punch {
    <#
        POST /record
        kind: startWork | endWork | startBreak | endBreak
    #>
    param(
        [Parameter(Mandatory)]$Config,
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][ValidateSet('startWork', 'endWork', 'startBreak', 'endBreak')][string]$Kind,
        $LatestRecord
    )

    $now = Get-Date

    # 退勤は、出勤時に確定した勤務日に紐づける（日跨ぎ勤務のため）
    $workDate = $now.ToString('yyyy-MM-dd')
    if ($Kind -ne 'startWork' -and $LatestRecord -and
        $LatestRecord.PSObject.Properties.Name -contains 'recordDate' -and $LatestRecord.recordDate) {
        $workDate = ([datetime]$LatestRecord.recordDate).ToString('yyyy-MM-dd')
    }

    $body = @{
        kind      = $Kind
        workDate  = $workDate
        datetime  = $now.ToString('yyyy-MM-dd HH:mm')
        latitude  = $Config.latitude
        longitude = $Config.longitude
        modFlg    = 0
    }

    Write-Log ("打刻を送信します: kind={0} workDate={1} datetime={2}" -f $Kind, $workDate, $body.datetime)
    $result = Invoke-DakokuApi -Config $Config -Token $Token -Method POST -Path '/record' -Body $body
    Write-Log ("打刻に成功しました: {0}" -f ($result | ConvertTo-Json -Compress -Depth 5))
    return $result
}

#endregion

#region ---------- 状態管理 ----------

function Get-DakokuStateObject {
    if (Test-Path $script:StateFile) {
        try { return Get-Content $script:StateFile -Raw -Encoding UTF8 | ConvertFrom-Json }
        catch { return [pscustomobject]@{} }
    }
    return [pscustomobject]@{}
}

function Get-DakokuState {
    param([Parameter(Mandatory)][string]$Key)
    $state = Get-DakokuStateObject
    if ($state.PSObject.Properties.Name -contains $Key) { return $state.$Key }
    return $null
}

function Set-DakokuState {
    param([Parameter(Mandatory)][string]$Key, $Value)

    $state = Get-DakokuStateObject
    if ($state.PSObject.Properties.Name -contains $Key) { $state.$Key = $Value }
    else { $state | Add-Member -NotePropertyName $Key -NotePropertyValue $Value }

    $dir = Split-Path -Parent $script:StateFile
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $state | ConvertTo-Json -Depth 5 | Set-Content -Path $script:StateFile -Encoding UTF8
}

function Test-WithinPunchInWindow {
    param([Parameter(Mandatory)]$Config)

    $earliest = if ($Config.PSObject.Properties.Name -contains 'punchInEarliest') { $Config.punchInEarliest } else { '06:00' }
    $latest   = if ($Config.PSObject.Properties.Name -contains 'punchInLatest')   { $Config.punchInLatest }   else { '12:00' }
    $now      = Get-Date

    return ($now -ge [datetime]::ParseExact($earliest, 'HH:mm', $null) -and
            $now -le [datetime]::ParseExact($latest,   'HH:mm', $null))
}

function Test-IsWeekday {
    return (Get-Date).DayOfWeek -notin @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)
}

#endregion

#region ---------- アクション ----------

function Invoke-ActionPunchIn {
    param($Config)

    if (-not (Test-IsWeekday)) { Write-Log '平日ではないため、出勤打刻をスキップします。'; return }
    if (-not (Test-WithinPunchInWindow -Config $Config)) {
        Write-Log '設定された出勤打刻の時間帯外のため、スキップします。'
        return
    }
    if ((Get-DakokuState -Key 'lastPunchInDate') -eq (Get-Date -Format 'yyyy-MM-dd')) {
        Write-Log '本日はすでに出勤打刻済みのため、スキップします。'
        return
    }

    $token = Get-DakokuToken -Config $Config
    if (-not (Assert-TokenOrNotify -Config $Config -Token $token -Context '出勤打刻')) { return }

    $latest = Get-LatestRecord -Config $Config -Token $token
    if (Test-PunchedIn -Record $latest) {
        Write-Log 'サーバ側ですでに出勤打刻されているため、スキップします。'
        Set-DakokuState -Key 'lastPunchInDate' -Value (Get-Date -Format 'yyyy-MM-dd')
        return
    }

    Invoke-Punch -Config $Config -Token $token -Kind 'startWork' -LatestRecord $latest | Out-Null
    Set-DakokuState -Key 'lastPunchInDate' -Value (Get-Date -Format 'yyyy-MM-dd')
    Show-DakokuToast -Message ('出勤打刻しました ({0})' -f (Get-Date -Format 'HH:mm'))
}

function Invoke-ActionPunchOut {
    param($Config)

    $token = Get-DakokuToken -Config $Config
    if (-not (Assert-TokenOrNotify -Config $Config -Token $token -Context '退勤打刻')) { return }

    $latest = Get-LatestRecord -Config $Config -Token $token
    if (Test-PunchedOut -Record $latest) {
        Write-Log 'すでに退勤打刻済みです。'
        return
    }

    Invoke-Punch -Config $Config -Token $token -Kind 'endWork' -LatestRecord $latest | Out-Null
    Show-DakokuToast -Message ('退勤打刻しました ({0})' -f (Get-Date -Format 'HH:mm'))
}

function Invoke-ActionStatus {
    param($Config)

    $token = Get-DakokuToken -Config $Config -ShowWindow:$Interactive
    if (-not (Assert-TokenOrNotify -Config $Config -Token $token -Context '打刻状態の確認')) { return }

    $latest = Get-LatestRecord -Config $Config -Token $token
    Write-Host ''
    Write-Host '--- 現在の打刻状態 (/record/latest の生レスポンス) ---' -ForegroundColor Cyan
    $latest | ConvertTo-Json -Depth 6
    Write-Host ''
    Write-Host ('出勤打刻: {0}' -f $(if (Test-PunchedIn  -Record $latest) { '済' } else { '未' }))
    Write-Host ('退勤打刻: {0}' -f $(if (Test-PunchedOut -Record $latest) { '済' } else { '未' }))
}

function Invoke-ActionRemindEvening {
    param($Config)

    if (-not (Test-IsWeekday)) { return }

    $token = Get-DakokuToken -Config $Config
    if (-not $token) {
        # ここでは認証失敗メールを出さず、リマインドだけは必ず出す
        Show-DakokuToast -Message '退勤時刻です。打刻をお願いします。'
        return
    }

    $latest = Get-LatestRecord -Config $Config -Token $token
    if (Test-PunchedOut -Record $latest) {
        Write-Log '退勤打刻済みのため、リマインドは不要です。'
        return
    }

    Show-DakokuToast -Message '退勤の時間です。打刻を忘れずに。'
    Write-Log '退勤リマインドを表示しました。'
}

function Invoke-ActionRemindMissing {
    param($Config)

    if (-not (Test-IsWeekday)) { return }

    $token = Get-DakokuToken -Config $Config
    if (-not (Assert-TokenOrNotify -Config $Config -Token $token -Context '未打刻チェック')) { return }

    $latest = Get-LatestRecord -Config $Config -Token $token
    if (Test-PunchedOut -Record $latest) {
        Write-Log '退勤打刻済みです。リマインドメールは送信しません。'
        return
    }

    $body = @"
$(Get-Date -Format 'yyyy年MM月dd日') の退勤打刻がまだ記録されていません。

打刻システム:
$($Config.siteUrl)

出勤打刻: $(if (Test-PunchedIn -Record $latest) { '済' } else { '未' })
退勤打刻: 未

業務PC で次のコマンドを実行すると、この場で退勤打刻できます。

    powershell -ExecutionPolicy Bypass -File "$($script:ScriptDir)\Dakoku.ps1" -Action PunchOut
"@

    Send-DakokuMail -To $Config.mailTo -Subject '[打刻] 本日の退勤打刻が未登録です' -Body $body | Out-Null
    Show-DakokuToast -Message '退勤打刻がまだです。'
}

function Invoke-ActionLogin {
    param($Config)

    Write-Host 'ブラウザを開きます。SSO のログインを完了させてください。' -ForegroundColor Cyan
    $token = Get-DakokuToken -Config $Config -ShowWindow -TimeoutSeconds 300

    if ($token) {
        Write-Host 'ログインに成功しました。SSO セッションはブラウザプロファイルに保存されました。' -ForegroundColor Green
        Set-DakokuState -Key 'authFailureNotifiedOn' -Value $null
    }
    else {
        Write-Host 'トークンを取得できませんでした。時間内にログインが完了しなかった可能性があります。' -ForegroundColor Red
        exit 1
    }
}

#endregion

# ---------- エントリポイント ----------

try {
    $config = Get-DakokuConfig
    Write-Log "アクション開始: $Action"

    switch ($Action) {
        'PunchIn'       { Invoke-ActionPunchIn       -Config $config }
        'PunchOut'      { Invoke-ActionPunchOut      -Config $config }
        'Status'        { Invoke-ActionStatus        -Config $config }
        'RemindEvening' { Invoke-ActionRemindEvening -Config $config }
        'RemindMissing' { Invoke-ActionRemindMissing -Config $config }
        'Login'         { Invoke-ActionLogin         -Config $config }
    }

    Write-Log "アクション完了: $Action"
}
catch {
    Write-Log "処理が異常終了しました: $($_.Exception.Message)" -Level ERROR
    Write-Log $_.ScriptStackTrace -Level ERROR
    exit 1
}
