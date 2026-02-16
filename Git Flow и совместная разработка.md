# 🔀 Git Flow и совместная разработка

> Стандарты работы с Git для команды разработки Multi-Tenant SaaS

---

## 🎯 Основные принципы

### ✅ Что мы используем:
- **Git Flow** - стратегия ветвления для организованной разработки
- **Conventional Commits** - стандартизированные сообщения коммитов
- **Pull Request** - обязательный code review перед слиянием
- **Защищенные ветки** - `main` и `develop` защищены от прямого push

---

## 🌿 Стратегия ветвления (Git Flow)

### Основные ветки (долгоживущие):

| Ветка | Назначение | Когда обновляется |
|-------|-----------|-------------------|
| `main` | Продакшен код | Только через release ветки |
| `develop` | Разработка (интеграционная ветка) | При завершении feature/fix |

### Вспомогательные ветки (временные):

| Тип ветки | Префикс | Назначение | Пример |
|-----------|---------|-----------|--------|
| **Feature** | `feature/` | Новая функциональность | `feature/tenant-middleware` |
| **Bugfix** | `bugfix/` | Исправление багов в develop | `bugfix/order-sync-error` |
| **Hotfix** | `hotfix/` | Критичные исправления в main | `hotfix/memory-leak` |
| **Release** | `release/` | Подготовка к релизу | `release/v1.0.0` |

---

## 📋 Названия веток для этапов роудмапа

### Этап 0: Подготовка и планирование
```bash
feature/setup-project-structure
feature/configure-editorconfig
feature/setup-ci-cd
```

### Этап 1: Базовая инфраструктура
```bash
feature/infrastructure/dbcontext-setup
feature/infrastructure/di-container
feature/infrastructure/logging-setup
feature/infrastructure/appsettings-config
```

### Этап 2: Multi-Tenant основа
```bash
feature/multitenant/tenant-model
feature/multitenant/tenant-middleware
feature/multitenant/tenant-service
feature/multitenant/scoped-dbcontext
feature/multitenant/auto-db-creation
feature/multitenant/identity-with-tenant
```

### Этап 3: Работа с данными
```bash
feature/data/domain-models
feature/data/ef-configuration
feature/data/query-extensions
feature/data/filters-sorting
feature/data/soft-delete
feature/data/migrations-setup
```

### Этап 4: Авторизация и безопасность
```bash
feature/auth/identity-setup
feature/auth/user-registration
feature/auth/tenant-authorization
feature/auth/jwt-tokens
feature/auth/fluent-validation
feature/auth/global-exception-handler
```

### Этап 5: Базовый UI
```bash
feature/ui/base-layout
feature/ui/tenant-page-base
feature/ui/data-table-component
feature/ui/pagination-component
feature/ui/login-registration
feature/ui/admin-dashboard
feature/ui/orders-list-page
```

### Этап 6: Интеграции с внешними API
```bash
feature/integrations/http-client-factory
feature/integrations/delegating-handlers
feature/integrations/order-adapter-interface
feature/integrations/ozon-adapter
feature/integrations/enricher-pipeline
feature/integrations/order-sync-service
```

### Этап 7: Оптимизация и кэширование
```bash
feature/cache/redis-setup
feature/cache/global-cache-service
feature/cache/tenant-cache-service
feature/cache/response-caching
feature/cache/cache-invalidation
```

### Этап 8: Фоновые задачи
```bash
feature/background/hangfire-setup
feature/background/tenant-jobs
feature/background/order-sync-job
feature/background/job-queues
```

### Этап 9: DevOps и развертывание
```bash
feature/devops/dns-setup
feature/devops/ssl-certificates
feature/devops/nginx-config
feature/devops/systemd-service
feature/devops/cicd-pipeline
feature/devops/backup-scripts
```

### Этап 10: Полировка и доработка
```bash
feature/polish/error-handling
feature/polish/structured-logging
feature/polish/admin-panel
feature/polish/export-functionality
feature/polish/performance-optimization
```

---

## 📝 Стиль коммитов (Conventional Commits)

