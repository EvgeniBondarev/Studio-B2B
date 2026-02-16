Это очень важная и часто упускаемая из виду часть SaaS.
Представь: ты сделал крутой продукт, клиент зарегистрировался, зашел в панель... а там **пустота**.
Нет статусов, нет типов транзакций, нет настроек. Ему нужно 3 часа читать документацию и создавать всё с нуля.
**Результат:** Он уйдет.

**Seed Data (Наполнение базы)** — это процесс автоматического создания предустановленных данных для **каждого нового тенанта**, чтобы он мог начать работать через 5 секунд после регистрации.

---

### Что нужно сидировать (наполнять) в B2B SaaS Заказах

1.  **Статусы Заказов (Workflow):**
    *   `Новый` (New)
    *   `В работе` (Processing)
    *   `Отгружен` (Shipped)
    *   `Отменен` (Cancelled)
    *   `Возврат` (Returned)
    *   *Важно:* У статусов должны быть флаги `IsSystem = true` (их нельзя удалить) и `IsFinal` (для Отменен/Выполнен).

2.  **Типы Транзакций (Документы):**
    *   `Заказ поставщику` (Purchase Order)
    *   `Приемка на склад` (Inbound)
    *   `Отгрузка клиенту` (Outbound)
    *   `Списание` (Write-off)
    *   `Инвентаризация` (Inventory)

3.  **Склады (Warehouses):**
    *   `Основной склад` (Main) — чтобы было куда принимать товар сразу.

4.  **Роли и Права (Roles & Permissions):**
    *   `Administrator` (Полный доступ)
    *   `Manager` (Заказы, Клиенты)
    *   `WarehouseWorker` (Только Склад и Транзакции)

5.  **Настройки уведомлений:**
    *   Шаблон письма "Ваш заказ создан".

---

### Архитектура Сидера (Seeder Architecture)

Это не просто SQL-скрипт. Это **C# сервис**, который запускается в момент создания тенанта.

#### 1. Интерфейс Сидера

```csharp
public interface ITenantSeeder
{
    // Запускается один раз при создании базы клиента
    Task SeedAsync(TenantDbContext context, CancellationToken ct);
}
```

#### 2. Реализация (Smart Seeder)

Мы используем **Idempotent Seeding** (Идемпотентность). Это значит, что если запустить сидер дважды, он ничего не сломает (не создаст дубликаты).

```csharp
public class TenantSeeder : ITenantSeeder
{
    public async Task SeedAsync(TenantDbContext context, CancellationToken ct)
    {
        // 1. Статусы (Workflow)
        if (!await context.Statuses.AnyAsync(ct))
        {
            var newStatus = new OrderStatus { Name = "Новый", Color = "#3498db", IsSystem = true, Order = 1 };
            var processStatus = new OrderStatus { Name = "В работе", Color = "#f1c40f", IsSystem = true, Order = 2 };
            var shippedStatus = new OrderStatus { Name = "Отгружен", Color = "#2ecc71", IsSystem = true, Order = 3, IsFinal = true };
            
            context.Statuses.AddRange(newStatus, processStatus, shippedStatus);
            await context.SaveChangesAsync(ct);
        }

        // 2. Типы Транзакций (Документы)
        if (!await context.TransactionDefinitions.AnyAsync(ct))
        {
            // Создаем JSON-схему для формы "Отгрузка"
            var shipmentForm = JsonSerializer.Serialize(new[]
            {
                new { Key = "WarehouseId", Type = "WarehouseSelect", Label = "Склад отгрузки", Required = true },
                new { Key = "TrackingNumber", Type = "Text", Label = "Трек-номер" }
            });

            var shipmentDef = new TransactionDefinition
            {
                Name = "Отгрузка товара (FBS)",
                FromStatusId = 2, // В работе
                ToStatusId = 3,   // Отгружен
                FormSchemaJson = shipmentForm,
                IsSystem = true
            };

            context.TransactionDefinitions.Add(shipmentDef);
            await context.SaveChangesAsync(ct);
        }

        // 3. Склад по умолчанию
        if (!await context.Warehouses.AnyAsync(ct))
        {
            context.Warehouses.Add(new Warehouse { Name = "Основной склад", IsDefault = true });
            await context.SaveChangesAsync(ct);
        }
    }
}
```

