# OnlyPlans — ER-модель
> Логическая модель. Не физическая схема PostgreSQL. Кардинальности, отмеченные OQ, являются предположениями.

```mermaid
erDiagram
 TEAM ||--o{ ROADMAP : owns
 TEAM ||--o{ TEAM_MEMBER : has
 USER ||--o{ TEAM_MEMBER : joins
 ROADMAP ||--o{ ROADMAP_MEMBER : grants
 USER ||--o{ ROADMAP_MEMBER : participates
 ROADMAP ||--o{ INITIATIVE : contains
 INITIATIVE ||--o{ FEATURE : decomposes
 FEATURE ||--o{ STAGE : has
 STAGE ||--o{ TASK : contains
 ROADMAP ||--o{ TASK_TYPE : configures
 ROADMAP ||--o{ TASK_STATUS : configures
 TASK_TYPE ||--o{ TASK : classifies
 TASK_STATUS ||--o{ TASK : current_state
 TASK ||--o{ TASK_ASSIGNEE : assigned
 USER ||--o{ TASK_ASSIGNEE : performs
 TASK o|--o{ TASK : parent_of
 ROADMAP ||--o{ ROADMAP_VIEW : defines
 USER ||--o{ USER_VIEW_VISIBILITY : configures
 ROADMAP_VIEW ||--o{ USER_VIEW_VISIBILITY : contains
 TASK ||--o{ USER_VIEW_VISIBILITY : visibility
 TASK ||--o{ MILESTONE_EVENT : reaches
 TASK_STATUS ||--o{ MILESTONE_EVENT : records
 TASK ||--o{ TASK_DEPENDENCY : relates
 ROADMAP ||--o{ DURATION_PRESET : defines
 USER ||--o{ COMMENT : writes
 USER ||--o{ CHANGE_LOG : changes
 TEAM { uuid id PK string name }
 USER { uuid id PK string display_name string auth_subject }
 TEAM_MEMBER { uuid team_id FK uuid user_id FK string membership_status }
 ROADMAP { uuid id PK uuid team_id FK string name date period_start date period_end }
 ROADMAP_MEMBER { uuid roadmap_id FK uuid user_id FK string role }
 INITIATIVE { uuid id PK uuid roadmap_id FK string kind string title string description string priority uuid owner_user_id FK date start_date date end_date }
 FEATURE { uuid id PK uuid initiative_id FK string title string description string priority uuid owner_user_id FK date start_date date end_date }
 STAGE { uuid id PK uuid feature_id FK string name int sort_order date start_date date end_date }
 TASK { uuid id PK uuid stage_id FK uuid parent_task_id FK uuid task_type_id FK uuid task_status_id FK string title string description string priority date start_date date end_date int version }
 TASK_TYPE { uuid id PK uuid roadmap_id FK string name string color boolean is_archived }
 TASK_STATUS { uuid id PK uuid roadmap_id FK string name string color int sort_order boolean is_milestone boolean is_archived }
 TASK_ASSIGNEE { uuid task_id FK uuid user_id FK }
 ROADMAP_VIEW { uuid id PK uuid roadmap_id FK string name string view_type json settings }
 USER_VIEW_VISIBILITY { uuid user_id FK uuid view_id FK uuid task_id FK boolean is_visible }
 MILESTONE_EVENT { uuid id PK uuid task_id FK uuid status_id FK timestamp reached_at }
 TASK_DEPENDENCY { uuid predecessor_task_id FK uuid successor_task_id FK string relation_type }
 DURATION_PRESET { uuid id PK uuid roadmap_id FK string name int duration_value string duration_unit }
 COMMENT { uuid id PK uuid author_user_id FK string target_type uuid target_id FK text body timestamp created_at }
 CHANGE_LOG { uuid id PK uuid author_user_id FK string target_type uuid target_id FK string field_name json old_value json new_value timestamp changed_at }
```

## Ограничения
- Все дочерние объекты принадлежат одному роадмапу по родительской цепочке.
- Тип/статус задачи и исполнитель принадлежат тому же роадмапу.
- Родитель и дочерние задачи в MVP — один этап.
- Зависимость не может связывать задачу с самой собой и не должна образовывать цикл.
- Уникальность видимости: user_id + view_id + task_id.
- Уникальность назначения: task_id + user_id.
- Версия задачи увеличивается при изменении общих полей; персональная видимость её не меняет.
- Комментарии и ChangeLog требуют контролируемой связи с целевым объектом; способ реализации FK определить при физическом проектировании.
- Визуальные части задачи по исполнителям — проекция Task + TaskAssignee, не отдельные задачи.

## Предположения
Initiative 1:N Feature (OQ-01). Даты — DATE, если не потребуется время суток. Веха фиксируется отдельным событием при переходе в статус с признаком is_milestone.