### Формат сообщения коммита:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Типы коммитов:

| Тип | Описание | Пример |
|-----|----------|--------|
| `feat` | Новая функциональность | `feat(multitenant): add tenant middleware` |
| `fix` | Исправление бага | `fix(orders): resolve N+1 query issue` |
| `docs` | Изменения в документации | `docs(readme): add git flow section` |
| `style` | Форматирование кода (не влияет на логику) | `style(controllers): format code` |
| `refactor` | Рефакторинг кода | `refactor(services): extract common logic` |
| `perf` | Улучшение производительности | `perf(queries): optimize order list query` |
| `test` | Добавление/изменение тестов | `test(adapters): add ozon adapter tests` |
| `chore` | Обновление зависимостей, конфигов | `chore(deps): update EF Core to 8.0` |
| `ci` | Изменения CI/CD | `ci(github): add deployment workflow` |

### Scope (область изменений):

Используй короткое описание модуля/компонента:
- `multitenant` - мультитенантность
- `auth` - авторизация
- `orders` - заказы
- `adapters` - адаптеры
- `cache` - кэширование
- `ui` - пользовательский интерфейс
- `db` - база данных
- `api` - API контроллеры

### Subject (тема):

- **Начинай с маленькой буквы** (кроме имен собственных)
- **Без точки в конце**
- **Императивное наклонение** ("add" вместо "added" или "adds")
- **Максимум 50 символов**

### Примеры хороших коммитов:

```bash
feat(multitenant): add tenant middleware for subdomain detection

fix(orders): resolve memory leak in order sync service

docs(readme): add git flow documentation

refactor(services): extract cache logic to separate service

perf(queries): optimize order list with projection

test(adapters): add unit tests for ozon adapter

chore(deps): update ASP.NET Core to 8.0.1
```

### Примеры плохих коммитов:

```bash
# ❌ Слишком общее
"update code"

# ❌ Не информативно
"fix bug"

# ❌ Прошедшее время
"added feature"

# ❌ Слишком длинное
"implemented tenant middleware that detects tenant from subdomain and sets context"
```

---

## 🔄 Workflow для разработки

### 1. Создание feature ветки

```bash
# Обновить develop
git checkout develop
git pull origin develop

# Создать новую ветку
git checkout -b feature/multitenant/tenant-middleware

# Или с префиксом этапа
git checkout -b feature/stage-2-tenant-middleware
```

### 2. Разработка и коммиты

```bash
# Делай маленькие, логичные коммиты
git add .
git commit -m "feat(multitenant): add tenant model"

git add .
git commit -m "feat(multitenant): implement tenant middleware"

# Push в удаленный репозиторий
git push origin feature/multitenant/tenant-middleware
```

### 3. Создание Pull Request

**Правила PR:**
- Название PR = название feature ветки
- Описание должно содержать:
  - Что сделано
  - Как протестировано
  - Связанные задачи/issues
  - Скриншоты (если UI изменения)

**Пример описания PR:**

```markdown
## Что сделано
- Реализован TenantMiddleware для определения тенанта по субдомену
- Добавлен ITenantService для работы с текущим тенантом
- Настроен Scoped DbContext для каждого тенанта

## Как протестировано
- [x] Проверено определение тенанта по субдомену
- [x] Проверена изоляция данных между тенантами
- [x] Протестирована работа с несколькими БД

## Связанные задачи
Closes #42
```

### 4. Code Review

**Правила ревью:**
- Минимум 1 одобрение перед merge
- Все комментарии должны быть адресованы
- Исправления делаются в той же ветке (новые коммиты)

```bash
# После замечаний ревьюера
git add .
git commit -m "fix(multitenant): address code review comments"
git push origin feature/multitenant/tenant-middleware
```

### 5. Слияние в develop

```bash
# После одобрения PR, слить через GitHub UI
# Или вручную:
git checkout develop
git pull origin develop
git merge --no-ff feature/multitenant/tenant-middleware
git push origin develop

# Удалить локальную ветку
git branch -d feature/multitenant/tenant-middleware

# Удалить удаленную ветку
git push origin --delete feature/multitenant/tenant-middleware
```

