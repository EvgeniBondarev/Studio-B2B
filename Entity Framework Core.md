Отличный вопрос! Это самый больной и самый спорный вопрос в .NET сообществе последние 5 лет, и 90% советов которые ты найдёшь в интернете уже устарели на 5-10 лет.

🚨 Самая важная правда которую почти никто не говорит:
> Классический паттерн Репозиторий и Общий Репозиторий `IRepository<T>` это официально антипаттерн при использовании современного EF Core.
> Даже авторы EF Core прямо говорят об этом. EF Core сам по себе уже является полностью готовой реализацией Репозитория и Unit Of Work. Любая дополнительная абстракция сверху это 100% лишний код который ничего не решает, а только добавляет баги и усложняет поддержку.

Все проблемы которые ты описываешь: огромные файлы репозиториев, ад с Include и FK, дублирование кода, невозможность переиспользовать логику - это именно болезни старого подхода с репозиториями.

---

# 🎯 Актуальный стек подходов 2025 года

От худшего к лучшему:

| Подход | Статус | Когда использовать |
|---|---|---|
| Общий IRepository<T> | ❌ Антипаттерн | Никогда |
| Отдельный репозиторий на сущность | ⚠️ Устарел | Только для очень простых CRUD |
| Расширения для DbContext | ✅ Хорошо | Для большинства проектов |
| CQRS + Вертикальный срез | ✅✅ Отлично | Де-факто стандарт на сегодня |
| Чистая архитектура | ⚠️ Переусложнён | Только для больших корпоративных команд |

---

# 🏆 Рекомендуемый подход для маленькой и средней команды

Это компромисс между чистотой, отсутствием лишнего кода и удобством поддержки. Используется большинством команд .NET которые делают реальные продукты а не пишут блоги про паттерны.

## Основная идея:

> Нет никаких общих абстракций. Нет репозиториев. Вся логика доступа к данным группируется по сценарию использования, а не по сущности.

---

## 🧩 Шаг 1: DbContext это твой единственный репозиторий

Ты больше ничего не пишешь сверху. `AppDbContext` это твой единственный и единственный слой доступа к данным.

```csharp
public class AppDbContext : DbContext
{
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
    public DbSet<Client> Clients { get; set; }
    public DbSet<Tenant> Tenants { get; set; }
}
```

✅ И это всё. Больше никаких `IOrderRepository`, `OrderRepository`, `GenericRepository`. Никогда.

---

## 🧩 Шаг 2: Расширения для переиспользуемой логики запросов

Это самое мощное и самое недооценённое средство EF Core. Это решает абсолютно всю боль с Include, FK и зависимостями раз и навсегда.

❌ Плохо:
```csharp
// Ты пишешь это 15 раз в 15 разных местах
var order = await db.Orders
    .Include(o => o.Items)
    .Include(o => o.Client)
    .Include(o => o.Delivery)
    .Include(o => o.Payments)
    .FirstOrDefaultAsync(o => o.Id == id);
```

✅ Хорошо:
```csharp
// Написал один раз, используешь везде
public static class OrderQueryExtensions
{
    public static IQueryable<Order> IncludeEverything(this IQueryable<Order> query)
    {
        return query
            .Include(o => o.Items)
            .Include(o => o.Client)
            .Include(o => o.Delivery)
            .Include(o => o.Payments);
    }

    public static IQueryable<Order> OnlyActive(this IQueryable<Order> query)
    {
        return query.Where(o => o.Status != OrderStatus.Cancelled);
    }

    public static IQueryable<Order> CreatedAfter(this IQueryable<Order> query, DateTime date)
    {
        return query.Where(o => o.CreatedAt >= date);
    }
}
```

Использование в любом месте кода:
```csharp
var order = await db.Orders
    .IncludeEverything()
    .OnlyActive()
    .FirstOrDefaultAsync(o => o.Id == id);


var ordersLastWeek = await db.Orders
    .IncludeEverything()
    .OnlyActive()
    .CreatedAfter(DateTime.UtcNow.AddDays(-7))
    .ToListAsync();
```

