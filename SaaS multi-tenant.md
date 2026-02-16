Ты хочешь именно классическую **SaaS multi-tenant** модель с **полной изоляцией данных клиентов** (у каждого клиента своя база заказов), но при этом всё работает на твоём сервере/серверах и ты имеешь центральную базу клиентов (тенантов).  
Это самая правильная и продаваемая архитектура в 2024-2025 году для систем учёта заказов/CRM/ERP.

Вот как это делают все серьёзные платформы (Odoo, Bitrix24, AmoCRM, Monday, Notion, ClickUp и т.д.).

### Рекомендуемая архитектура (именно то, что тебе нужно)

**1 раз — мастер-приложение + мастер-база (Tenants DB)**  
**N раз — базы данных клиентов (по одной на клиента)**

```
Сервер (твой)
├── ASP.NET Core приложение (одно на всех)
├── База "Master/Tenants" — хранит:
│   ├── Tenants (Id, CompanyName, Subdomain, ConnectionString, Plan, IsActive, Created etc.)
│   ├── Users (обычный AspNet Identity, но с TenantId)
│   └── Billing, Payments, Subscriptions и т.д.
└── Базы клиентов:
    ├── client1_orders_db
    ├── client2_orders_db
    ├── client3_orders_db
    └── ...
```

Преимущества этой схемы (именно её хотят 95 % заказчиков):
- 100 % изоляция данных (один клиент никогда не увидит данные другого даже при баге)
- Легко делать отдельный бэкап/восстановление только одному клиенту
- Легко переносить "тяжёлого" клиента на отдельный сервер позже
- Клиент психологически спокоен — "у меня своя база"
- Можно продавать тариф "Выделенная база" дороже

### Как реализовать в ASP.NET Core (рабочая схема 2025 года)

1. Определение тенанта — по субдомену (самый удобный и красивый вариант)

```
client1.tvoysoft.ru      → TenantId = 1
demo.tvoysoft.ru         → демо-тенант
app.tvoysoft.ru          → твой админский/мастерский интерфейс (или отдельно admin.tvoysoft.ru)
```

2. Middleware для определения тенанта (самый важный кусок кода)

```csharp
public class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ITenantService tenantService)
    {
        var host = context.Request.Host.Host; // например client1.tvoysoft.ru

        // игнорируем www, admin и т.д.
        if (host.StartsWith("www.")) host = host["www.".Length..];
        if (host == "tvoysoft.ru" || host == "admin.tvoysoft.ru")
        {
            // это мастер/админка — тенант не нужен или специальный
            context.Items["TenantId"] = null;
        }
        else
        {
            var subdomain = host.Split('.')[0];
            var tenant = await tenantService.GetTenantBySubdomainAsync(subdomain);
            if (tenant == null)
            {
                context.Response.StatusCode = 404;
                await context.Response.WriteAsync("Tenant not found");
                return;
            }

            context.Items["TenantId"] = tenant.Id;
            context.Items["Tenant"] = tenant;
        }

        await _next(context);
    }
}
```

3. Динамическое подключение к базе клиента через DbContext с мульти-тенантом

Самый чистый способ — использовать **EF Core с переопределением OnConfiguring** или лучше — **мульти-тенант DbContext через фабрику**.

Вариант A (рекомендую) — свой TenantDbContext с динамическим connection string

```csharp
public class TenantDbContext : DbContext
{
    private readonly string _connectionString;

    public TenantDbContext(string connectionString)
    {
        _connectionString = connectionString;
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseSqlServer(_connectionString);
        // или UseNpgsql если PostgreSQL
    }

    public DbSet<Order> Orders { get; set; }
    public DbSet<Client> Clients { get; set; }
    // все твои сущности заказов
}
```

В DI регистрируем так:

```csharp
services.AddScoped<TenantDbContext>(provider =>
{
    var tenantService = provider.GetRequiredService<ITenantService>();
    var tenant = tenantService.CurrentTenant 
                 ?? throw new Exception("Tenant not resolved");

    return new TenantDbContext(tenant.ConnectionString);
});
```

Вариант B (ещё круче) — Finbuckle.MultiTenant (библиотека №1 для .NET multi-tenant)

```bash
Install-Package Finbuckle.MultiTenant
```

Она делает 90 % работы за тебя:
- автоматически определяет тенант по субдомену/домену/папке
- автоматически подменяет connection string
- поддерживает отдельную БД на тенанта из коробки

Многие крупные SaaS на .NET используют именно Finbuckle.

4. Создание нового клиента = создание новой базы + запись в мастер-базу

```csharp
public async Task CreateTenantAsync(CreateTenantRequest request)
{
    // 1. создаём запись в мастер-базе
    var tenant = new Tenant
    {
        CompanyName = request.CompanyName,
        Subdomain = request.Subdomain,
        Plan = "Starter"
    };
    _masterDb.Tenants.Add(tenant);
    await _masterDb.SaveChangesAsync();

    // 2. создаём физическую базу клиента
    var masterConnection = "Server=.;Database=MasterDb;...";
    var newDbName = $"client_{tenant.Id}_db";

    using var connection = new SqlConnection(masterConnection);
    await connection.OpenAsync();
    using var cmd = connection.CreateCommand();
    
    cmd.CommandText = $"CREATE DATABASE [{newDbName}]";
    await cmd.ExecuteNonQueryAsync();

    // 3. сохраняем connection string
    tenant.ConnectionString = $"Server=.;Database={newDbName};Trusted_Connection=True;Encrypt=false;";
    await _masterDb.SaveChangesAsync();

    // 4. применяем миграции к новой базе
    var tenantContext = new TenantDbContext(tenant.ConnectionString);
    await tenantContext.Database.MigrateAsync();
}
```

5. Миграции

Два варианта:

Вариант А (просто):
- Одна кодовая база миграций
- При создании нового тенанта — прогоняешь `context.Database.Migrate()` к его базе (как выше)

