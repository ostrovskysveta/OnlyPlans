Требуется PowerShell 7.5+ (pwsh), не Windows PowerShell 5.1.

# Личные журналы

Запускайте из корня репозитория в PowerShell. Замените alice своим GitHub-логином.

```powershell
$s = ./scripts/session.ps1 start -Person alice -Summary 'Карточки инициатив'
./scripts/session.ps1 usage -Person alice -SessionId $s -Kind mode -Name Default -Summary 'Рабочий режим'
./scripts/session.ps1 usage -Person alice -SessionId $s -Kind tool -Name apply_patch -Summary 'Редактирование файлов'
./scripts/session.ps1 decision -Person alice -SessionId $s -Summary 'Храним сроки в UTC' -Alternatives 'Локальное время' -Consequences 'Преобразование при отображении'
./scripts/session.ps1 stop -Person alice -SessionId $s -Summary 'Карточки готовы'
```

Если среда сообщает точный расход сессии, передайте stop параметры `-InputTokens 123 -OutputTokens 45 -TokenSource 'API usage, вся сессия, без повторного учёта'`. Без них токены остаются null. Cached/reasoning токены не добавляйте повторно к общим значениям. Отдельный биллинг провайдера может иметь другую область измерения.

Структура: `logs/<логин>/<SessionId>/work.json`, `decisions.json`, `usage.json`. Время сохраняется в UTC; duration_seconds вычисляется автоматически. Каждый сеанс имеет отдельную папку для уменьшения конфликтов. Решения и использование — JSON-массивы. Пустой decisions.json допустим только с объяснением в итоговом summary.

Сводка времени (незакрытые сессии не учитываются):

```powershell
Get-ChildItem logs -Recurse -Filter work.json | ForEach-Object { Get-Content $_.FullName -Raw | ConvertFrom-Json } | Group-Object person | ForEach-Object { [pscustomobject]@{ Person=$_.Name; Seconds=($_.Group | Measure-Object duration_seconds -Sum).Sum; Sessions=$_.Count } }
```

Правила AGENTS.md действуют для агента, который читает этот файл. Для других редакторов явно передайте ему команду прочитать AGENTS.md. Наличие файла само по себе не устанавливает плагины и не даёт доступ к счётчикам токенов.