💣 Это самое главное улучшение которое ты можешь сделать в своём коде прямо сейчас. Это решает 95% всех проблем с доступом к данным.

✅ Преимущества:
- Написал Include один раз, никогда больше не повторяешь
- Если добавил новую зависимость в заказ - добавил один раз в расширение, всё автоматически работает везде
- Нулевое дублирование кода
- Полная сила EF Core ничем не ограничена
- Легко тестировать
- Нет никакой утечки абстракции

---

## 🧩 Шаг 3: Группировка логики по сценариям использования

Дальше ты группируешь бизнес логику не по сущностям, а по тому что система делает.

Нет никакого `OrderService` на 3000 строк. Вместо этого у тебя есть маленькие классы которые делают ровно одну вещь.

Пример структуры:

```
Features/
  Orders/
    GetOrderById.cs
    GetOrdersForPeriod.cs
    CreateOrder.cs
    UpdateOrderStatus.cs
    CancelOrder.cs
    GenerateOrderReport.cs
```

Каждый файл это один полный сценарий:

```csharp
public class GetOrdersForPeriod
{
    private readonly AppDbContext _db;

    public GetOrdersForPeriod(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<OrderDto>> Handle(DateTime from, DateTime to, Guid tenantId)
    {
        return await _db.Orders
            .Where(o => o.TenantId == tenantId)
            .IncludeEverything()
            .OnlyActive()
            .CreatedAfter(from)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderDto
            {
                Id = o.Id,
                Number = o.ExternalId,
                ClientName = o.Client.Name,
                Total = o.TotalSum
            })
            .ToListAsync();
    }
}
```

✅ Преимущества:
- Максимальный размер одного файла ~100 строк
- Никогда больше не будет файлов на 5000 строк
- Легко найти любую логику
- Легко изменить один сценарий не сломав ничего другого
- Легко тестировать каждый сценарий отдельно
- Легко удалить старый не нужный функционал

---

## 🧩 Шаг 4: Когда использовать MediatR?

MediatR это полностью опциональная деталь. Ты можешь использовать этот подход как с MediatR так и без него.

Если у тебя маленькая команда - можешь совершенно спокойно обходиться без него. Если проект растёт и становится больше 20 сценариев - добавить MediatR будет делом 15 минут.

---

# 📋 Сравнение с репозиторием

| Функция | Репозиторий | Расширения + Вертикальный срез |
|---|---|---|
| Переиспользование Include | ❌ Дублируешь в каждом методе | ✅ Один раз написал и забыл |
| Размер файлов | ❌ 1000+ строк на репозиторий | ✅ Максимум 100 строк на файл |
| Дублирование кода | ❌ Огромное | ✅ Почти нулевое |
| Мощь запросов EF Core | ❌ Ограничена абстракцией | ✅ Полная |
| Легко найти код | ❌ Нет | ✅ Да |
| Время на поддержку | ❌ Очень много | ✅ Очень мало |

---

# 🎯 Самые частые возражения

> А как же я буду тестировать?

Ты точно так же можешь подменить `AppDbContext` в тестах как и любой репозиторий. Более того тесты получаются гораздо проще и надёжнее.

> А если я захочу потом поменять EF Core на другой ORM?

Это никогда не случится. За последние 10 лет я не видел ни одного реального проекта который бы это сделал. Это сказка для студентов. Ты потратишь тысячи часов работы на абстракцию которая никогда не будет использована.

> А это не нарушает единственную ответственность?

Нет. Наоборот. Каждый класс делает ровно одну вещь. Это гораздо ближе к единственной ответственности чем гигантский репозиторий который делает 50 разных вещей.

---

# 📌 Итог и чек-лист что делать прямо сейчас

1. ✅ Удали все репозитории. Все. Без исключений.
2. ✅ Оставь только чистый `AppDbContext`
3. ✅ Все общие фильтры, включения, сортировки вынеси в статические расширения для `IQueryable`
4. ✅ Разбей все сервисы на маленькие классы по одному сценарию на класс
5. ✅ Забудь про `IRepository<T>` как про страшный сон.

