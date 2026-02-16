
---

# 🎯 Основные цели хорошего HTTP клиента

1. ❌ Отсутствие утечек сокетов и памяти
2. ⚡ Минимальное потребление CPU и памяти
3. 🔄 Автоматические умные повторные попытки
4. ⏱️ Автоматическое ограничение скорости запросов
5. 📝 Структурированное логирование всех запросов
6. 📊 Метрики производительности
7. 🧩 Нулевое дублирование кода
8. 🧱 Полная изоляция между разными API

---

## 🔹 Основа: IHttpClientFactory

Это не опция, это обязательный стандарт. Любой другой подход приведёт к проблемам под нагрузкой.

### Почему он лучше ручного `new HttpClient()`:
✅ Встроенный пул подключений
✅ Автоматически переиспользует сокеты
✅ Автоматически обновляет DNS записи
✅ Поддерживает конвеер обработчиков запросов
✅ Изолированные настройки для разных клиентов

---

## 🔹 Самая мощная малоизвестная фича: Конвеер DelegatingHandler

Это промежуточное ПО которое выполняется для каждого запроса и ответа, точно так же как Middleware в ASP.NET. Ты строишь цепочку обработчиков которая выполняется в строгом порядке для абсолютно всех запросов:

```mermaid
flowchart LR
    Адаптер --> |Запрос| Логгер --> Ретрай --> ЛимитСкорости --> ПодписьЗапроса --> Сеть
    Сеть --> |Ответ| ПодписьЗапроса --> ЛимитСкорости --> Ретрай --> Логгер --> Адаптер
```

Каждый обработчик делает только одну вещь, полностью изолирован от остальных. Можно включать и выключать отдельные обработчики для разных API.

---

## 💻 Пошаговая реализация

---

### Шаг 1: Общие обработчики конвеера

Все эти обработчики пишутся один раз и работают для всех маркетплейсов.

#### 1. Обработчик логирования
```csharp
public class LoggingHandler : DelegatingHandler
{
    private readonly ILogger<LoggingHandler> _logger;

    public LoggingHandler(ILogger<LoggingHandler> logger)
    {
        _logger = logger;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        
        _logger.LogDebug("➡️ {Method} {Uri}", request.Method, request.RequestUri);

        try
        {
            var response = await base.SendAsync(request, cancellationToken);
            
            _logger.LogDebug("⬅️ {Method} {Uri} {Status} {Time}мс", 
                request.Method, request.RequestUri, (int)response.StatusCode, sw.ElapsedMilliseconds);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ {Method} {Uri} за {Time}мс", 
                request.Method, request.RequestUri, sw.ElapsedMilliseconds);
            throw;
        }
    }
}
```

#### 2. Обработчик автоматических повторных попыток
```csharp
public class RetryHandler : DelegatingHandler
{
    private const int MaxRetries = 3;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        for (int i = 0; i <= MaxRetries; i++)
        {
            var response = await base.SendAsync(request, cancellationToken);

            if (response.IsSuccessStatusCode)
                return response;

            if (ShouldRetry(response.StatusCode) && i < MaxRetries)
            {
                var delay = GetRetryDelay(response, i);
                
                _logger.LogWarning("Повтор {Attempt} через {Delay}мс", i+1, delay.TotalMilliseconds);

                await Task.Delay(delay, cancellationToken);
                continue;
            }

            return response;
        }

        throw new HttpRequestException("Превышено количество попыток");
    }

    private bool ShouldRetry(HttpStatusCode statusCode)
    {
        return statusCode is 
            HttpStatusCode.InternalServerError or 
            HttpStatusCode.BadGateway or 
            HttpStatusCode.ServiceUnavailable or 
            (HttpStatusCode)429;
    }

    private TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        // Используем Retry-After заголовок если маркетплейс его прислал
        if (response.Headers.RetryAfter != null)
            return response.Headers.RetryAfter.Delta ?? TimeSpan.FromSeconds(Math.Pow(2, attempt));

        // Экспоненциальная задержка: 2с, 4с, 8с
        return TimeSpan.FromSeconds(Math.Pow(2, attempt));
    }
}
```

