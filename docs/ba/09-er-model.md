# OnlyPlans — ER-модель (концептуальная/логическая)
> Версия 2.0. Кардинальности согласованы для Idea/Epic/Stage/Task. Поля статусов и прав частично предварительные; это не физическая PostgreSQL-схема.

```mermaid
erDiagram
    TEAM ||--o{ ROADMAP : owns
    TEAM ||--o{ TEAM_MEMBER : includes
    USER ||--o{ TEAM_MEMBER : joins
    ROADMAP ||--o{ ROADMAP_MEMBER : grants
    USER ||--o{ ROADMAP_MEMBER : participates
    ROADMAP ||--o{ IDEA : contains
    IDEA o|--o{ EPIC : inspires
    ROADMAP ||--o{ EPIC : contains
    EPIC ||--o{ STAGE : has
    STAGE ||--o{ TASK : contains
    ROADMAP ||--o{ STAGE_TEMPLATE : configures
    STAGE_TEMPLATE ||--o{ STAGE_TEMPLATE_ITEM : contains
    ROADMAP ||--o{ DURATION_PRESET : configures
    DURATION_PRESET o|--o{ STAGE_TEMPLATE_ITEM : presets
    ROADMAP ||--o{ TASK_TYPE : configures
    ROADMAP ||--o{ TASK_STATUS : configures
    TASK_TYPE ||--o{ TASK : classifies
    TASK_STATUS ||--o{ TASK : determines_progress
    TASK ||--o{ TASK_ASSIGNEE : assigned
    USER ||--o{ TASK_ASSIGNEE : performs
    TASK ||--o{ START_CONSTRAINT : constrained
    TASK ||--o{ TASK_DEPENDENCY : predecessor
    TASK ||--o{ TASK_DEPENDENCY : successor
    USER ||--o{ CHANGE_LOG : authors
    ROADMAP ||--o{ CHANGE_LOG : records

    TEAM { uuid id PK string name }
    USER { uuid id PK string display_name }
    TEAM_MEMBER { uuid team_id FK uuid user_id FK }
    ROADMAP { uuid id PK uuid team_id FK string name }
    ROADMAP_MEMBER { uuid roadmap_id FK uuid user_id FK string role }
    IDEA { uuid id PK uuid roadmap_id FK string title text problem text hypothesis text source text current_workaround text alternatives text target_users text expected_effect string priority uuid owner_user_id FK string status text decision_reason }
    EPIC { uuid id PK uuid roadmap_id FK uuid idea_id FK string title text description string status }
    STAGE { uuid id PK uuid epic_id FK string name int sort_order date start_date int duration_workdays }
    TASK { uuid id PK uuid stage_id FK uuid task_type_id FK uuid task_status_id FK string title text description date planned_start date planned_end timestamp actual_start_at timestamp actual_completed_at int version }
    STAGE_TEMPLATE { uuid id PK uuid roadmap_id FK string name }
    STAGE_TEMPLATE_ITEM { uuid id PK uuid template_id FK uuid preset_id FK string name int sort_order int default_duration_workdays }
    DURATION_PRESET { uuid id PK uuid roadmap_id FK string name int duration_workdays }
    TASK_TYPE { uuid id PK uuid roadmap_id FK string name string color boolean is_archived }
    TASK_STATUS { uuid id PK uuid roadmap_id FK string name string color int sort_order int progress_percent boolean is_archived }
    TASK_ASSIGNEE { uuid task_id FK uuid user_id FK }
    START_CONSTRAINT { uuid id PK uuid task_id FK date not_before text reason }
    TASK_DEPENDENCY { uuid predecessor_task_id FK uuid successor_task_id FK string kind }
    CHANGE_LOG { uuid id PK uuid roadmap_id FK uuid author_user_id FK string target_type uuid target_id string field_name json old_value json new_value timestamp changed_at }
```

## Инварианты
1. `IDEA` — физическая сущность Discovery; отдельной таблицы `INITIATIVE` нет.
2. `EPIC.idea_id` допускает NULL. Одна Idea может быть связана с несколькими Epic.
3. `STAGE.epic_id` и `TASK.stage_id` обязательны; каждая Task принадлежит одному Stage.
4. Эпик может иметь ноль этапов; задачи без Stage запрещены.
5. Применение шаблона копирует элементы в Stage. Последующие изменения экземпляра не обновляют STAGE_TEMPLATE_ITEM.
6. Длительность Stage и пресетов — рабочие дни пн–пт; плановый конец вычисляется по старту и длительности. Точные правила границ — OQ-13.
7. Task может иметь нескольких исполнителей; прогресс общий, вычисляется из TASK_STATUS. Схема `progress_percent` в справочнике — **предложение** для решения OQ-03.
8. START_CONSTRAINT: ноль или много записей на Task; изменение даты предлагает обновить причину.
9. TASK_DEPENDENCY.kind = FS; запрет самоссылок и циклов требует проверки на уровне приложения/БД.
10. История изменения ограничения — CHANGE_LOG; отдельной таблицы событий нарушения в MVP нет.
11. Все связи между Epic/Stage/Task/справочниками/исполнителями должны оставаться внутри одного роадмапа.
12. Фактические даты завершённых задач нельзя автоматически переписывать магнитом.

## За рамками этой диаграммы
Точная модель прав, комментарии, пользовательские настройки представлений, правила архивирования и жизненные циклы требуют решения OQ. Они не должны считаться удалёнными функциями только потому, что не детализированы здесь. Физические FK для полиморфного CHANGE_LOG определить отдельно.