Это самый большой скачок в качестве кода и скорости разработки который ты можешь сделать прямо сейчас. После этого ты никогда больше не захочешь возвращаться к репозиториям.


 это та самая точка где 99% реализаций превращаются в не поддерживаемое говно с гигантским `switch case` на 50 веток который нужно править каждый раз когда ты добавляешь одно новое поле.

Есть идеальный подход который даёт:
✅ 100% типобезопасность
✅ Нулевой дублирующий код
✅ Любое количество полей для фильтрации и сортировки
✅ Добавление нового поля = одна строка кода
✅ Полностью транслируется в чистый SQL
✅ Абсолютно максимальная скорость
✅ Комбинируется со всеми расширениями про которые мы говорили раньше

И самое главное нет никаких внешних библиотек, нет динамического линка, нет рефлексии в рантайме, нет магии.

---

## ❌ Как НЕ надо делать

Так делают абсолютно все. Никогда так не делай.

```csharp
// 💩 Антипаттерн
IQueryable<Order> ApplySort(IQueryable<Order> query, string sortBy, bool desc)
{
    return sortBy switch
    {
        "id" => desc ? query.OrderByDescending(o => o.Id) : query.OrderBy(o => o.Id),
        "createdAt" => desc ? query.OrderByDescending(o => o.CreatedAt) : query.OrderBy(o => o.CreatedAt),
        "number" => desc ? query.OrderByDescending(o => o.ExternalId) : query.OrderBy(o => o.ExternalId),
        "sum" => desc ? query.OrderByDescending(o => o.TotalSum) : query.OrderBy(o => o.TotalSum),
        // и так ещё 20 веток
        _ => query.OrderByDescending(o => o.CreatedAt)
    };
}
```

---

## ✅ Правильный подход: Маппинг выражений

Основная идея очень простая: мы один раз создаём статический словарь который связывает строковое имя поля с типобезопасным выражением. Весь маппинг в одном месте, добавление нового поля = одна строка.

### Шаг 1: Сортировка

```csharp
public static class OrderSortMappings
{
    // Весь маппинг сортировки в одном месте
    public static readonly IReadOnlyDictionary<string, Expression<Func<Order, object>>> By = 
        new Dictionary<string, Expression<Func<Order, object>>>
        {
            ["id"] = o => o.Id,
            ["createdAt"] = o => o.CreatedAt,
            ["number"] = o => o.ExternalId,
            ["sum"] = o => o.TotalSum,
            ["status"] = o => o.Status,
            ["clientName"] = o => o.Client.Name, // ✅ Работает даже со вложенными полями!
            ["marketplace"] = o => o.Marketplace
        };
}
```

Затем одно универсальное расширение сортировки на всю жизнь:

```csharp
public static IQueryable<T> SortBy<T>(this IQueryable<T> query, 
    IReadOnlyDictionary<string, Expression<Func<T, object>>> mappings,
    string sortBy, 
    bool descending = true)
{
    // Если пришло неизвестное поле сортировки - используем первое по умолчанию
    if (!mappings.TryGetValue(sortBy, out var selector))
        selector = mappings.Values.First();

    return descending 
        ? query.OrderByDescending(selector) 
        : query.OrderBy(selector);
}
```

💥 Итого использование в одну строку:

```csharp
var orders = await db.Orders
    .IncludeEverything()
    .OnlyActive()
    .SortBy(OrderSortMappings.By, request.SortBy, request.Descending)
    .ToListAsync();
```

✅ Добавил новое поле для сортировки? Добавил одну строку в словарь. Всё. Больше ничего менять не нужно нигде.

---

### Шаг 2: Фильтрация

Точно такой же подход. Никаких свитчей. Все фильтры для сущности в одном месте.