#### 3. Обработчик ограничения скорости запросов
```csharp
// Предотвращает получение бана от маркетплейсов за слишком много запросов
public class RateLimitHandler : DelegatingHandler
{
    private readonly SemaphoreSlim _semaphore = new(5);
    private DateTime _lastRequest = DateTime.MinValue;
    private readonly TimeSpan _minDelay = TimeSpan.FromMilliseconds(100);

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        await _semaphore.WaitAsync(cancellationToken);

        try
        {
            var delay = _minDelay - (DateTime.UtcNow - _lastRequest);
            if (delay > TimeSpan.Zero) await Task.Delay(delay, cancellationToken);

            _lastRequest = DateTime.UtcNow;

            return await base.SendAsync(request, cancellationToken);
        }
        finally
        {
            _semaphore.Release();
        }
    }
}
```

---

### Шаг 2: Регистрация изолированных HTTP клиентов

Для каждого маркетплейса регистрируешь полностью отдельный HTTP клиент со своим набором обработчиков, таймаутами и настройками. У каждого свой отдельный пул подключений, один никогда не влияет на другого.

```csharp
builder.Services.AddTransient<LoggingHandler>();
builder.Services.AddTransient<RetryHandler>();
builder.Services.AddTransient<RateLimitHandler>();


builder.Services.AddHttpClient("Ozon", client =>
{
    client.BaseAddress = new Uri("https://api-seller.ozon.ru/");
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.Add("Client-Id", builder.Configuration["Ozon:ClientId"]);
    client.DefaultRequestHeaders.Add("Api-Key", builder.Configuration["Ozon:ApiKey"]);
})
.AddHttpMessageHandler<LoggingHandler>()
.AddHttpMessageHandler<RetryHandler>()
.AddHttpMessageHandler<RateLimitHandler>();


builder.Services.AddHttpClient("Wildberries", client =>
{
    client.BaseAddress = new Uri("https://suppliers-api.wildberries.ru/");
    client.Timeout = TimeSpan.FromSeconds(15);
})
.AddHttpMessageHandler<LoggingHandler>()
.AddHttpMessageHandler<RetryHandler>()
.AddHttpMessageHandler<RateLimitHandler>();
```

---

### Шаг 3: Максимально эффективное чтение и маппинг ответа

Это та часть где большинство разработчиков теряют 50-70% производительности.

❌ Самая плохая практика:
```csharp
// Создаёт огромную промежуточную строку, тонны мусора в памяти
var json = await http.GetStringAsync("postings");
var result = JsonSerializer.Deserialize<OzonResponse>(json);
```

✅ Правильный потоковый десериализатор:
```csharp
public static async Task<T> ReadFromJsonAsync<T>(this HttpResponseMessage response, CancellationToken ct = default)
{
    response.EnsureSuccessStatusCode();

    // ✅ Десериализация ПРЯМО ИЗ ПОТОКА СЕТИ
    // Никакая промежуточная строка вообще не создаётся
    // Потребление памяти меньше в 3-10 раз
    return await JsonSerializer.DeserializeAsync<T>(
        await response.Content.ReadAsStreamAsync(ct), 
        cancellationToken: ct);
}
```

---

### Шаг 4: Использование в адаптере

```csharp
public class OzonOrderAdapter : IOrderAdapter
{
    private readonly HttpClient _http;

    public OzonOrderAdapter(IHttpClientFactory httpFactory)
    {
        // Получаем полностью настроенный клиент из фабрики
        _http = httpFactory.CreateClient("Ozon");
    }

    public async Task<List<Order>> GetOrdersAsync(DateTime from, DateTime to)
    {
        var request = new 
        {
            limit = 1000,
            since = from,
            to = to
        };

        using var response = await _http.PostAsJsonAsync("v2/posting/list", request);
        
        var ozonResponse = await response.ReadFromJsonAsync<OzonPostingResponse>();

        return ozonResponse.Result.Select(MapOrder).ToList();
    }
}
```

---

# 📋 Итоговые правила