Вариант Б (профессионально):
- Используешь **DbUp** или **Evolve** — они умеют прогонять SQL-скрипты по версии
- Хранишь папку /Migrations/Versioned/*.sql
- При создании тенанта — запускаешь апгрейд до последней версии

### Как продавать и распространять

Ты делаешь один сайт → tvoysoft.ru  
Клиент заходит → регистрируется → выбирает субдомен (например crm-psk)  
Система автоматически:
1. создаёт базу crm_psk_db
2. прогоняет миграции
3. выдаёт ему ссылку crm-psk.tvoysoft.ru

Готово. У тебя в админке список всех клиентов, можешь отключать, смотреть статистику, биллинг и т.д.

### Итоговая схема, которую используют все серьёзные SaaS на .NET

- ASP.NET Core 8
- EF Core + отдельная база на тенанта (или Finbuckle.MultiTenant)
- Определение тенанта по субдомену
- Мастер-база с тенантами и пользователями (AspNet Identity + TenantId)
- Автоматическое создание базы + миграции при регистрации клиента

Если сделаешь именно так — получишь продукт, который можно продавать от 990 руб/мес до 15 000 руб/мес за клиента без стыда.

Отлично! Давай пошагово, с объяснениями, кодом и схемами реализуем **SaaS-систему учёта заказов с изоляцией данных по клиентам**, по **первому варианту** — то есть **"одна мастер-база и отдельная база на каждого клиента"**.

---

# 🏗️ Общая идея проекта

- Один сервер (или кластер)
- ASP.NET Core приложение (единое)
- Одна **мастер-база** (где хранятся данные всех клиентов — список компаний, авторизация и биллинг)
- У каждого клиента — **своя база заказов**
- Каждое подключение клиента происходит по своему **субдомену**  
  Примеры:  
  - `client1.mysaas.ru`  
  - `client2.mysaas.ru`

---

### 📌 Используемые технологии:

- ASP.NET Core 8 (или 7)
- Entity Framework Core
- SQL Server (или PostgreSQL)
- Middleware для определения клиента по субдомену
- DI и Scoped DbContext’ы для подключения к базам клиентов
- Стартовый UI — Razor Pages или MVC (Vue/React — на твой выбор)

---

# 🧭 Структура проекта

```plaintext
MySaaS/*
│
├─ Controllers/
│
├─ Data/
│   ├── MasterDbContext.cs   // Мастер база
│   └── TenantDbContext.cs   // Контекст базы заказов клиента
│
├─ Middleware/
│   └── TenantResolutionMiddleware.cs
│
├─ Models/
│   ├── Tenant.cs
│   ├── Order.cs
│   └── OtherClientEntities.cs
│
├─ Services/
│   └── TenantService.cs
│
├─ Program.cs
└─ appsettings.json
```

---

# 🧩 Шаг 1: База данных и сущности

## 📂 MasterDbContext (мастер-база)

`Модель Tenant.cs`

```csharp
public class Tenant
{
    public Guid Id { get; set; }
    public string CompanyName { get; set; }
    public string Subdomain { get; set; }
    public string ConnectionString { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

`MasterDbContext.cs`

```csharp
public class MasterDbContext : DbContext
{
    public MasterDbContext(DbContextOptions<MasterDbContext> options)
        : base(options)
    {
    }

    public DbSet<Tenant> Tenants { get; set; }
}
```

`appsettings.json`

```json
{
  "ConnectionStrings": {
    "MasterDb": "Server=.;Database=MasterSaaS;Trusted_Connection=True;"
  }
}
```

`Program.cs`

```csharp
builder.Services.AddDbContext<MasterDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("MasterDb")));
```

---

## 📂 TenantDbContext (для базы заказов клиента)

`Order.cs`

```csharp
public class Order
{
    public int Id { get; set; }
    public string Description { get; set; }
    public decimal Amount { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

`TenantDbContext.cs`

```csharp
public class TenantDbContext : DbContext
{
    private readonly string _connectionString;

    public TenantDbContext(string connectionString)
    {
        _connectionString = connectionString;
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseSqlServer(_connectionString);
    }

    public DbSet<Order> Orders { get; set; }
}
```

---

# 🧩 Шаг 2: Middleware для определения клиента по субдомену

```csharp
public class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, MasterDbContext masterDb)
    {
        var host = context.Request.Host.Host;

        string subdomain = host.Split('.')[0];

        var tenant = await masterDb.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == subdomain && t.IsActive);

        if (tenant == null)
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsync("Tenant not found.");
            return;
        }

        // Храним объект Tenanta в контексте запроса
        context.Items["Tenant"] = tenant;

        await _next(context);
    }
}
```

🧩 `Program.cs` — подключение middleware

```csharp
app.UseMiddleware<TenantResolutionMiddleware>();
```

---

# 🧩 Шаг 3: TenantService — получение текущего тенанта из запроса

```csharp
public interface ITenantService
{
    Tenant GetTenant();
}

public class TenantService : ITenantService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantService(IHttpContextAccessor accessor)
    {
        _httpContextAccessor = accessor;
    }

    public Tenant GetTenant()
    {
        return _httpContextAccessor.HttpContext?.Items["Tenant"] as Tenant;
    }
}
```

`Program.cs`

```csharp
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, TenantService>();
```

---

# 🧩 Шаг 4: Внедрение TenantDbContext по нужному connection string

```csharp
builder.Services.AddScoped<TenantDbContext>(provider =>
{
    var tenantService = provider.GetRequiredService<ITenantService>();
    var tenant = tenantService.GetTenant();

    if (tenant == null)
        throw new Exception("Tenant not resolved");

    return new TenantDbContext(tenant.ConnectionString);
});
```

---

# 🧩 Шаг 5: Регистрация клиента и создание базы

Теперь делаем сервис и контроллер для регистрации клиента:

```csharp
public class TenantManagementService
{
    private readonly MasterDbContext _masterDb;

    public TenantManagementService(MasterDbContext masterDb)
    {
        _masterDb = masterDb;
    }

    public async Task<Tenant> RegisterTenantAsync(string companyName, string subdomain)
    {
        var newDbName = $"saas_{subdomain}_db";
        var connectionString = $"Server=.;Database={newDbName};Trusted_Connection=True;";

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            CompanyName = companyName,
            Subdomain = subdomain,
            ConnectionString = connectionString,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _masterDb.Tenants.Add(tenant);
        await _masterDb.SaveChangesAsync();

        // Создание базы и применение миграций
        await CreateTenantDatabase(connectionString);

        return tenant;
    }

    private async Task CreateTenantDatabase(string connectionString)
    {
        var builder = new DbContextOptionsBuilder<TenantDbContext>();
        builder.UseSqlServer(connectionString);

        using var context = new TenantDbContext(connectionString);

        await context.Database.MigrateAsync();
    }
}
```

`Program.cs`

```csharp
services.AddScoped<TenantManagementService>();
```

---

# 📜 API для регистрации клиента

```csharp
[ApiController]
[Route("api/[controller]")]
public class OnboardingController : ControllerBase
{
    private readonly TenantManagementService _service;

    public OnboardingController(TenantManagementService service)
    {
        _service = service;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(string companyName, string subdomain)
    {
        var tenant = await _service.RegisterTenantAsync(companyName, subdomain);
        return Ok(new { url = $"https://{tenant.Subdomain}.mysaas.ru" });
    }
}
```

---

# 🗃️ Шаг 6: Пример использования TenantDbContext в контроллере

```csharp
[ApiController]
[Route("[controller]")]
public class OrdersController : ControllerBase
{
    private readonly TenantDbContext _context;

    public OrdersController(TenantDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetOrders()
    {
        var orders = await _context.Orders.ToListAsync();
        return Ok(orders);
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(Order order)
    {
        _context.Orders.Add(order);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOrders), new { id = order.Id }, order);
    }
}
```

---

# 🧭 СХЕМА ARCHITECTURE

```plaintext
Пользователь → https://client1.mysaas.com
             ↓
       ASP.NET Core Middleware → определяет tenant по subdomain → извлекает подключение
             ↓
         TenantDbContext → подключается к базе клиента
             ↓
            Заказы, действия и прочее идут по изолированной БД
-----------------------------------------------------------
             Мастер-база → хранит всех клиентов и их настройки
```

---

# 📦 Как развёртывать и продавать

- Хостишь приложение на `app.mysaas.com`
- Клиент приходит → регистрируется → ему сразу создаётся `clientX.mysaas.com` + база
- В браузере он работает в своей среде — другие клиенты его не касаются
- Ты можешь отслеживать статистику, биллинг, usage и т.д.

---

# 🎁 Твоё расширение проекта может включать

- Добавить авторизацию (AspNet Identity + TenantId)
- Добавить Stripe или ЮКассу для подписок
- Настроить автоматическое создание поддомена через DNS (например, Cloudflare API)
- Создать админ-панель для управления клиентами
- Добавить логику выставления счетов

---

# 🧵 Вывод

### ✅ Ты построишь SaaS систему:
- Где каждый клиент изолирован (безопасность на первом месте)
- Где в центре хранишь всех клиентов
- Масштабируемость в будущем (можешь перенести клиентов на отдельные сервера)

---

📌 Если хочешь, я могу:

- Подготовить **готовый GitHub репозиторий** с этим кодом (под Razor Pages или React)
- Нарисовать UML-схемы модели
- Помочь развернуть на VPS (Linux + Nginx + Kestrel + DNS)

# Полное руководство по созданию Multi-Tenant SaaS системы учета заказов на ASP.NET Core

## 📋 Содержание
1. [Архитектура и схемы](#архитектура)
2. [Настройка проекта](#настройка-проекта)
3. [Создание мастер-базы](#мастер-база)
4. [Создание базы клиентов](#база-клиентов)
5. [Middleware для определения тенанта](#middleware)
6. [Сервисы работы с тенантами](#сервисы)
7. [Регистрация нового клиента](#регистрация)
8. [Контроллеры и UI](#контроллеры)
9. [Развертывание](#развертывание)

---

## 🏗️ Архитектура и схемы {#архитектура}

### Общая схема архитектуры

```
┌─────────────────────────────────────────────────────────────────┐
│                         ТВОЙ СЕРВЕР                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         ASP.NET Core Application (ОДНО на всех)            │ │
│  │                                                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │  Middleware  │  │   Services   │  │   Controllers   │  │ │
│  │  │   Tenant     │→ │   Tenant     │→ │   Orders/API    │  │ │
│  │  │  Resolution  │  │   DbContext  │  │                 │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    БАЗЫ ДАННЫХ                             │ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  MASTER DATABASE (центральная)                      │  │ │
│  │  │  ┌──────────┬──────────┬────────────┬─────────────┐ │  │ │
│  │  │  │ Tenants  │  Users   │  Billing   │Subscription │ │  │ │
│  │  │  └──────────┴──────────┴────────────┴─────────────┘ │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │ Client1_DB   │  │ Client2_DB   │  │ Client3_DB   │    │ │
│  │  │              │  │              │  │              │    │ │
│  │  │ - Orders     │  │ - Orders     │  │ - Orders     │    │ │
│  │  │ - Customers  │  │ - Customers  │  │ - Customers  │    │ │
│  │  │ - Products   │  │ - Products   │  │ - Products   │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

        ↑                    ↑                    ↑
        │                    │                    │
   client1.yourapp.ru   client2.yourapp.ru   client3.yourapp.ru
```

### Схема потока запроса

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Запрос от пользователя                                       │
│    URL: client1.yourapp.ru/orders                               │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. TenantResolutionMiddleware                                   │
│    - Парсит subdomain: "client1"                                │
│    - Запрашивает из Master DB запись Tenant                     │
│    - Получает ConnectionString для базы client1                 │
│    - Сохраняет в HttpContext.Items["Tenant"]                    │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. TenantService                                                │
│    - Получает Tenant из HttpContext                             │
│    - Предоставляет CurrentTenant для DI                         │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. TenantDbContext (Scoped)                                     │
│    - При создании получает ConnectionString от CurrentTenant    │
│    - Подключается к базе client1_db                             │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. OrdersController                                             │
│    - Инжектит TenantDbContext                                   │
│    - Работает с Orders из базы client1_db                       │
│    - Возвращает данные только этого клиента                     │
└─────────────────────────────────────────────────────────────────┘
```

### Схема базы данных

```
┌────────────────────────────────────────────────────────────────┐
│                        MASTER DATABASE                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tenants                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Id (PK)              │ int                               │  │
│  │ CompanyName          │ nvarchar(200)                     │  │
│  │ Subdomain            │ nvarchar(50) UNIQUE               │  │
│  │ ConnectionString     │ nvarchar(500)                     │  │
│  │ Plan                 │ nvarchar(50) (Starter/Pro/Ent)    │  │
│  │ IsActive             │ bit                               │  │
│  │ MaxUsers             │ int                               │  │
│  │ MaxOrders            │ int                               │  │
│  │ CreatedAt            │ datetime2                         │  │
│  │ ExpiresAt            │ datetime2                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Users (AspNetUsers расширенная)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Id (PK)              │ nvarchar(450)                     │  │
│  │ TenantId (FK)        │ int → Tenants.Id                  │  │
│  │ Email                │ nvarchar(256)                     │  │
│  │ PasswordHash         │ nvarchar(max)                     │  │
│  │ Role                 │ nvarchar(50) (Admin/Manager/User) │  │
│  │ ... (стандартные Identity поля)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Subscriptions                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Id (PK)              │ int                               │  │
│  │ TenantId (FK)        │ int → Tenants.Id                  │  │
│  │ StartDate            │ datetime2                         │  │
│  │ EndDate              │ datetime2                         │  │
│  │ Amount               │ decimal(18,2)                     │  │
│  │ Status               │ nvarchar(20) (Active/Expired)     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                   CLIENT DATABASE (каждая)                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Orders                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Id (PK)              │ int                               │  │
│  │ OrderNumber          │ nvarchar(50)                      │  │
│  │ CustomerId (FK)      │ int → Customers.Id                │  │
│  │ OrderDate            │ datetime2                         │  │
│  │ TotalAmount          │ decimal(18,2)                     │  │
│  │ Status               │ nvarchar(50)                      │  │
│  │ CreatedBy            │ nvarchar(450) (UserId)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  OrderItems                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Id (PK)              │ int                               │  │
│  │ OrderId (FK)         │ int → Orders.Id                   │  │
│  │ ProductId (FK)       │ int → Products.Id                 │  │
│  │ Quantity             │ int                               │  │
│  │ Price                │ decimal(18,2)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Customers                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Id (PK)              │ int                               │  │
│  │ Name                 │ nvarchar(200)                     │  │
│  │ Email                │ nvarchar(100)                     │  │
│  │ Phone                │ nvarchar(20)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Products                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Id (PK)              │ int                               │  │
│  │ Name                 │ nvarchar(200)                     │  │
│  │ Price                │ decimal(18,2)                     │  │
│  │ Stock                │ int                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Настройка проекта {#настройка-проекта}

### Шаг 1: Создание решения

```bash
# Создаем папку проекта
mkdir OrderManagementSaaS
cd OrderManagementSaaS

# Создаем solution
dotnet new sln -n OrderManagementSaaS

# Создаем основной веб-проект
dotnet new mvc -n OrderManagement.Web
dotnet sln add OrderManagement.Web

# Создаем библиотеку для общих моделей и контекстов
dotnet new classlib -n OrderManagement.Core
dotnet sln add OrderManagement.Core

# Добавляем ссылку
cd OrderManagement.Web
dotnet add reference ../OrderManagement.Core
cd ..
```

### Шаг 2: Установка NuGet пакетов

```bash
cd OrderManagement.Core

# Entity Framework
dotnet add package Microsoft.EntityFrameworkCore
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Tools

cd ../OrderManagement.Web

# EF для веб-проекта
dotnet add package Microsoft.EntityFrameworkCore
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Tools

# Identity для аутентификации
dotnet add package Microsoft.AspNetCore.Identity.EntityFrameworkCore

# Для работы с конфигурацией
dotnet add package Microsoft.Extensions.Configuration
```

### Структура проекта

```
OrderManagementSaaS/
├── OrderManagement.Core/          # Общая библиотека
│   ├── Entities/
│   │   ├── Master/                # Сущности мастер-базы
│   │   │   ├── Tenant.cs
│   │   │   ├── ApplicationUser.cs
│   │   │   └── Subscription.cs
│   │   └── Tenant/                # Сущности баз клиентов
│   │       ├── Order.cs
│   │       ├── OrderItem.cs
│   │       ├── Customer.cs
│   │       └── Product.cs
│   ├── Data/
│   │   ├── MasterDbContext.cs
│   │   └── TenantDbContext.cs
│   └── Interfaces/
│       ├── ITenantService.cs
│       └── ITenantProvider.cs
│
└── OrderManagement.Web/           # Веб-приложение
    ├── Controllers/
    │   ├── AccountController.cs
    │   ├── AdminController.cs
    │   └── OrdersController.cs
    ├── Middleware/
    │   └── TenantResolutionMiddleware.cs
    ├── Services/
    │   ├── TenantService.cs
    │   └── TenantProvisioningService.cs
    ├── Views/
    ├── wwwroot/
    ├── appsettings.json
    └── Program.cs
```

---

## 💾 Создание мастер-базы {#мастер-база}

### Шаг 3: Модели для мастер-базы

**OrderManagement.Core/Entities/Master/Tenant.cs**

```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrderManagement.Core.Entities.Master
{
    /// <summary>
    /// Представляет клиента (тенанта) системы
    /// </summary>
    public class Tenant
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Название компании клиента
        /// </summary>
        [Required]
        [MaxLength(200)]
        public string CompanyName { get; set; }

        /// <summary>
        /// Субдомен для доступа (например: client1 → client1.yourapp.ru)
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Subdomain { get; set; }

        /// <summary>
        /// Строка подключения к базе данных клиента
        /// </summary>
        [Required]
        [MaxLength(500)]
        public string ConnectionString { get; set; }

        /// <summary>
        /// Тарифный план (Starter, Professional, Enterprise)
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Plan { get; set; } = "Starter";

        /// <summary>
        /// Активен ли тенант
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Максимальное количество пользователей по тарифу
        /// </summary>
        public int MaxUsers { get; set; } = 5;

        /// <summary>
        /// Максимальное количество заказов в месяц
        /// </summary>
        public int MaxOrders { get; set; } = 100;

        /// <summary>
        /// Дата создания
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Дата истечения подписки
        /// </summary>
        public DateTime? ExpiresAt { get; set; }

        /// <summary>
        /// Контактный email администратора
        /// </summary>
        [MaxLength(100)]
        public string AdminEmail { get; set; }

        /// <summary>
        /// Навигационное свойство для пользователей
        /// </summary>
        public virtual ICollection<ApplicationUser> Users { get; set; }

        /// <summary>
        /// Навигационное свойство для подписок
        /// </summary>
        public virtual ICollection<Subscription> Subscriptions { get; set; }
    }
}
```

**OrderManagement.Core/Entities/Master/ApplicationUser.cs**

```csharp
using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace OrderManagement.Core.Entities.Master
{
    /// <summary>
    /// Расширенный пользователь с привязкой к тенанту
    /// </summary>
    public class ApplicationUser : IdentityUser
    {
        /// <summary>
        /// ID тенанта, к которому принадлежит пользователь
        /// </summary>
        [Required]
        public int TenantId { get; set; }

        /// <summary>
        /// Полное имя пользователя
        /// </summary>
        [MaxLength(100)]
        public string FullName { get; set; }

        /// <summary>
        /// Роль в рамках тенанта (Admin, Manager, User)
        /// </summary>
        [MaxLength(50)]
        public string TenantRole { get; set; } = "User";

        /// <summary>
        /// Дата создания
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Навигационное свойство к тенанту
        /// </summary>
        public virtual Tenant Tenant { get; set; }
    }
}
```

**OrderManagement.Core/Entities/Master/Subscription.cs**

```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrderManagement.Core.Entities.Master
{
    /// <summary>
    /// Подписка клиента
    /// </summary>
    public class Subscription
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int TenantId { get; set; }

        public DateTime StartDate { get; set; }

        public DateTime EndDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        /// <summary>
        /// Статус: Active, Expired, Cancelled
        /// </summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        public virtual Tenant Tenant { get; set; }
    }
}
```

### Шаг 4: Контекст мастер-базы

**OrderManagement.Core/Data/MasterDbContext.cs**

```csharp
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OrderManagement.Core.Entities.Master;

namespace OrderManagement.Core.Data
{
    /// <summary>
    /// Контекст мастер-базы данных (центральная база с тенантами и пользователями)
    /// </summary>
    public class MasterDbContext : IdentityDbContext<ApplicationUser>
    {
        public MasterDbContext(DbContextOptions<MasterDbContext> options)
            : base(options)
        {
        }

        public DbSet<Tenant> Tenants { get; set; }
        public DbSet<Subscription> Subscriptions { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Конфигурация Tenant
            builder.Entity<Tenant>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                // Subdomain должен быть уникальным
                entity.HasIndex(e => e.Subdomain)
                      .IsUnique();

                // Один тенант - много пользователей
                entity.HasMany(e => e.Users)
                      .WithOne(e => e.Tenant)
                      .HasForeignKey(e => e.TenantId)
                      .OnDelete(DeleteBehavior.Restrict); // Защита от случайного удаления

                // Один тенант - много подписок
                entity.HasMany(e => e.Subscriptions)
                      .WithOne(e => e.Tenant)
                      .HasForeignKey(e => e.TenantId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Конфигурация ApplicationUser
            builder.Entity<ApplicationUser>(entity =>
            {
                entity.Property(e => e.TenantId).IsRequired();
                entity.HasIndex(e => new { e.TenantId, e.Email });
            });

            // Сид данных для первого супер-админа (опционально)
            // Можно создать тенант "admin" для администрирования всей системы
        }
    }
}
```

### Шаг 5: Миграция мастер-базы

**appsettings.json** (в OrderManagement.Web)

```json
{
  "ConnectionStrings": {
    "MasterDatabase": "Server=localhost;Database=OrderManagement_Master;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

Выполняем миграцию:

```bash
cd OrderManagement.Web

# Создаем миграцию
dotnet ef migrations add InitialMaster --context MasterDbContext --project ../OrderManagement.Core --startup-project .

# Применяем миграцию
dotnet ef database update --context MasterDbContext --project ../OrderManagement.Core --startup-project .
```

**Важно**: Если возникает ошибка, убедитесь что в Program.cs прописана регистрация MasterDbContext (см. следующий раздел).

---

## 🏢 Создание базы клиентов {#база-клиентов}

### Шаг 6: Модели для баз клиентов

**OrderManagement.Core/Entities/Tenant/Customer.cs**

```csharp
using System.ComponentModel.DataAnnotations;

namespace OrderManagement.Core.Entities.Tenant
{
    public class Customer
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; }

        [MaxLength(100)]
        [EmailAddress]
        public string Email { get; set; }

        [MaxLength(20)]
        public string Phone { get; set; }

        [MaxLength(500)]
        public string Address { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Навигационное свойство
        public virtual ICollection<Order> Orders { get; set; }
    }
}
```

**OrderManagement.Core/Entities/Tenant/Product.cs**

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrderManagement.Core.Entities.Tenant
{
    public class Product
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; }

        [MaxLength(1000)]
        public string Description { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; }

        public int Stock { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Навигационное свойство
        public virtual ICollection<OrderItem> OrderItems { get; set; }
    }
}
```

**OrderManagement.Core/Entities/Tenant/Order.cs**

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrderManagement.Core.Entities.Tenant
{
    public class Order
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string OrderNumber { get; set; }

        [Required]
        public int CustomerId { get; set; }

        public DateTime OrderDate { get; set; } = DateTime.UtcNow;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        /// <summary>
        /// Статус: New, Processing, Completed, Cancelled
        /// </summary>
        [MaxLength(50)]
        public string Status { get; set; } = "New";

        /// <summary>
        /// ID пользователя, создавшего заказ (из Master DB)
        /// </summary>
        [MaxLength(450)]
        public string CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Навигационные свойства
        public virtual Customer Customer { get; set; }
        public virtual ICollection<OrderItem> OrderItems { get; set; }
    }
}
```

**OrderManagement.Core/Entities/Tenant/OrderItem.cs**

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrderManagement.Core.Entities.Tenant
{
    public class OrderItem
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int OrderId { get; set; }

        [Required]
        public int ProductId { get; set; }

        public int Quantity { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Subtotal => Quantity * Price;

        // Навигационные свойства
        public virtual Order Order { get; set; }
        public virtual Product Product { get; set; }
    }
}
```

### Шаг 7: Контекст базы клиента

**OrderManagement.Core/Data/TenantDbContext.cs**

```csharp
using Microsoft.EntityFrameworkCore;
using OrderManagement.Core.Entities.Tenant;

namespace OrderManagement.Core.Data
{
    /// <summary>
    /// Контекст базы данных клиента (создается отдельная БД для каждого тенанта)
    /// </summary>
    public class TenantDbContext : DbContext
    {
        private readonly string _connectionString;

        // Конструктор для создания через фабрику с динамическим connection string
        public TenantDbContext(string connectionString)
        {
            _connectionString = connectionString;
        }

        // Конструктор для EF Tools (миграции)
        public TenantDbContext(DbContextOptions<TenantDbContext> options)
            : base(options)
        {
        }

        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<Customer> Customers { get; set; }
        public DbSet<Product> Products { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured && !string.IsNullOrEmpty(_connectionString))
            {
                optionsBuilder.UseSqlServer(_connectionString);
            }
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Конфигурация Order
            builder.Entity<Order>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                entity.HasIndex(e => e.OrderNumber).IsUnique();

                entity.HasOne(e => e.Customer)
                      .WithMany(e => e.Orders)
                      .HasForeignKey(e => e.CustomerId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasMany(e => e.OrderItems)
                      .WithOne(e => e.Order)
                      .HasForeignKey(e => e.OrderId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // Конфигурация OrderItem
            builder.Entity<OrderItem>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.HasOne(e => e.Product)
                      .WithMany(e => e.OrderItems)
                      .HasForeignKey(e => e.ProductId)
                      .OnDelete(DeleteBehavior.Restrict);

                // Вычисляемое свойство Subtotal не сохраняется в БД
                entity.Ignore(e => e.Subtotal);
            });

            // Индексы для производительности
            builder.Entity<Customer>(entity =>
            {
                entity.HasIndex(e => e.Email);
            });

            builder.Entity<Product>(entity =>
            {
                entity.HasIndex(e => e.Name);
            });
        }
    }
}
```

### Шаг 8: Создание шаблонной миграции для клиентов

```bash
cd OrderManagement.Web

# Создаем миграцию для структуры базы клиента
# Используем временный connection string
dotnet ef migrations add InitialTenant --context TenantDbContext --project ../OrderManagement.Core --startup-project . --output-dir Data/Migrations/Tenant
```

**Важно**: Эта миграция будет применяться при создании каждого нового клиента автоматически.

---

## 🔌 Middleware для определения тенанта {#middleware}

### Шаг 9: Интерфейсы

**OrderManagement.Core/Interfaces/ITenantProvider.cs**

```csharp
using OrderManagement.Core.Entities.Master;

namespace OrderManagement.Core.Interfaces
{
    /// <summary>
    /// Интерфейс для получения текущего тенанта
    /// </summary>
    public interface ITenantProvider
    {
        /// <summary>
        /// Текущий тенант (определяется из HTTP контекста)
        /// </summary>
        Tenant CurrentTenant { get; }

        /// <summary>
        /// ID текущего тенанта
        /// </summary>
        int? CurrentTenantId { get; }
    }
}
```

**OrderManagement.Core/Interfaces/ITenantService.cs**

```csharp
using OrderManagement.Core.Entities.Master;

namespace OrderManagement.Core.Interfaces
{
    /// <summary>
    /// Сервис для работы с тенантами
    /// </summary>
    public interface ITenantService
    {
        /// <summary>
        /// Получить тенанта по субдомену
        /// </summary>
        Task<Tenant> GetTenantBySubdomainAsync(string subdomain);

        /// <summary>
        /// Получить тенанта по ID
        /// </summary>
        Task<Tenant> GetTenantByIdAsync(int tenantId);

        /// <summary>
        /// Создать нового тенанта (с базой данных)
        /// </summary>
        Task<Tenant> CreateTenantAsync(string companyName, string subdomain, string adminEmail, string plan);

        /// <summary>
        /// Проверить доступность субдомена
        /// </summary>
        Task<bool> IsSubdomainAvailableAsync(string subdomain);
    }
}
```

### Шаг 10: Реализация TenantProvider

**OrderManagement.Web/Services/TenantProvider.cs**

```csharp
using OrderManagement.Core.Entities.Master;
using OrderManagement.Core.Interfaces;

namespace OrderManagement.Web.Services
{
    /// <summary>
    /// Провайдер текущего тенанта из HTTP контекста
    /// </summary>
    public class TenantProvider : ITenantProvider
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public TenantProvider(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public Tenant CurrentTenant
        {
            get
            {
                var httpContext = _httpContextAccessor.HttpContext;
                if (httpContext == null)
                    return null;

                // Получаем тенанта, который был установлен в Middleware
                if (httpContext.Items.TryGetValue("Tenant", out var tenant))
                {
                    return tenant as Tenant;
                }

                return null;
            }
        }

        public int? CurrentTenantId => CurrentTenant?.Id;
    }
}
```

### Шаг 11: Middleware для определения тенанта

**OrderManagement.Web/Middleware/TenantResolutionMiddleware.cs**

```csharp
using OrderManagement.Core.Interfaces;
using System.Text.RegularExpressions;

namespace OrderManagement.Web.Middleware
{
    /// <summary>
    /// Middleware для определения текущего тенанта по субдомену
    /// Это ключевой компонент всей multi-tenant архитектуры
    /// </summary>
    public class TenantResolutionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<TenantResolutionMiddleware> _logger;

        // Список субдоменов, которые НЕ являются тенантами
        private readonly string[] _excludedSubdomains = { "www", "admin", "api", "cdn", "static" };

        public TenantResolutionMiddleware(
            RequestDelegate next,
            ILogger<TenantResolutionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, ITenantService tenantService)
        {
            var host = context.Request.Host.Host.ToLower();

            _logger.LogInformation($"Обработка запроса от хоста: {host}");

            // Удаляем www если есть
            if (host.StartsWith("www."))
            {
                host = host.Substring(4);
            }

            // Парсим субдомен
            var subdomain = ExtractSubdomain(host);

            // Если это основной домен или исключенный субдомен - пропускаем
            if (string.IsNullOrEmpty(subdomain) || _excludedSubdomains.Contains(subdomain))
            {
                _logger.LogInformation($"Субдомен '{subdomain}' исключен или отсутствует - пропускаем определение тенанта");
                context.Items["TenantId"] = null;
                context.Items["Tenant"] = null;
                await _next(context);
                return;
            }

            // Получаем тенанта из базы
            var tenant = await tenantService.GetTenantBySubdomainAsync(subdomain);

            if (tenant == null)
            {
                _logger.LogWarning($"Тенант с субдоменом '{subdomain}' не найден");
                context.Response.StatusCode = 404;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Tenant not found",
                    message = $"Клиент с адресом '{subdomain}' не найден в системе. Проверьте правильность адреса."
                });
                return;
            }

            // Проверяем активность
            if (!tenant.IsActive)
            {
                _logger.LogWarning($"Тенант '{subdomain}' (ID: {tenant.Id}) неактивен");
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Tenant inactive",
                    message = "Ваша подписка истекла или аккаунт заблокирован. Свяжитесь с поддержкой."
                });
                return;
            }

            // Проверяем срок действия подписки
            if (tenant.ExpiresAt.HasValue && tenant.ExpiresAt.Value < DateTime.UtcNow)
            {
                _logger.LogWarning($"Подписка тенанта '{subdomain}' истекла");
                context.Response.StatusCode = 402; // Payment Required
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "Subscription expired",
                    message = "Срок действия вашей подписки истек. Пожалуйста, продлите подписку."
                });
                return;
            }

            // Сохраняем тенанта в контекст запроса
            context.Items["TenantId"] = tenant.Id;
            context.Items["Tenant"] = tenant;

            _logger.LogInformation($"Тенант успешно определен: {tenant.CompanyName} (ID: {tenant.Id})");

            await _next(context);
        }

        /// <summary>
        /// Извлекает субдомен из хоста
        /// Примеры:
        /// - client1.yourapp.ru → client1
        /// - localhost → null
        /// - yourapp.ru → null
        /// </summary>
        private string ExtractSubdomain(string host)
        {
            // Для localhost возвращаем null (для разработки можно добавить специальную логику)
            if (host == "localhost" || host.StartsWith("localhost:"))
            {
                return null;
            }

            // Разбиваем хост на части
            var parts = host.Split('.');

            // Если меньше 3 частей (например yourapp.ru) - это основной домен
            if (parts.Length < 3)
            {
                return null;
            }

            // Возвращаем первую часть как субдомен
            return parts[0];
        }
    }

    /// <summary>
    /// Extension метод для регистрации middleware
    /// </summary>
    public static class TenantResolutionMiddlewareExtensions
    {
        public static IApplicationBuilder UseTenantResolution(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<TenantResolutionMiddleware>();
        }
    }
}
```

---

## 🛠️ Сервисы работы с тенантами {#сервисы}

### Шаг 12: Реализация TenantService

**OrderManagement.Web/Services/TenantService.cs**

```csharp
using Microsoft.EntityFrameworkCore;
using OrderManagement.Core.Data;
using OrderManagement.Core.Entities.Master;
using OrderManagement.Core.Interfaces;
using System.Data.SqlClient;
using System.Text.RegularExpressions;

namespace OrderManagement.Web.Services
{
    public class TenantService : ITenantService
    {
        private readonly MasterDbContext _masterDb;
        private readonly IConfiguration _configuration;
        private readonly ILogger<TenantService> _logger;

        public TenantService(
            MasterDbContext masterDb,
            IConfiguration configuration,
            ILogger<TenantService> logger)
        {
            _masterDb = masterDb;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<Tenant> GetTenantBySubdomainAsync(string subdomain)
        {
            return await _masterDb.Tenants
                .FirstOrDefaultAsync(t => t.Subdomain == subdomain.ToLower());
        }

        public async Task<Tenant> GetTenantByIdAsync(int tenantId)
        {
            return await _masterDb.Tenants.FindAsync(tenantId);
        }

        public async Task<bool> IsSubdomainAvailableAsync(string subdomain)
        {
            // Проверяем формат (только буквы, цифры и дефис)
            if (!Regex.IsMatch(subdomain, @"^[a-z0-9-]+$"))
            {
                return false;
            }

            // Проверяем зарезервированные слова
            var reserved = new[] { "www", "admin", "api", "app", "mail", "ftp", "cdn", "static", "assets" };
            if (reserved.Contains(subdomain.ToLower()))
            {
                return false;
            }

            // Проверяем уникальность
            return !await _masterDb.Tenants.AnyAsync(t => t.Subdomain == subdomain.ToLower());
        }

        public async Task<Tenant> CreateTenantAsync(
            string companyName,
            string subdomain,
            string adminEmail,
            string plan)
        {
            subdomain = subdomain.ToLower().Trim();

            // Валидация
            if (!await IsSubdomainAvailableAsync(subdomain))
            {
                throw new InvalidOperationException($"Субдомен '{subdomain}' уже занят или недопустим");
            }

            _logger.LogInformation($"Начало создания тенанта: {companyName} ({subdomain})");

            // 1. Создаем запись в мастер-базе
            var tenant = new Tenant
            {
                CompanyName = companyName,
                Subdomain = subdomain,
                AdminEmail = adminEmail,
                Plan = plan,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMonths(1), // Первый месяц бесплатно
                MaxUsers = plan switch
                {
                    "Starter" => 5,
                    "Professional" => 20,
                    "Enterprise" => 100,
                    _ => 5
                },
                MaxOrders = plan switch
                {
                    "Starter" => 100,
                    "Professional" => 1000,
                    "Enterprise" => int.MaxValue,
                    _ => 100
                }
            };

            _masterDb.Tenants.Add(tenant);
            await _masterDb.SaveChangesAsync();

            _logger.LogInformation($"Тенант создан в мастер-базе с ID: {tenant.Id}");

            try
            {
                // 2. Создаем физическую базу данных
                var databaseName = $"OrderManagement_Tenant_{tenant.Id}";
                await CreateDatabaseAsync(databaseName);

                _logger.LogInformation($"База данных '{databaseName}' создана");

                // 3. Формируем connection string
                var masterConnectionString = _configuration.GetConnectionString("MasterDatabase");
                var tenantConnectionString = BuildTenantConnectionString(masterConnectionString, databaseName);

                tenant.ConnectionString = tenantConnectionString;
                await _masterDb.SaveChangesAsync();

                // 4. Применяем миграции к новой базе
                await ApplyMigrationsToTenantDatabaseAsync(tenantConnectionString);

                _logger.LogInformation($"Миграции применены к базе '{databaseName}'");

                // 5. Создаем начальные данные (опционально)
                await SeedTenantDatabaseAsync(tenantConnectionString);

                _logger.LogInformation($"Тенант '{companyName}' успешно создан и готов к работе");

                return tenant;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка при создании тенанта: {ex.Message}");

                // Откатываем создание тенанта в мастер-базе
                _masterDb.Tenants.Remove(tenant);
                await _masterDb.SaveChangesAsync();

                throw new InvalidOperationException($"Не удалось создать тенанта: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Создает физическую базу данных
        /// </summary>
        private async Task CreateDatabaseAsync(string databaseName)
        {
            var masterConnectionString = _configuration.GetConnectionString("MasterDatabase");
            var builder = new SqlConnectionStringBuilder(masterConnectionString)
            {
                InitialCatalog = "master" // Подключаемся к master для создания БД
            };

            using var connection = new SqlConnection(builder.ConnectionString);
            await connection.OpenAsync();

            // Проверяем существование базы
            using var checkCmd = connection.CreateCommand();
            checkCmd.CommandText = $"SELECT database_id FROM sys.databases WHERE Name = '{databaseName}'";
            var exists = await checkCmd.ExecuteScalarAsync();

            if (exists != null)
            {
                _logger.LogWarning($"База данных '{databaseName}' уже существует");
                return;
            }

            // Создаем базу
            using var createCmd = connection.CreateCommand();
            createCmd.CommandText = $@"
                CREATE DATABASE [{databaseName}]
                COLLATE SQL_Latin1_General_CP1_CI_AS";

            await createCmd.ExecuteNonQueryAsync();

            _logger.LogInformation($"База данных '{databaseName}' успешно создана");
        }

        /// <summary>
        /// Строит connection string для базы тенанта
        /// </summary>
        private string BuildTenantConnectionString(string masterConnectionString, string databaseName)
        {
            var builder = new SqlConnectionStringBuilder(masterConnectionString)
            {
                InitialCatalog = databaseName
            };

            return builder.ConnectionString;
        }

        /// <summary>
        /// Применяет миграции к базе тенанта
        /// </summary>
        private async Task ApplyMigrationsToTenantDatabaseAsync(string connectionString)
        {
            var optionsBuilder = new DbContextOptionsBuilder<TenantDbContext>();
            optionsBuilder.UseSqlServer(connectionString);

            using var context = new TenantDbContext(optionsBuilder.Options);
            
            // Применяем все pending миграции
            await context.Database.MigrateAsync();

            _logger.LogInformation("Миграции успешно применены");
        }

        /// <summary>
        /// Создает начальные данные в базе тенанта (опционально)
        /// </summary>
        private async Task SeedTenantDatabaseAsync(string connectionString)
        {
            var optionsBuilder = new DbContextOptionsBuilder<TenantDbContext>();
            optionsBuilder.UseSqlServer(connectionString);

            using var context = new TenantDbContext(optionsBuilder.Options);

            // Проверяем, нужно ли создавать seed данные
            if (await context.Products.AnyAsync())
            {
                return; // Данные уже есть
            }

            // Создаем примерные продукты
            var products = new[]
            {
                new Product { Name = "Продукт 1", Description = "Описание продукта 1", Price = 100, Stock = 50 },
                new Product { Name = "Продукт 2", Description = "Описание продукта 2", Price = 200, Stock = 30 },
                new Product { Name = "Продукт 3", Description = "Описание продукта 3", Price = 150, Stock = 40 }
            };

            context.Products.AddRange(products);

            // Создаем примерного клиента
            var customer = new Customer
            {
                Name = "Тестовый клиент",
                Email = "test@example.com",
                Phone = "+7 (999) 123-45-67"
            };

            context.Customers.Add(customer);

            await context.SaveChangesAsync();

            _logger.LogInformation("Seed данные созданы");
        }
    }
}
```

---

## 📝 Регистрация нового клиента {#регистрация}

### Шаг 13: Модель регистрации

**OrderManagement.Web/Models/RegisterTenantViewModel.cs**

```csharp
using System.ComponentModel.DataAnnotations;

namespace OrderManagement.Web.Models
{
    public class RegisterTenantViewModel
    {
        [Required(ErrorMessage = "Укажите название компании")]
        [Display(Name = "Название компании")]
        [MaxLength(200)]
        public string CompanyName { get; set; }

        [Required(ErrorMessage = "Укажите желаемый субдомен")]
        [Display(Name = "Субдомен")]
        [RegularExpression(@"^[a-z0-9-]+$", ErrorMessage = "Только строчные буквы, цифры и дефис")]
        [MaxLength(50)]
        public string Subdomain { get; set; }

        [Required(ErrorMessage = "Укажите email администратора")]
        [EmailAddress(ErrorMessage = "Некорректный email")]
        [Display(Name = "Email администратора")]
        public string AdminEmail { get; set; }

        [Required(ErrorMessage = "Укажите пароль")]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "Пароль должен быть не менее 6 символов")]
        [DataType(DataType.Password)]
        [Display(Name = "Пароль")]
        public string Password { get; set; }

        [DataType(DataType.Password)]
        [Display(Name = "Подтверждение пароля")]
        [Compare("Password", ErrorMessage = "Пароли не совпадают")]
        public string ConfirmPassword { get; set; }

        [Required(ErrorMessage = "Выберите тарифный план")]
        [Display(Name = "Тарифный план")]
        public string Plan { get; set; } = "Starter";
    }
}
```

### Шаг 14: Контроллер регистрации

**OrderManagement.Web/Controllers/AccountController.cs**

```csharp
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OrderManagement.Core.Entities.Master;
using OrderManagement.Core.Interfaces;
using OrderManagement.Web.Models;

namespace OrderManagement.Web.Controllers
{
    public class AccountController : Controller
    {
        private readonly ITenantService _tenantService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly ILogger<AccountController> _logger;

        public AccountController(
            ITenantService tenantService,
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            ILogger<AccountController> logger)
        {
            _tenantService = tenantService;
            _userManager = userManager;
            _signInManager = signInManager;
            _logger = logger;
        }

        [HttpGet]
        public IActionResult Register()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register(RegisterTenantViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            try
            {
                // Проверяем доступность субдомена
                if (!await _tenantService.IsSubdomainAvailableAsync(model.Subdomain))
                {
                    ModelState.AddModelError("Subdomain", "Этот субдомен уже занят");
                    return View(model);
                }

                // Создаем тенанта (с базой данных)
                _logger.LogInformation($"Создание тенанта для компании: {model.CompanyName}");
                
                var tenant = await _tenantService.CreateTenantAsync(
                    model.CompanyName,
                    model.Subdomain,
                    model.AdminEmail,
                    model.Plan
                );

                // Создаем пользователя-администратора
                var user = new ApplicationUser
                {
                    UserName = model.AdminEmail,
                    Email = model.AdminEmail,
                    TenantId = tenant.Id,
                    FullName = "Администратор",
                    TenantRole = "Admin",
                    EmailConfirmed = true // Для упрощения, в продакшене нужно подтверждение
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (!result.Succeeded)
                {
                    foreach (var error in result.Errors)
                    {
                        ModelState.AddModelError(string.Empty, error.Description);
                    }
                    return View(model);
                }

                _logger.LogInformation($"Тенант успешно создан: {tenant.CompanyName}, субдомен: {tenant.Subdomain}");

                // Показываем страницу успеха с инструкциями
                ViewBag.Subdomain = tenant.Subdomain;
                ViewBag.Email = model.AdminEmail;
                
                return View("RegisterSuccess");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при регистрации тенанта");
                ModelState.AddModelError(string.Empty, $"Произошла ошибка: {ex.Message}");
                return View(model);
            }
        }

        [HttpGet]
        public IActionResult Login(string returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model, string returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;

            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var result = await _signInManager.PasswordSignInAsync(
                model.Email, 
                model.Password, 
                model.RememberMe, 
                lockoutOnFailure: false
            );

            if (result.Succeeded)
            {
                _logger.LogInformation($"Пользователь {model.Email} успешно вошел");
                return RedirectToLocal(returnUrl);
            }

            ModelState.AddModelError(string.Empty, "Неверный email или пароль");
            return View(model);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return RedirectToAction("Index", "Home");
        }

        private IActionResult RedirectToLocal(string returnUrl)
        {
            if (Url.IsLocalUrl(returnUrl))
            {
                return Redirect(returnUrl);
            }
            else
            {
                return RedirectToAction("Index", "Home");
            }
        }

        // AJAX проверка доступности субдомена
        [HttpGet]
        public async Task<IActionResult> CheckSubdomain(string subdomain)
        {
            if (string.IsNullOrWhiteSpace(subdomain))
            {
                return Json(new { available = false, message = "Субдомен не может быть пустым" });
            }

            var available = await _tenantService.IsSubdomainAvailableAsync(subdomain);
            
            return Json(new
            {
                available = available,
                message = available 
                    ? $"✓ Адрес {subdomain}.yourapp.ru доступен" 
                    : "✗ Этот субдомен уже занят"
            });
        }
    }

    // Модель для логина
    public class LoginViewModel
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; }

        [Required]
        [DataType(DataType.Password)]
        public string Password { get; set; }

        [Display(Name = "Запомнить меня")]
        public bool RememberMe { get; set; }
    }
}
```

---

## 🎮 Контроллеры и UI {#контроллеры}

### Шаг 15: Контроллер заказов

**OrderManagement.Web/Controllers/OrdersController.cs**

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrderManagement.Core.Data;
using OrderManagement.Core.Entities.Tenant;
using OrderManagement.Core.Interfaces;

namespace OrderManagement.Web.Controllers
{
    [Authorize] // Требуется аутентификация
    public class OrdersController : Controller
    {
        private readonly TenantDbContext _tenantDb;
        private readonly ITenantProvider _tenantProvider;
        private readonly ILogger<OrdersController> _logger;

        public OrdersController(
            TenantDbContext tenantDb,
            ITenantProvider tenantProvider,
            ILogger<OrdersController> logger)
        {
            _tenantDb = tenantDb;
            _tenantProvider = tenantProvider;
            _logger = logger;
        }

        // GET: Orders
        public async Task<IActionResult> Index()
        {
            var currentTenant = _tenantProvider.CurrentTenant;
            ViewBag.CompanyName = currentTenant?.CompanyName;

            var orders = await _tenantDb.Orders
                .Include(o => o.Customer)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .OrderByDescending(o => o.OrderDate)
                .ToListAsync();

            return View(orders);
        }

        // GET: Orders/Details/5
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var order = await _tenantDb.Orders
                .Include(o => o.Customer)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (order == null)
            {
                return NotFound();
            }

            return View(order);
        }

        // GET: Orders/Create
        public async Task<IActionResult> Create()
        {
            ViewBag.Customers = await _tenantDb.Customers.ToListAsync();
            ViewBag.Products = await _tenantDb.Products.Where(p => p.IsActive).ToListAsync();
            return View();
        }

        // POST: Orders/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(CreateOrderViewModel model)
        {
            if (!ModelState.IsValid)
            {
                ViewBag.Customers = await _tenantDb.Customers.ToListAsync();
                ViewBag.Products = await _tenantDb.Products.Where(p => p.IsActive).ToListAsync();
                return View(model);
            }

            try
            {
                var order = new Order
                {
                    OrderNumber = GenerateOrderNumber(),
                    CustomerId = model.CustomerId,
                    OrderDate = DateTime.UtcNow,
                    Status = "New",
                    CreatedBy = User.Identity.Name,
                    CreatedAt = DateTime.UtcNow
                };

                // Добавляем товары
                decimal total = 0;
                foreach (var item in model.Items.Where(i => i.Quantity > 0))
                {
                    var product = await _tenantDb.Products.FindAsync(item.ProductId);
                    if (product == null) continue;

                    var orderItem = new OrderItem
                    {
                        ProductId = item.ProductId,
                        Quantity = item.Quantity,
                        Price = product.Price
                    };

                    order.OrderItems.Add(orderItem);
                    total += orderItem.Quantity * orderItem.Price;

                    // Уменьшаем остаток
                    product.Stock -= item.Quantity;
                }

                order.TotalAmount = total;

                _tenantDb.Orders.Add(order);
                await _tenantDb.SaveChangesAsync();

                _logger.LogInformation($"Создан заказ {order.OrderNumber} на сумму {total}");

                return RedirectToAction(nameof(Details), new { id = order.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при создании заказа");
                ModelState.AddModelError("", "Ошибка при создании заказа");
                ViewBag.Customers = await _tenantDb.Customers.ToListAsync();
                ViewBag.Products = await _tenantDb.Products.Where(p => p.IsActive).ToListAsync();
                return View(model);
            }
        }

        private string GenerateOrderNumber()
        {
            var date = DateTime.UtcNow;
            var random = new Random().Next(1000, 9999);
            return $"ORD-{date:yyyyMMdd}-{random}";
        }

        // Остальные методы (Edit, Delete и т.д.) по аналогии
    }

    // ViewModel для создания заказа
    public class CreateOrderViewModel
    {
        public int CustomerId { get; set; }
        public List<OrderItemViewModel> Items { get; set; } = new();
    }

    public class OrderItemViewModel
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; }
    }
}
```

### Шаг 16: Главная страница

**OrderManagement.Web/Controllers/HomeController.cs**

```csharp
using Microsoft.AspNetCore.Mvc;
using OrderManagement.Core.Interfaces;

namespace OrderManagement.Web.Controllers
{
    public class HomeController : Controller
    {
        private readonly ITenantProvider _tenantProvider;

        public HomeController(ITenantProvider tenantProvider)
        {
            _tenantProvider = tenantProvider;
        }

        public IActionResult Index()
        {
            var tenant = _tenantProvider.CurrentTenant;

            if (tenant != null)
            {
                // Пользователь на субдомене клиента
                ViewBag.CompanyName = tenant.CompanyName;
                ViewBag.IsTenantSite = true;
                return View("TenantHome");
            }
            else
            {
                // Главная страница (yourapp.ru)
                return View();
            }
        }

        public IActionResult Privacy()
        {
            return View();
        }
    }
}
```

### Шаг 17: Представления

**Views/Account/Register.cshtml**

```html
@model RegisterTenantViewModel

@{
    ViewData["Title"] = "Регистрация";
}

<div class="container mt-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card shadow">
                <div class="card-header bg-primary text-white">
                    <h3 class="mb-0">Создайте свой аккаунт</h3>
                </div>
                <div class="card-body">
                    <form asp-action="Register" method="post" id="registerForm">
                        <div asp-validation-summary="ModelOnly" class="text-danger"></div>

                        <div class="mb-3">
                            <label asp-for="CompanyName" class="form-label"></label>
                            <input asp-for="CompanyName" class="form-control" />
                            <span asp-validation-for="CompanyName" class="text-danger"></span>
                        </div>

                        <div class="mb-3">
                            <label asp-for="Subdomain" class="form-label"></label>
                            <div class="input-group">
                                <input asp-for="Subdomain" class="form-control" id="subdomainInput" />
                                <span class="input-group-text">.yourapp.ru</span>
                            </div>
                            <span asp-validation-for="Subdomain" class="text-danger"></span>
                            <div id="subdomainCheck" class="form-text"></div>
                        </div>

                        <div class="mb-3">
                            <label asp-for="AdminEmail" class="form-label"></label>
                            <input asp-for="AdminEmail" class="form-control" />
                            <span asp-validation-for="AdminEmail" class="text-danger"></span>
                        </div>

                        <div class="mb-3">
                            <label asp-for="Password" class="form-label"></label>
                            <input asp-for="Password" class="form-control" />
                            <span asp-validation-for="Password" class="text-danger"></span>
                        </div>

                        <div class="mb-3">
                            <label asp-for="ConfirmPassword" class="form-label"></label>
                            <input asp-for="ConfirmPassword" class="form-control" />
                            <span asp-validation-for="ConfirmPassword" class="text-danger"></span>
                        </div>

                        <div class="mb-3">
                            <label asp-for="Plan" class="form-label"></label>
                            <select asp-for="Plan" class="form-select">
                                <option value="Starter">Starter - 5 пользователей, 100 заказов/мес - БЕСПЛАТНО</option>
                                <option value="Professional">Professional - 20 пользователей, 1000 заказов/мес - 2990₽/мес</option>
                                <option value="Enterprise">Enterprise - без ограничений - 9990₽/мес</option>
                            </select>
                        </div>

                        <div class="d-grid">
                            <button type="submit" class="btn btn-primary btn-lg">Создать аккаунт</button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="text-center mt-3">
                Уже есть аккаунт? <a asp-action="Login">Войти</a>
            </div>
        </div>
    </div>
</div>

@section Scripts {
    <partial name="_ValidationScriptsPartial" />
    
    <script>
        // AJAX проверка доступности субдомена
        let checkTimeout;
        $('#subdomainInput').on('input', function() {
            clearTimeout(checkTimeout);
            const subdomain = $(this).val().toLowerCase().trim();
            
            if (subdomain.length < 3) {
                $('#subdomainCheck').html('').removeClass();
                return;
            }

            checkTimeout = setTimeout(function() {
                $.get('/Account/CheckSubdomain', { subdomain: subdomain }, function(data) {
                    if (data.available) {
                        $('#subdomainCheck')
                            .html(data.message)
                            .removeClass('text-danger')
                            .addClass('text-success');
                    } else {
                        $('#subdomainCheck')
                            .html(data.message)
                            .removeClass('text-success')
                            .addClass('text-danger');
                    }
                });
            }, 500);
        });
    </script>
}
```

**Views/Account/RegisterSuccess.cshtml**

```html
@{
    ViewData["Title"] = "Регистрация завершена";
}

<div class="container mt-5">
    <div class="row justify-content-center">
        <div class="col-md-8 text-center">
            <div class="card shadow">
                <div class="card-body p-5">
                    <div class="mb-4">
                        <i class="bi bi-check-circle text-success" style="font-size: 5rem;"></i>
                    </div>
                    
                    <h2 class="text-success mb-4">Поздравляем!</h2>
                    <p class="lead">Ваш аккаунт успешно создан</p>
                    
                    <div class="alert alert-info mt-4">
                        <h5>Данные для входа:</h5>
                        <p class="mb-1"><strong>Адрес вашей системы:</strong></p>
                        <p class="fs-4">
                            <a href="http://@ViewBag.Subdomain.yourapp.ru" target="_blank">
                                @ViewBag.Subdomain.yourapp.ru
                            </a>
                        </p>
                        <p class="mb-1"><strong>Email:</strong> @ViewBag.Email</p>
                    </div>

                    <div class="mt-4">
                        <a href="http://@ViewBag.Subdomain.yourapp.ru" class="btn btn-primary btn-lg">
                            Перейти в систему
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

**Views/Orders/Index.cshtml**

```html
@model IEnumerable<Order>

@{
    ViewData["Title"] = "Заказы";
}

<div class="container-fluid mt-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h2>
            <i class="bi bi-box-seam"></i> Заказы
            <small class="text-muted">(@ViewBag.CompanyName)</small>
        </h2>
        <a asp-action="Create" class="btn btn-primary">
            <i class="bi bi-plus-circle"></i> Создать заказ
        </a>
    </div>

    <div class="card shadow-sm">
        <div class="card-body">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Номер заказа</th>
                        <th>Клиент</th>
                        <th>Дата</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    @foreach (var order in Model)
                    {
                        <tr>
                            <td><strong>@order.OrderNumber</strong></td>
                            <td>@order.Customer.Name</td>
                            <td>@order.OrderDate.ToString("dd.MM.yyyy HH:mm")</td>
                            <td><strong>@order.TotalAmount.ToString("N2") ₽</strong></td>
                            <td>
                                @switch (order.Status)
                                {
                                    case "New":
                                        <span class="badge bg-info">Новый</span>
                                        break;
                                    case "Processing":
                                        <span class="badge bg-warning">В обработке</span>
                                        break;
                                    case "Completed":
                                        <span class="badge bg-success">Завершен</span>
                                        break;
                                    case "Cancelled":
                                        <span class="badge bg-danger">Отменен</span>
                                        break;
                                }
                            </td>
                            <td>
                                <a asp-action="Details" asp-route-id="@order.Id" class="btn btn-sm btn-outline-primary">
                                    Подробнее
                                </a>
                            </td>
                        </tr>
                    }
                </tbody>
            </table>
        </div>
    </div>
</div>
```

---

## 🔧 Настройка Program.cs {#program-cs}

### Шаг 18: Полная конфигурация Program.cs

**OrderManagement.Web/Program.cs**

```csharp
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OrderManagement.Core.Data;
using OrderManagement.Core.Entities.Master;
using OrderManagement.Core.Interfaces;
using OrderManagement.Web.Middleware;
using OrderManagement.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// ========== КОНФИГУРАЦИЯ СЕРВИСОВ ==========

// 1. Мастер-база данных (центральная)
builder.Services.AddDbContext<MasterDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("MasterDatabase"),
        sqlOptions => sqlOptions.MigrationsAssembly("OrderManagement.Core")
    ));

// 2. Identity для аутентификации
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    // Настройки паролей
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 6;

    // Настройки пользователя
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<MasterDbContext>()
.AddDefaultTokenProviders();

// 3. Регистрация TenantDbContext как Scoped с фабрикой
builder.Services.AddScoped<TenantDbContext>(provider =>
{
    var tenantProvider = provider.GetRequiredService<ITenantProvider>();
    var tenant = tenantProvider.CurrentTenant;

    if (tenant == null)
    {
        throw new InvalidOperationException("Тенант не определен. Убедитесь, что middleware TenantResolution выполнен.");
    }

    return new TenantDbContext(tenant.ConnectionString);
});

// 4. Регистрация сервисов
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<ITenantProvider, TenantProvider>();

// 5. HttpContextAccessor для доступа к HttpContext в сервисах
builder.Services.AddHttpContextAccessor();

// 6. MVC контроллеры и представления
builder.Services.AddControllersWithViews();

// 7. Настройка cookie для аутентификации
builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.LogoutPath = "/Account/Logout";
    options.AccessDeniedPath = "/Account/AccessDenied";
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
});

var app = builder.Build();

// ========== КОНФИГУРАЦИЯ PIPELINE ==========

// Middleware для обработки ошибок
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// !!! ВАЖНО: Middleware для определения тенанта ПЕРЕД аутентификацией
app.UseTenantResolution();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// ========== АВТОМАТИЧЕСКОЕ ПРИМЕНЕНИЕ МИГРАЦИЙ ==========
using (var scope = app.Services.CreateScope())
{
    try
    {
        var masterDb = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
        masterDb.Database.Migrate();
        
        Console.WriteLine("✓ Миграции мастер-базы применены успешно");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"✗ Ошибка при применении миграций: {ex.Message}");
    }
}

app.Run();
```

---

## 🚀 Развертывание {#развертывание}

### Шаг 19: Настройка для localhost (разработка)

Для тестирования на localhost нужно эмулировать субдомены. Есть 2 варианта:

**Вариант А: Использовать файл hosts**

Windows: `C:\Windows\System32\drivers\etc\hosts`  
Linux/Mac: `/etc/hosts`

Добавить:
```
127.0.0.1   localhost
127.0.0.1   client1.localhost
127.0.0.1   demo.localhost
127.0.0.1   admin.localhost
```

Теперь можно открывать:
- `http://localhost:5000` - главная страница
- `http://client1.localhost:5000` - тенант client1
- `http://demo.localhost:5000` - демо-тенант

**Вариант Б: Модифицировать Middleware для localhost**

В `TenantResolutionMiddleware.cs` добавить:

```csharp
private string ExtractSubdomain(string host)
{
    // РЕЖИМ РАЗРАБОТКИ: определяем тенант по query string
    if (host == "localhost" || host.StartsWith("localhost:"))
    {
        // Можно использовать ?tenant=client1
        return null; // или извлекать из query string
    }

    // Для localhost с субдоменами
    if (host.EndsWith(".localhost") || host.Contains(".localhost:"))
    {
        var parts = host.Split('.');
        return parts[0]; // client1 из client1.localhost
    }

    // Стандартная логика для продакшена
    var domainParts = host.Split('.');
    if (domainParts.Length < 3)
        return null;

    return domainParts[0];
}
```

### Шаг 20: Публикация на сервер

**1. Подготовка сервера (Windows Server / Linux)**

Нужно:
- IIS / Nginx / Kestrel
- SQL Server / PostgreSQL
- .NET 8 Runtime

**2. Настройка DNS**

В панели управления доменом добавить A-запись с wildcard:

```
*.yourapp.ru   A   192.168.1.100
```

Это позволит любому субдомену (`client1.yourapp.ru`, `demo.yourapp.ru`) резолвиться на ваш сервер.

**3. Настройка IIS (для Windows)**

- Создать сайт с привязкой: `*.yourapp.ru`
- Установить URL Rewrite Module
- Настроить Application Pool на .NET (No Managed Code)

**4. Настройка Nginx (для Linux)**

`/etc/nginx/sites-available/yourapp`

```nginx
server {
    listen 80;
    server_name *.yourapp.ru yourapp.ru;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**5. Публикация приложения**

```bash
# Сборка для продакшена
dotnet publish -c Release -o ./publish

# Копирование на сервер
scp -r ./publish user@yourserver:/var/www/yourapp

# Запуск как сервис (systemd для Linux)
sudo nano /etc/systemd/system/yourapp.service
```

**yourapp.service:**
```ini
[Unit]
Description=Order Management SaaS

[Service]
WorkingDirectory=/var/www/yourapp
ExecStart=/usr/bin/dotnet /var/www/yourapp/OrderManagement.Web.dll
Restart=always
RestartSec=10
SyslogIdentifier=yourapp
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable yourapp
sudo systemctl start yourapp
sudo systemctl status yourapp
```

### Шаг 21: SSL сертификат (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение wildcard сертификата
sudo certbot certonly --manual --preferred-challenges=dns -d yourapp.ru -d *.yourapp.ru

# Следуйте инструкциям для добавления TXT записи в DNS
```

После получения сертификата обновить конфигурацию Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name *.yourapp.ru yourapp.ru;

    ssl_certificate /etc/letsencrypt/live/yourapp.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourapp.ru/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        # ... остальные настройки
    }
}

# Редирект с HTTP на HTTPS
server {
    listen 80;
    server_name *.yourapp.ru yourapp.ru;
    return 301 https://$host$request_uri;
}
```

---

## 📊 Итоговая схема работы системы

```
┌──────────────────────────────────────────────────────────────────┐
│                         ПРОЦЕСС РАБОТЫ                            │
└──────────────────────────────────────────────────────────────────┘

1. РЕГИСТРАЦИЯ НОВОГО КЛИЕНТА
   ├─► Пользователь заходит на yourapp.ru/Account/Register
   ├─► Заполняет форму (компания: "ООО Рога", субдомен: "roga")
   ├─► Система:
   │   ├─► Создает запись в Master DB (таблица Tenants)
   │   ├─► Создает физическую БД: OrderManagement_Tenant_1
   │   ├─► Применяет миграции к новой БД
   │   ├─► Создает пользователя-админа в Master DB
   │   └─► Возвращает ссылку: roga.yourapp.ru
   └─► Клиент переходит на roga.yourapp.ru

2. ВХОД КЛИЕНТА
   ├─► Пользователь открывает roga.yourapp.ru
   ├─► TenantResolutionMiddleware:
   │   ├─► Парсит host: "roga.yourapp.ru"
   │   ├─► Извлекает subdomain: "roga"
   │   ├─► Запрашивает Tenant из Master DB WHERE Subdomain='roga'
   │   ├─► Получает ConnectionString для базы roga
   │   └─► Сохраняет в HttpContext.Items["Tenant"]
   ├─► TenantProvider предоставляет CurrentTenant
   ├─► TenantDbContext подключается к БД roga
   └─► Пользователь видит свои данные (заказы, товары и т.д.)

3. РАБОТА С ЗАКАЗАМИ
   ├─► Пользователь создает заказ
   ├─► OrdersController:
   │   ├─► Получает TenantDbContext (уже подключен к БД roga)
   │   ├─► Сохраняет Order в таблицу Orders базы roga
   │   └─► Все данные изолированы от других клиентов
   └─► Готово!

4. МАСШТАБИРОВАНИЕ
   ├─► Если клиент стал слишком большим:
   │   ├─► Переносим его БД на отдельный SQL Server
   │   ├─► Обновляем ConnectionString в Master DB
   │   └─► Всё продолжает работать без изменений в коде!
   └─► Если нужно больше серверов приложений:
       ├─► Разворачиваем копии приложения на разных серверах
       ├─► Настраиваем балансировщик нагрузки
       └─► Все серверы читают Master DB и подключаются к нужным БД

```

---

## 🎯 Что дальше?

Теперь у вас есть полностью рабочая multi-tenant SaaS система! Вот что можно добавить:

### Дополнительные фичи:

1. **Биллинг и подписки**
   - Интеграция с Stripe/Paddle
   - Автоматическая блокировка при неоплате
   - Тарифные планы с ограничениями

2. **Мониторинг**
   - Application Insights
   - Логирование действий пользователей
   - Метрики использования (для каждого тенанта)

3. **Бэкапы**
   - Автоматические бэкапы баз клиентов
   - Возможность восстановления конкретного тенанта

4. **API**
   - REST API для интеграций
   - API ключи на уровне тенанта

5. **Белые метки (White-label)**
   - Кастомные домены (client.ru вместо client.yourapp.ru)
   - Брендирование интерфейса

6. **Админ-панель**
   - Управление всеми тенантами
   - Статистика и аналитика
   - Массовые операции

Отличный вопрос!  
📌 **Краткий ответ**: **Нет**. Клиенты не будут конфликтовать между собой, если всё правильно организовано — их контексты, данные, подключения и сессии **изолированы на уровне запроса**.

---

## 🧠 Почему тенанты не конфликтуют? Подробно:

Ты используешь **единую ASP.NET Core-приложение**, но контексты и подключения определяются **динамически для каждого запроса** в зависимости от субдомена клиента.

---

### 📦 Как устроена архитектура:

| Компонент            | Описание                                                                 |
|----------------------|--------------------------------------------------------------------------|
| `MasterDbContext`    | Единый для всех. К нему подключаются все клиенты для авторизации или регистрации. |
| `TenantDbContext`    | Создаётся на каждый HTTP-запрос клиента и использует **отдельную строку подключения.** |
| `TenantService`      | Привязывает тенанта на текущий HTTP запрос                              |
| `Middleware`         | Извлекает субдомен, находит тенанта в мастер-базе и сохраняет его в `HttpContext.Items` |

---

### 🧩 На уровне кода:

```csharp
// Scoped контекст создаётся на каждый запрос:
services.AddScoped<TenantDbContext>(provider =>
{
    var tenantService = provider.GetRequiredService<ITenantService>();
    var tenant = tenantService.GetTenant();

    return new TenantDbContext(tenant.ConnectionString);
});
```

🔒 **Важно**: `TenantDbContext` не глобальный, не синглтон – он **scoped**, то есть локален для каждого HTTP-запроса одного пользователя.

🧠 Таким образом:
- Клиент 1 → запрос → вызов `tenantService.GetTenant()` → подключение к `client1_db`
- Клиент 2 → запрос → вызов `tenantService.GetTenant()` → подключение к `client2_db`

Между ними — **никакой связи и конфликт невозможен**, даже если два запроса выполняются одновременно.

---

## 🧪 Что будет, если два клиента обращаются одновременно?

**Нет конфликта** – потому что:

- `TenantDbContext` создается на запрос (scoped)
- `TenantService` возвращает текущего тенанта, определённого из HttpContext
- Среда исполнения ASP.NET Core основана на **request-based pipeline** — у каждого клиента свой изолированный request context

---

### ✋ Что может пойти НЕ ТАК, если ошибиться?

| Ошибка                          | К чему приведёт?                                         | Как избежать?                            |
|--------------------------------|-----------------------------------------------------------|-------------------------------------------|
| Используешь `TenantDbContext` как Singleton  | Контексты "всплываются", клиенты видят чужие данные      | Используй только `Scoped`, не `Singleton` |
| HttpContext не доступен в BackgroundService  | `TenantService` не сможет получить данные                | Не использовать подход в background’ах    |
| Запросов много — не thread-safe код | Возможен race condition                                  | Используй `async/await`, не храни статику |

---

## ✅ Как полностью изолировать:

1. Один HTTP-запрос — один `TenantDbContext`
2. ConnectionString у него — своя (конфигурация текущего тенанта)
3. `HttpContext.Items` — хранит конкретного клиента
4. `AddScoped` — гарантирует, что конфликта не будет

---

## 🔐 Почему такой подход даже безопаснее, чем shared database:

Если бы все клиенты работали на одной базе с фильтрацией:  
```sql
SELECT * FROM Orders WHERE TenantId = 'abc'
```

⚠️ Даже одна ошибка `WHERE TenantId = ...` — и данные "утекли".

А при **отдельной базе на клиента**:
- У каждого клиента свои таблицы, изолированные на уровне физической БД
- Ни один запрос не попадает в "чужую" базу в принципе

---

## 🧰 Итог:

| Вопрос                                  | Ответ                                     |
|----------------------------------------|-------------------------------------------|
| Будут ли клиенты конфликтовать?        | ❌ Нет                                    |
| Откуда берётся контекст базы клиента?  | ✔️ Из Middleware через DI                 |
| Контекст один на всех?                 | ❌ Нет, создаётся отдельно per-request    |
| Можно ли перейти на кластер в будущем? | ✔️ Легко — базы уже изолированы           |

---

🔗 **Хочешь ещё сильнее изолировать?**  
Добавь пул подключений на каждого клиента, ограничь права пользователя SQL и внедри retry policy на уровне EF Core.


Очень хороший вопрос! 🧠  
Чтобы SaaS-приложение с субдоменами (например, `client1.mysaas.com`, `client2.mysaas.com`) работало как задумано, нужно **настроить DNS так, чтобы любые субдомены указывали на твой сервер** — и сервер умел правильно их обрабатывать.

---

## 🚀 Цель

🔧 Ты хочешь:
- Один домен (*например*: `mysaas.com`)
- Динамически создаваемые субдомены (`client1.mysaas.com`, `client2.mysaas.com`, `demo.mysaas.com`, ...)
- Все субдомены **указывали на один и тот же сервер**
- И чтобы ASP.NET Core, получая запрос, понимало, какой клиент обратился

---

# ✅ Решение: Используем **Wildcard DNS**

## 👇 Что такое Wildcard DNS

Это одна DNS-запись, которая позволяет автоматически обслуживать **все субдомены твоего домена**.

### Пример:

| Тип | Имя (Name)   | Значение (Value)        |
|-----|--------------|-------------------------|
| A   | `@`          | `192.168.1.100` (IP сервера) |
| A   | `*`          | `192.168.1.100`         |

- Первый A-запись `@` — указывает root-домен `mysaas.com` на твой сервер.
- Второй A-запись `*` — говорит: **всё, что не указано явно, тоже отправлять на этот сервер**.

🔁 Результат:
- `client1.mysaas.com` → твой сервер
- `demo.mysaas.com` → твой сервер
- `client999.mysaas.com` → туда же

---

## 🔧 Как это настроить — пошагово (на примере Cloudflare или любой DNS-панели)

### Шаг 0: Подключи домен (например, `mysaas.com`) к DNS-панели

Например:
- [Cloudflare](https://cloudflare.com)
- [Yandex DNS](https://connect.yandex.ru/)
- [Namecheap](https://namecheap.com)
- DigitalOcean, Linode, etc.

### Шаг 1: Добавь A-записи

| Тип | Имя           | Значение               |
|-----|---------------|------------------------|
| A   | `@`           | IP твоего сервера      |
| A   | `*`           | IP твоего сервера      |

> Или, если ты используешь поддомен `app.mysaas.com`, а все клиенты через `*.mysaas.com`, сделай:
>
> - `A app → 192.168.1.100`
> - `A * → тот же IP`

---

## 🧰 Если используешь Cloudflare или подобное:

- Убедись, что обе записи (`@`, `*`) с режимом проксирования или "gray cloud" — в зависимости от поддержки
- Если не работает HTTPS — может потребоваться подключить **Wildcard SSL сертификат**

---

# 🔐 HTTPS и Wildcard поддомены

💡 Безопасность важна, и многие браузеры требуют HTTPS

### 🔐 Решение — TLS/SSL с Wildcard-сертификатом

#### Вариант 1: LetsEncrypt + Wildcard сертификат
- Бесплатно
- Поддерживает `*.mysaas.com`
- Но потребуется **DNS-подтверждение** (DNS-01 challenge)

#### Вариант 2: Платный сертификат
- Покупаешь Wildcard-сертификат у провайдера (Comodo, etc.)
- Устанавливаешь в nginx/Kestrel

---

# 👍 Обработка на стороне сервера — ASP.NET Core

Тебе ничего дополнительного делать не нужно, кроме как правильно обрабатывать хост:

```csharp
var subdomain = Request.Host.Host.Split('.')[0];
```

Примеры:

| Запрос                        | `.Host.Host`            | `subdomain` |
|------------------------------|--------------------------|-------------|
| `https://client1.mysaas.com` | `client1.mysaas.com`    | `client1`   |
| `https://demo.mysaas.com`    | `demo.mysaas.com`       | `demo`      |

Ты это уже делаешь в Middleware 👇:

```csharp
var host = context.Request.Host.Host;
var subdomain = host.Split('.')[0];
```

---

# 📦 Пример с NGINX (если у тебя Linux VPS)

```nginx
server {
    listen 80;
    server_name *.mysaas.com;

    location / {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> Если ты используешь HTTPS, добавь ssl_certificate, ssl_certificate_key и перенаправление с 80 на 443.

---

# ✅ Быстрый чеклист

| Что                     | Сделал? |
|-------------------------|---------|
| Подключил домен         | ✅      |
| Добавил A-запись `@`    | ✅      |
| Добавил A-запись `*`    | ✅      |
| Wildcard SSL сертификат | ✅ / 🚧 |
| Middleware обрабатывает | ✅      |
| Прокси (Nginx) настроен | ✅      |

---

# 💬 Хочешь автоматическую генерацию субдоменов?

Если хочешь, чтобы клиент **регистрировался → и сразу получал апи `client123.mysaas.com`**, тебе **не нужно добавлять записи в DNS вручную** — при включённой `*` они уже работают.

📌 Главное — в браузере или в письме отобразить правильный адрес:  
`https://{subdomain}.mysaas.com`

---

# ❗ Итог

✅ C помощью wildcard DNS (`*`) ты:

- Обеспечиваешь работу всех субдоменов без ручной настройки
- Позволяешь масштабироваться свободно
- Работает с ASP.NET Core Middleware идеально

📦. Один сервер, один IP, одна настройка — и масштабируемость на тысячи клиентов 🎯