---

## 🐛 Работа с багами

### Bugfix ветки (баги в develop):

```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/order-sync-error

# Исправление
git commit -m "fix(orders): resolve sync error for cancelled orders"

# PR в develop
```

### Hotfix ветки (критичные баги в main):

```bash
git checkout main
git pull origin main
git checkout -b hotfix/memory-leak

# Исправление
git commit -m "fix(cache): resolve memory leak in cache service"

# PR в main И develop
```

---

## 🚀 Подготовка релиза

### Release ветка:

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# Обновить версию, CHANGELOG, документацию
git commit -m "chore(release): bump version to 1.0.0"
git commit -m "docs(changelog): update changelog for v1.0.0"

# Тестирование, финальные правки
git commit -m "fix(ui): resolve layout issue on mobile"

# Слить в main и develop
git checkout main
git merge --no-ff release/v1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"

git checkout develop
git merge --no-ff release/v1.0.0

# Удалить release ветку
git branch -d release/v1.0.0
```

---

## 📊 Чек-лист перед коммитом

- [ ] Код компилируется без ошибок
- [ ] Все тесты проходят (если есть)
- [ ] Код соответствует стилю проекта (.editorconfig)
- [ ] Нет закомментированного кода
- [ ] Нет console.log/debugger (если не для отладки)
- [ ] Сообщение коммита следует Conventional Commits
- [ ] Изменения логически связаны (один коммит = одна задача)

---

## 🎯 Правила для команды

### ✅ Делай:
- Маленькие, частые коммиты
- Понятные названия веток и коммитов
- Pull Request для всех изменений
- Code review перед merge
- Обновляй develop перед созданием новой ветки
- Удаляй ветки после merge

### ❌ Не делай:
- Коммиты напрямую в `main` или `develop`
- Большие коммиты с множеством изменений
- Коммиты с сообщениями типа "fix", "update", "changes"
- Force push в общие ветки
- Merge без code review
- Оставляй мертвые ветки в репозитории

---

## 🔧 Полезные Git команды

### Просмотр истории:
```bash
# Красивая история коммитов
git log --oneline --graph --all

# История с фильтрацией по автору
git log --author="Имя"

# История изменений файла
git log --follow -- <file>
```

### Работа с ветками:
```bash
# Список всех веток
git branch -a

# Удалить локальные ветки, которые уже удалены на remote
git fetch --prune

# Переименовать ветку
git branch -m old-name new-name
```

### Отмена изменений:
```bash
# Отменить изменения в файле (до staging)
git checkout -- <file>

# Отменить staging
git reset HEAD <file>

# Отменить последний коммит (сохранить изменения)
git reset --soft HEAD~1
```

---

## 📚 Дополнительные ресурсы

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Semantic Versioning](https://semver.org/)

---

## 🎯 Примеры для каждого этапа роудмапа

### Этап 1: Базовая инфраструктура
```bash
git checkout -b feature/infrastructure/dbcontext-setup
git commit -m "feat(db): add MasterDbContext and TenantDbContext"
git commit -m "feat(db): configure EF Core with SQL Server"
git commit -m "chore(config): add connection strings to appsettings"
```

### Этап 2: Multi-Tenant основа
```bash
git checkout -b feature/multitenant/tenant-middleware
git commit -m "feat(multitenant): add Tenant model to master DB"
git commit -m "feat(multitenant): implement TenantMiddleware"
git commit -m "feat(multitenant): add ITenantService interface"
git commit -m "feat(multitenant): implement TenantService"
git commit -m "feat(multitenant): configure scoped DbContext per tenant"
```

### Этап 3: Работа с данными
```bash
git checkout -b feature/data/query-extensions
git commit -m "feat(data): add Order query extensions"
git commit -m "feat(data): implement IncludeEverything extension"
git commit -m "feat(data): add OnlyActive filter extension"
git commit -m "refactor(queries): use extensions in order service"
```

---

**Помни:** Хорошие коммиты = легкая отладка и понимание истории проекта! 🚀