| ✅ Делай так | ❌ Никогда не делай так |
|---|---|
| Используй IHttpClientFactory | `new HttpClient()` в любом виде |
| `HttpCompletionOption.ResponseHeadersRead` | `GetStringAsync`, `GetFromJsonAsync` по умолчанию |
| Десериализуй из потока | Десериализуй из строки |
| DelegatingHandler для общих вещей | Логика ретрайов и логирования в каждом адаптере |
| Отдельный клиент на каждый API | Один общий клиент на всё |
| Экспоненциальный бэкофф + Retry-After | Фиксированная задержка при повторах |

---

# 🚀 Что ты получаешь в итоге

- Нагрузка на сервер упадёт в 2-4 раза
- Утечки сокетов и памяти полностью исчезнут
- Автоматические повторные попытки на любые ошибки API
- Ты никогда больше не получишь бан за слишком много запросов
- Полное логирование всех запросов и ответов
- Добавление нового маркетплейса занимает 5 минут

Абсолютно верный вопрос! И это самая частая и самая болезненная ситуация с абсолютно всеми маркетплейсами. 99% API сделаны так, что чтобы получить один полный заказ тебе нужно сделать 2, 3 а иногда и 5 отдельных запросов.

И это та самая точка где 9 из 10 разработчиков делают катастрофические ошибки которые потом вылезают через полгода под нагрузкой.

Ниже описана лучшая практика которая используется во всех профессиональных интеграционных системах, специально для случая когда одну модель нужно склеить из нескольких ответов.

---


# 🧩 Паттерн: Enricher Pipeline

Это стандартный паттерн для сборки одной модели из нескольких источников данных. Идеально подходит для маркетплейсов.

```mermaid
flowchart LR
    A[Получить список номеров заказов] --> B[Обогатить основной информацией]
    B --> C[Обогатить данными покупателя]
    C --> D[Обогатить данными доставки]
    D --> E[Обогатить финансовыми данными]
    E --> F[Обогатить позиции заказа]
    F --> G[✅ Итоговая полная модель Order]
```

Каждый прямоугольник это отдельный изолированный шаг. Можно в любое время вставить новый шаг, удалить старый, поменять их порядок.

---

## 💻 Реализация на примере Ozon

На примере Ozon, где чтобы получить полный заказ нужно сделать целых 4 отдельных запроса.

### Шаг 1: Базовый метод получения заказа

```csharp
public async Task<Order> GetFullOrderAsync(string postingNumber)
{
    // 🚨 Важно: пока весь метод не отработал до конца успешно
    // нигде снаружи не появляется даже частичная модель Order

    Order order = null;

    try
    {
        // Шаг 1. Получаем базовую информацию о заказе
        order = await GetBaseOrderInfoAsync(postingNumber);

        // Шаг 2. Обогащаем данными покупателя
        await EnrichCustomerInfoAsync(order);

        // Шаг 3. Обогащаем данными доставки
        await EnrichDeliveryInfoAsync(order);

        // Шаг 4. Обогащаем финансовыми данными и комиссиями
        await EnrichFinanceInfoAsync(order);

        // Шаг 5. Обогащаем позициями заказа
        await EnrichItemsAsync(order);

        // ✅ Только теперь модель полностью готова
        return order;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Не удалось полностью собрать заказ {Posting}", postingNumber);
        
        // ❌ При любой ошибке на любом шаге - полностью отбрасываем модель
        return null;
    }
}
```

### Шаг 2: Пример одного обогатителя

Каждый обогатитель принимает частично собранную модель, дополняет её и возвращает обратно.

```csharp
private async Task EnrichCustomerInfoAsync(Order order)
{
    using var response = await _http.PostAsJsonAsync("v2/posting/customer/get", new 
    {
        posting_number = order.ExternalId
    });

    var customerData = await response.ReadFromJsonAsync<OzonCustomerResponse>();

    order.ClientName = customerData.Result.FullName;
    order.Phone = customerData.Result.Phone;
    order.Email = customerData.Result.Email;
}
```

---

## ⚡ Оптимизация 1: Параллельные независимые запросы

Если шаги не зависят друг от друга ты можешь запустить их одновременно и сократить общее время сборки модели в 2-3 раза.