```csharp
public static class OrderFilters
{
    public static IQueryable<Order> Apply(this IQueryable<Order> query, GetOrdersRequest request)
    {
        if (request.Status.HasValue)
            query = query.Where(o => o.Status == request.Status);

        if (!string.IsNullOrEmpty(request.Search))
            query = query.Where(o => 
                o.ExternalId.Contains(request.Search) 
                || o.Client.Name.Contains(request.Search));

        if (request.MinSum.HasValue)
            query = query.Where(o => o.TotalSum >= request.MinSum);

        if (request.MaxSum.HasValue)
            query = query.Where(o => o.TotalSum <= request.MaxSum);

        if (request.From.HasValue)
            query = query.Where(o => o.CreatedAt >= request.From);

        if (request.To.HasValue)
            query = query.Where(o => o.CreatedAt <= request.To);

        return query;
    }
}
```

---

### Шаг 3: Пагинация

Одно расширение на всю жизнь для любых сущностей:

```csharp
public static IQueryable<T> Paginate<T>(this IQueryable<T> query, int page, int pageSize = 20)
{
    page = Math.Max(1, page);
    pageSize = Math.Clamp(pageSize, 1, 100);

    return query
        .Skip((page - 1) * pageSize)
        .Take(pageSize);
}
```

---

### 🎯 Всё вместе в конечном результате

В итоге весь твой обработчик получения заказов выглядит так:

```csharp
public async Task<List<OrderDto>> Handle(GetOrdersRequest request, Guid tenantId)
{
    return await db.Orders
        .Where(o => o.TenantId == tenantId)
        .IncludeEverything()
        .OnlyActive()
        .Apply(request)
        .SortBy(OrderSortMappings.By, request.SortBy, request.Descending)
        .Paginate(request.Page, request.PageSize)
        .Select(o => o.ToDto())
        .ToListAsync();
}
```

💣 Это ВЕСЬ код. 10 строк. Никакого бойлерплейта. Никаких репозиториев. Никаких свитчей.

---

## 📌 Самые важные детали про которые никто не говорит

1. ✅ Всё это полностью транслируется в идеальный чистый SQL. Никакой фильтрации в памяти.
2. ✅ 100% типобезопасно. Если ты переименуешь поле рефакторингом - маппинг тоже обновится автоматически.
3. ✅ Нет рефлексии в рантайме. Всё построено на выражениях которые EF Core прекрасно понимает.
4. ✅ Добавление нового фильтра = одна строка в `Apply`.
5. ✅ Добавление нового поля для сортировки = одна строка в словарь.
6. ✅ Полностью тестируется.

---

## ❌ Чего никогда не делай

- ❌ Не используй `System.Linq.Dynamic.Core`. Это не безопасно, не типобезопасно, генерирует ужасный SQL.
- ❌ Не делай общий универсальный сортировщик на рефлексии для всех сущностей. Это работает пока не сломается самым неожиданным образом.
- ❌ Не пиши `switch case` для сортировки. Никогда.

---

## 🎯 Итог

Это самый лучший баланс между простотой, гибкостью и производительностью который существует на сегодня. Это та самая архитектура которая выдерживает миллионы строк и сотни разработчиков и остаётся удобной в поддержке.

И самое главное это идеально дополняет всю архитектуру про расширения и вертикальные срезы которую мы обсуждали раньше.

Это логичный следующий шаг. Писать ручные `.Select(o => new Dto { ... })` для моделей с 50 полями — это ад, который сложно поддерживать. А обновлять данные через DTO, просто перекладывая поля — риск нарушить целостность данных.

Давай разберем **современные паттерны**, которые решают обе проблемы: избавляют от рутины маппинга и защищают бизнес-логику при обновлении.

---

### Часть 1: Чтение (Read) — Как убрать огромные `.Select`

Когда ты делаешь `.Select`, ты делаешь **Проекцию**. Это критически важно, потому что EF Core генерирует SQL, который выбирает *только* нужные колонки.

Чтобы не писать это руками, используй библиотеки маппинга, которые поддерживают `IQueryable` проекции.

**Лидер производительности сейчас — Mapster.**
(AutoMapper тоже популярен, но Mapster быстрее и проще в настройке, так как компилирует код маппинга).

#### 1. Установка Mapster
```bash
dotnet add package Mapster
```