---

### 3. Где вызывать Сидер?

Это самый важный момент.
В **SaaS** есть два сценария создания тенанта:

1.  **Регистрация (Self-Service):** Клиент заполняет форму на сайте -> Создается база -> Запускается сидер.
2.  **Админка (Admin Panel):** Ты создаешь клиента вручную.

**Лучшее место:** В обработчике события `TenantCreated`.

```csharp
// Features/Tenants/CreateTenant/CreateTenantHandler.cs

public async Task<Guid> Handle(CreateTenantCommand cmd, CancellationToken ct)
{
    // 1. Создаем запись в MasterDB
    var tenant = new Tenant { Name = cmd.Name, ... };
    _masterDb.Tenants.Add(tenant);
    await _masterDb.SaveChangesAsync(ct);

    // 2. Миграция базы данных клиента (создание таблиц)
    // (см. прошлые ответы про MigrationRunner)
    await _migrator.MigrateAsync(tenant.ConnectionString);

    // 3. 🔥 ЗАПУСК СИДЕРА (Наполнение данными)
    // Создаем Scope, так как TenantDbContext - Scoped
    using var scope = _serviceScopeFactory.CreateScope();
    
    // Подменяем connection string на новую базу
    var tenantContext = scope.ServiceProvider.GetRequiredService<TenantDbContext>();
    tenantContext.Database.SetConnectionString(tenant.ConnectionString);

    var seeder = scope.ServiceProvider.GetRequiredService<ITenantSeeder>();
    await seeder.SeedAsync(tenantContext, ct);

    return tenant.Id;
}
```

---

### 4. Продвинутый уровень: JSON-шаблоны (Industry Standard)

Хардкодить данные в C# коде (`new Status { Name = "Новый" }`) — плохо. Если захочешь поменять дефолтный цвет статуса, придется пересобирать проект.

**Лучшая практика:** Хранить данные в JSON файлах рядом с проектом.

**Файл `SeedData/statuses.json`:**
```json
[
  { "Name": "Новый", "Color": "#Blue", "Order": 1 },
  { "Name": "В работе", "Color": "#Yellow", "Order": 2 }
]
```

**Файл `SeedData/transactions.json`:**
```json
[
  { "Name": "Приемка", "Type": "Inbound" },
  { "Name": "Отгрузка", "Type": "Outbound" }
]
```

**В коде Сидера:**
```csharp
public async Task SeedAsync(...)
{
    // Читаем JSON
    var statusData = await File.ReadAllTextAsync("SeedData/statuses.json");
    var statuses = JsonSerializer.Deserialize<List<OrderStatus>>(statusData);

    // Добавляем, если нет
    if (!await context.Statuses.AnyAsync())
    {
        context.Statuses.AddRange(statuses);
        await context.SaveChangesAsync();
    }
}
```

---

### 5. Версионирование Сидов (Seed Migrations)

Что если ты добавил новую крутую фичу "Автоматическое списание брака" и хочешь, чтобы она появилась **у всех существующих клиентов**?

Обычный сидер запускается только 1 раз при создании.

**Решение:**
Добавь таблицу `__SeedHistory` в базу клиента (как `__EFMigrationsHistory`).

```csharp
public class SeedHistory
{
    public string SeedName { get; set; } // "2023_Add_Wms_Feature"
    public DateTime AppliedAt { get; set; }
}
```

**Логика:**
При старте приложения (или деплое новой версии) проходи по всем клиентам и проверяй:
*"Применен ли сид 'Add_Wms_Feature'? Нет? Применяем и записываем в историю."*

Это позволяет **эволюционировать данные** клиентов вместе с кодом.

### Итого:

1.  **Не оставляй базу пустой.** Клиент должен видеть готовый к работе продукт.
2.  **Idempotency.** Сидер должен быть безопасным для повторного запуска.
3.  **JSON файлы.** Храни шаблоны данных в файлах, а не в коде.
4.  **Seed Migrations.** Думай о том, как добавить новые данные старым клиентам.