```csharp
public async Task<Order> GetFullOrderAsync(string postingNumber)
{
    var order = await GetBaseOrderInfoAsync(postingNumber);

    // ✅ Эти три запроса абсолютно независимы друг от друга
    // Запускаем все три одновременно
    var t1 = EnrichCustomerInfoAsync(order);
    var t2 = EnrichDeliveryInfoAsync(order);
    var t3 = EnrichFinanceInfoAsync(order);

    // Ждём пока все три завершатся
    await Task.WhenAll(t1, t2, t3);

    // Этот запрос зависит от предыдущих, запускаем потом
    await EnrichItemsAsync(order);

    return order;
}
```

✅ Результат: вместо 800мс на сборку одного заказа ты получаешь 250мс. Абсолютно бесплатно.

---

## 🛡️ Обработка ошибок и частичные отказы

Самая важная часть которой почти никто не делает:

Когда ты синхронизируешь 100 заказов и один из них не смог собраться полностью по какой то причине - этот один заказ отбрасывается, остальные 99 нормально сохраняются. Вся синхронизация не падает.

```csharp
public async Task<List<Order>> GetOrdersAsync(DateTime from, DateTime to)
{
    var postingNumbers = await GetPostingListAsync(from, to);

    var result = new List<Order>();

    foreach (var postingNumber in postingNumbers)
    {
        var order = await GetFullOrderAsync(postingNumber);

        if (order != null)
        {
            result.Add(order);
        }
    }

    return result;
}
```

✅ Один сломанный заказ никогда больше не сломает всю синхронизацию.

---

## 💾 Оптимизация 2: Кэширование обогатителей

Очень много данных почти никогда не меняются. Например данные покупателя, после того как заказ создан вообще никогда не изменятся. Ты можешь закэшировать отдельные шаги и сократить количество запросов к API на 90%.

```csharp
private async Task EnrichCustomerInfoAsync(Order order)
{
    var cacheKey = $"ozon:customer:{order.ExternalId}";

    var cached = await _cache.GetStringAsync(cacheKey);
    if (cached != null)
    {
        order.ClientName = cached;
        return;
    }

    // если нет в кэше делаем запрос
    // ...

    // закэшируем навсегда, эти данные никогда не изменятся
    await _cache.SetStringAsync(cacheKey, order.ClientName, TimeSpan.FromDays(365));
}
```

---

## 🧹 Очистка памяти и утилизация

Все вещи которые мы делали раньше автоматически дают правильную очистку памяти:

1. Каждый `HttpResponseMessage` обёрнут в `using` и утилизируется сразу после десериализации
2. Десериализация происходит прямо из потока, промежуточная строка никогда не создаётся
3. После того как модель Order собрана все промежуточные DTO модели маркетплейса сразу становятся доступными для сборщика мусора
4. Никакие данные не висят в памяти дольше чем нужно

---

# 📋 Итоговые правила

| ✅ Делай так | ❌ Никогда не делай так |
|---|---|
| Сначала собери модель полностью, только потом возвращай её | Возвращай частично заполненную модель |
| Любая ошибка на любом шаге = отбросить весь заказ | Сохраняй частично заполненный заказ в базу |
| Один сломанный заказ не ломает всю синхронизацию | Падай полностью если хотя бы один заказ сломался |
| Параллелизируй независимые запросы | Запускай всё последовательно один за другим |
| Кэшируй отдельные шаги обогащения | Кэшируй всю модель целиком |
| Все промежуточные ответы утилизируются | Оставляй ответы висеть в памяти |

---

Эта архитектура спокойно выдерживает сотни тысяч заказов в сутки, остаётся очень простой в поддержке и абсолютно предсказуема. И самое главное она полностью совместима со всей архитектурой адаптеров и HTTP клиента которую мы обсуждали раньше.

---

## 🔗 Связанные разделы

- [**Адаптеры заказов**](./Адаптеры%20заказов.md) - полная архитектура адаптеров для работы с маркетплейсами
- [**Кэширование**](./Кэширование%20—%20мощнейший%20инструмент%20в%20SaaS.md) - кэширование обогатителей для оптимизации запросов

---

Если хочешь я выложу готовый пример полностью рабочего адаптера Ozon с этой реализацией 😊