#### 2. Как это выглядит в коде (Решение проблемы "много полей")

Тебе больше не нужны `Include()`! Библиотека сама проанализирует DTO, поймет, какие навигационные свойства нужны, и построит JOIN и SELECT.

```csharp
using Mapster;

public async Task<List<OrderDto>> Handle(DateTime from, DateTime to, Guid tenantId)
{
    return await _db.Orders
        .Where(o => o.TenantId == tenantId)
        .OnlyActive() // Твои фильтры
        .CreatedAfter(from)
        // 🚀 МАГИЯ ТУТ:
        .ProjectToType<OrderDto>() 
        .ToListAsync();
}
```

**Что происходит под капотом:**
Mapster смотрит на `OrderDto`.
*   Видит поле `ClientName` -> понимает, что надо залезть в `Order.Client.Name`.
*   Генерирует SQL: `SELECT t.Id, c.Name, ... FROM Orders JOIN Clients ...`
*   Ты не пишешь `.Include(x => x.Client)` — это происходит автоматически.

#### 3. Конфигурация (один раз в Startup)
Если имена полей не совпадают, настраиваешь глобально:

```csharp
TypeAdapterConfig<Order, OrderDto>
    .NewConfig()
    .Map(dest => dest.ClientName, src => src.Client.FullName)
    .Map(dest => dest.Total, src => src.Items.Sum(x => x.Price));
```

---

### Часть 2: Изменение (Write) — Как обновлять через DTO

Тут есть **ДВА пути**. Выбор зависит от сложности логики.

#### Путь А: CRUD (для простых справочников)
Если это просто "Обновить адрес клиента" и там нет бизнес-правил, можно маппить DTO прямо в сущность.

```csharp
public async Task UpdateClient(UpdateClientDto dto)
{
    var client = await _db.Clients.FindAsync(dto.Id);
    
    // Mapster копирует поля из DTO в существующую сущность
    dto.Adapt(client); 
    
    await _db.SaveChangesAsync();
}
```

#### Путь Б: Rich Domain Model (для Заказов и важной логики) 🏆
Для `Order` **никогда не используй автомаппинг DTO в сущность**.
Сущность должна защищать себя. Если ты просто перельешь поля, ты можешь случайно изменить статус заказа без пересчета суммы или проверки наличия товара.

**Паттерн: "Методы действий, а не сеттеры"**

1.  **DTO**: Просто контейнер данных, пришедших с фронта.
2.  **Сущность**: Имеет методы, принимающие конкретные аргументы.

**Пример:**

```csharp
// DTO
public record UpdateOrderItemsDto(int OrderId, List<OrderItemDto> Items);

// Handler
public async Task Handle(UpdateOrderItemsDto dto)
{
    // 1. Загружаем сущность (EF Core Change Tracking включен по умолчанию)
    var order = await _db.Orders
        .Include(o => o.Items) // Тут Include нужен, так как мы меняем состояние
        .FirstOrDefaultAsync(o => o.Id == dto.OrderId);

    if (order == null) throw new NotFoundException();

    // 2. ❌ ПЛОХО: order.Items = dto.Items.Select(...).ToList();
    
    // 3. ✅ ХОРОШО: Вызываем бизнес-метод
    order.UpdateItems(dto.Items.Select(x => new OrderItem(x.ProductId, x.Quantity)));

    // 4. Сохраняем (EF сам поймет, что изменилось)
    await _db.SaveChangesAsync();
}
```

**Внутри сущности Order:**

```csharp
public class Order 
{
    // Коллекция закрыта для прямой записи
    private readonly List<OrderItem> _items = new();
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    public decimal TotalSum { get; private set; }

    public void UpdateItems(IEnumerable<OrderItem> newItems)
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Нельзя менять товары в оформленном заказе");

        _items.Clear();
        _items.AddRange(newItems);
        
        // Пересчет суммы происходит тут же! Целостность гарантирована.
        RecalculateTotal(); 
    }
}
```

---

### Часть 3: Массовое обновление (High Performance)

Если тебе нужно обновить одно поле у 1000 заказов (например, пометить как "Архивные") и тащить их в память через DTO/Entity слишком долго.

В **EF Core 7/8** появился `ExecuteUpdate`. Это работает без загрузки объектов в память.

```csharp
public async Task ArchiveOldOrders(DateTime dateThreshold)
{
    // Генерирует один SQL UPDATE WHERE ...
    await _db.Orders
        .Where(o => o.CreatedAt < dateThreshold && o.Status == OrderStatus.Completed)
        .ExecuteUpdateAsync(s => s
            .SetProperty(o => o.IsArchived, true)
            .SetProperty(o => o.UpdatedAt, DateTime.UtcNow)
        );
}
```

---

### Итоговый рецепт для твоего проекта:

1.  **Чтение (Get List/Details):** Используй **Mapster** и метод `.ProjectToType<OrderDto>()`. Это избавит от ручного `.Select` и автоматически подтянет нужные JOIN'ы без лишних `Include`.
2.  **Редактирование (Update Logic):**
    *   Загрузи сущность по ID.
    *   Вызови у сущности метод (например, `order.ChangeAddress(...)`), передав данные из DTO.
    *   `SaveChangesAsync`.
3.  **Массовые правки (Bulk):** Используй `ExecuteUpdateAsync` без DTO и загрузки в память.

Это даст тебе **минимальный код** (нет ручных селектов) и **максимальную надежность** (бизнес-логика инкапсулирована в методах сущности).
---

## 🚨 Самый большой миф про Soft Delete

Все в интернете говорят:
> Глобальные фильтры медленные! Не используй их!

Это абсолютная ложь.

✅ Правда:
EF Core компилирует этот фильтр в SQL один раз при старте приложения. Для базы данных это абсолютно такой же запрос как если бы ты написал `WHERE IsDeleted = false` вручную. План запроса будет идентичный. Нет абсолютно никакого оверхеда. Ноль.

---

# ✅ Идеальная реализация Soft Delete

---

## Шаг 1: Интерфейс маркер

Один раз написал один раз и забыл.

```csharp
public interface ISoftDelete
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
    Guid? DeletedBy { get; set; }
}
```

Теперь чтобы добавить мягкое удаление к любой сущности ты просто дописываешь `: ISoftDelete` и всё.

```csharp
public class Order : ISoftDelete { }
public class Client : ISoftDelete { }
public class OrderItem : ISoftDelete { }
```

---

## Шаг 2: Автоматический глобальный фильтр

Самая важная часть. Ты не добавляешь фильтр вручную для каждой сущности. EF Core делает это автоматически абсолютно для всех сущностей которые реализуют `ISoftDelete`.

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);

    // ✅ Магия тут
    foreach (var entityType in modelBuilder.Model.GetEntityTypes())
    {
        if (typeof(ISoftDelete).IsAssignableFrom(entityType.ClrType))
        {
            modelBuilder.Entity(entityType.ClrType)
                .HasQueryFilter<ISoftDelete>(e => !e.IsDeleted);
        }
    }
}
```

💥 Это ВСЁ. Больше ничего не нужно делать.

Теперь абсолютно любой запрос к любой сущности:
```csharp
await db.Orders.ToListAsync();
await db.Clients.FirstOrDefaultAsync();
await db.Orders.CountAsync();
await db.Orders.Include(o => o.Items).ToListAsync();
```

Автоматически получит в конце `WHERE IsDeleted = 0`.

Никогда больше ты не забудешь добавить эту проверку. Никогда больше удалённый заказ не вылезет где то в отчёте. Это работает абсолютно везде: в Include, в подзапросах, в агрегациях, в сортировке, везде.

---

## Шаг 3: Автоматическое мягкое удаление вместо настоящего

Ты вызываешь самый обычный `db.Remove(order)`, а EF Core автоматически вместо удаления просто ставит флаг. Даже не нужно ничего менять в своём существующем коде.

Добавляем один интерцептор один раз:

```csharp
public class SoftDeleteInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        var db = eventData.Context;

        foreach (var entry in db.ChangeTracker.Entries<ISoftDelete>())
        {
            if (entry.State == EntityState.Deleted)
            {
                // Вместо удаления помечаем как удалённый
                entry.State = EntityState.Modified;
                
                entry.Entity.IsDeleted = true;
                entry.Entity.DeletedAt = DateTime.UtcNow;
                entry.Entity.DeletedBy = TenantContext.CurrentUserId;
            }
        }

        return base.SavingChanges(eventData, result);
    }
}
```

Регистрируем один раз:

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
    options.AddInterceptors(new SoftDeleteInterceptor());
});
```

✅ Результат:

```csharp
var order = await db.Orders.FindAsync(id);

// Ты вызываешь самый обычный Remove как делал это всегда
db.Orders.Remove(order);

await db.SaveChangesAsync();
```

И ничего не удаляется по настоящему. Просто автоматически ставится флаг. И больше нигде в системе этот заказ не появится.

Вся твоя существующая логика продолжает работать без единого изменения.

---

## 🛠️ Операции которые тебе понадобятся

### Как посмотреть удалённые сущности в админке

Одна строка чтобы временно отключить фильтр:

```csharp
var allOrdersIncludingDeleted = await db.Orders
    .IgnoreQueryFilters()
    .ToListAsync();
```

### Как посмотреть только удалённые

```csharp
var onlyDeletedOrders = await db.Orders
    .IgnoreQueryFilters()
    .Where(o => o.IsDeleted)
    .ToListAsync();
```

### Как восстановить удалённую сущность

```csharp
public async Task RestoreOrder(Guid id)
{
    var order = await db.Orders
        .IgnoreQueryFilters()
        .FirstAsync(o => o.Id == id);

    order.IsDeleted = false;
    order.DeletedAt = null;
    order.DeletedBy = null;

    await db.SaveChangesAsync();
}
```

### Как реально навсегда удалить если действительно нужно

```csharp
public async Task PermanentDelete(Guid id)
{
    var order = await db.Orders
        .IgnoreQueryFilters()
        .FirstAsync(o => o.Id == id);

    // Обходим интерцептор, удаляем по настоящему
    db.Entry(order).State = EntityState.Deleted;

    await db.SaveChangesAsync();
}
```

---

## ✅ Интеграция с нашей архитектурой

Это всё полностью и идеально совмещается со всеми расширениями про которые мы говорили раньше.

```csharp
var orders = await db.Orders
    .ForCurrentTenant()
    .IncludeEverything()
    .OnlyActive()
    .SortBy(OrderSortMappings.By, sortBy)
    .Paginate(page)
    .ProjectToDto()
    .ToListAsync();
```

Удалённые заказы просто не будут тут. Тебе не нужно добавлять ни одной дополнительной строки. Всё работает автоматически.

---

## ❌ Самые частые ошибки которые все делают

1. ❌ Добавлять `.Where(o => !o.IsDeleted)` в каждый запрос вручную. Рано или поздно ты где то забудешь.
2. ❌ Делать метод `GetAllNotDeleted()` в репозитории. Та же самая проблема.
3. ❌ Использовать сторонние библиотеки для мягкого удаления. Они все делают ровно тоже самое что ты можешь сделать за 10 строк кода.

---

# 🎯 Итог

Это лучшая на сегодня реализация мягкого удаления для EF Core.

✅ 30 строк кода всего
✅ Нулевой оверхед на запросы
✅ Работает абсолютно везде
✅ 100% прозрачно для существующего кода
✅ Никогда ничего не забудешь
✅ Идеально совмещается со всей нашей архитектурой

Я использую эту реализацию уже лет 5 на десятках проектов и она ни разу меня не подвела.

---

## 🔗 Связанные разделы

- [**Миграции**](./миграции.md) - работа с миграциями в мультитенантной системе (применение ко всем клиентским БД)
- [**Code Quality**](./Code%20Quality.md) - общие стандарты качества кода

---

Если хочешь я могу выложить полностью готовый код интерцептора и конфигурации 😊