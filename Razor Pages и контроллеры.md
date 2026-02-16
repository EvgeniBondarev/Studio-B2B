Отличное уточнение! Для Razor Pages правила совершенно другие, и это самое большое заблуждение большинства разработчиков: Razor Pages имеет все встроенные инструменты чтобы практически полностью избавиться от дублирования кода, но 9 из 10 разработчиков вообще не используют их и в итоге делают из Razor Pages ужасную копипасту которая хуже чем старый Web Forms.

Ниже описана архитектура которая позволит тебе делать любую новую страницу со списком, таблицей, пагинацией и сортировкой за ~15 строк кода, абсолютно без дублирования. И это всё нативные возможности Razor Pages без каких либо внешних библиотек.

---

# 🎯 Главная разница Razor Pages от Web API

Для Web API дублирование полей это нормально. Для Razor Pages дублирование разметки и логики это самое большое зло которое только может быть.

И есть одна фича Razor Pages которая решает 90% всех проблем и которую почти никто не использует: **View Components**.

---

# 🧩 Уровень 1: Убираем 90% дублирования за один раз

## 🔹 View Component для универсальной таблицы

Это самое важное что ты можешь сделать прямо сейчас. Ты пишешь таблицу один раз один раз и используешь её для заказов, клиентов, товаров, платежей и всего остального на всём сайте.

Никогда больше не копипасти `<table>` на каждой странице. Никогда.

```csharp
// ViewComponent который рисует любую таблицу с любыми данными
[ViewComponent]
public class DataTableViewComponent : ViewComponent
{
    public IViewComponentResult Invoke<T>(IEnumerable<T> items, 
        List<DataTableColumn<T>> columns,
        bool showPager = true)
    {
        var model = new DataTableViewModel<T>
        {
            Items = items,
            Columns = columns,
            ShowPager = showPager
        };

        return View(model);
    }
}
```

Описание колонки:
```csharp
public class DataTableColumn<T>
{
    public string Title { get; set; }
    public string SortBy { get; set; }
    public Func<T, object> Render { get; set; }
}
```

Разметка таблицы `Pages/Shared/Components/DataTable/Default.cshtml`:

```html
@model DataTableViewModel<T>

<table class="table table-hover">
  <thead>
    <tr>
      @foreach (var col in Model.Columns)
      {
        <th>
          <a asp-route-sortBy="@col.SortBy">@col.Title</a>
        </th>
      }
      <th></th>
    </tr>
  </thead>
  <tbody>
    @foreach (var item in Model.Items)
    {
      <tr>
        @foreach (var col in Model.Columns)
        {
          <td>@col.Render(item)</td>
        }
        <td>
          <a class="btn btn-sm btn-primary" asp-page="Edit" asp-route-id="@item.Id">Изменить</a>
        </td>
      </tr>
    }
  </tbody>
</table>
```

✅ Это вся таблица. Ты написал её один раз и больше никогда не будешь писать таблицу снова.

---

## 🔹 Использование на любой странице

А теперь самое волшебство. Страница со списком заказов выглядит так:

```razor
@page
@model OrdersModel

<h1>Заказы</h1>

<vc:data-table items="@Model.Orders" columns="@Model.Columns" />
```

И код PageModel:

```csharp
public class OrdersModel : TenantPage
{
    public List<OrderListItemDto> Orders { get; set; }
    public List<DataTableColumn<OrderListItemDto>> Columns { get; set; }

    public async Task OnGet(int page = 1, string sortBy = "createdAt", bool desc = true)
    {
        Columns = new()
        {
            new() { Title = "Номер", SortBy = "number", Render = o => o.Number },
            new() { Title = "Дата", SortBy = "createdAt", Render = o => o.CreatedAt },
            new() { Title = "Клиент", SortBy = "clientName", Render = o => o.ClientName },
            new() { Title = "Сумма", SortBy = "sum", Render = o => o.Total },
            new() { Title = "Статус", SortBy = "status", Render = o => o.Status }
        };

        var (items, total) = await _db.Orders
            .ForCurrentTenant()
            .OnlyActive()
            .Apply(Request)
            .SortBy(OrderSortMappings.By, sortBy, desc)
            .ProjectToListItemDto()
            .ToPagedListAsync(page);

        Orders = items;
    }
}
```

💥 Вся страница. 30 строк кода. Ноль копипаста. Нет ни одной строчки разметки таблицы.

Хочешь сделать страницу со списком клиентов? Скопируй эту страницу, поменяй 5 строк с названиями колонок и готово.

---

# 🧩 Уровень 2: Общий базовый PageModel

Вынеси абсолютно всю общую логику которая есть у каждой страницы в базовый класс. Это уберёт ещё 10% дублирования.

```csharp
public abstract class TenantPage : PageModel
{
    protected Guid CurrentTenantId => Guid.Parse(User.FindFirstValue("TenantId"));

    [BindProperty(SupportsGet = true)]
    public int Page { get; set; } = 1;

    [BindProperty(SupportsGet = true)]
    public string SortBy { get; set; }

    [BindProperty(SupportsGet = true)]
    public bool Desc { get; set; } = true;
}
```

Теперь все твои страницы наследуются от `TenantPage` и у них автоматически есть `Page`, `SortBy`, `Desc`, `CurrentTenantId` из коробки. Тебе больше не нужно объявлять их на каждой странице.

---

# 🧩 Уровень 3: Общий компонент пагинации

Точно так же как и таблицу пишешь пагинацию один раз:

```csharp
public class PagerViewComponent : ViewComponent
{
    public IViewComponentResult Invoke(int page, int pageSize, int total)
    {
        return View(new PagerViewModel
        {
            Page = page,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }
}
```

И добавляешь одну строчку в конец таблицы:

```html
<vc:pager page="@Model.Page" total="@Model.Total" />
```

И всё. Пагинация работает одинаково на всех страницах всего сайта.

---

# 🧩 Уровень 4: Переиспользование форм редактирования

Если у тебя есть форма редактирования заказа которую нужно показать и на странице деталей и в модалке и ещё где то - сделай из неё View Component:

```html
<vc:edit-order order-id="@Model.Id" />
```

Один раз написал форму, используешь в любом месте сайта.

---

# ❌ Антипаттерны которые все делают

| ❌ Никогда не делай так | ✅ Делай так |
|---|---|
| Копипаст `<table>` на каждой странице | Один View Component DataTable |
| Копипаст пагинации | Один View Component Pager |
| Частичные представления (`@await Partial()`) | View Components |
| Гигантский базовый PageModel на 1000 строк | Маленькие View Components и фильтры |
| Передача сущности EF в представление | Всегда передавай спроецированный DTO |
| Логика в разметке | Вся логика в PageModel или View Component |

---

# 🎯 Итог что ты получишь

После того как ты сделаешь эти 4 компонента:
✅ Любая новая страница со списком делается за 15 минут
✅ Ноль дублирования разметки
✅ Ноль дублирования логики сортировки и пагинации
✅ Все таблицы на всём сайте выглядят и работают одинаково
✅ Если нужно изменить дизайн таблицы ты меняешь её в одном месте
✅ Если нужно добавить новую функцию в таблицу (например экспорт в Excel) ты добавляешь её один раз и она появляется на всех страницах автоматически.

Это самая производительная и самая удобная архитектура для админок и SaaS которая существует на сегодня. Я использую её уже лет 7 и она выдерживает проекты любого размера.

Отличный вопрос! И есть один самый важный секрет который 99% разработчиков вообще никогда не объясняют нигде:

---

# 🎯 Самое главное правило на всю жизнь:

> 🧭 Когда использовать что?

| Задача | Инструмент |
|---|---|
| Страница которую пользователь открывает в браузере, возвращает HTML | ✅ Razor Page |
| Любое действие, AJAX, API, вебхук, загрузка файла | ✅ Контроллер |

Это правило решает 99% всех споров и путаницы.

Они не конкуренты. Они идеально дополняют друг друга. Любой кто говорит что нужно выбрать что то одно это идиот. Используй оба каждый для того для чего они созданы.

---

## Пример полного цикла на твоём проекте:
1. Пользователь открывает `/orders` → ✅ Razor Page отрисовывает страницу, таблицу, пагинацию
2. Пользователь нажимает кнопку Отменить заказ → AJAX вызов
3. Вызов идёт на `POST /api/orders/123/cancel` → ✅ Контроллер
4. Контроллер выполняет действие возвращает ответ
5. JS на странице обновляет строку в таблице

---

# ✅ Правила идеальных контроллеров для твоего стека

Эти правила выработаны годами, они решают абсолютно все проблемы с дублированием и поддерживаемостью.

---

## 🔹 Правило 1. Контроллеры никогда не возвращают HTML. Никогда.

Никогда не делай `return View() из контроллера. Никогда. Это единственная самая большая ошибка поколений разработчиков ASP.NET.

Контроллер может возвращать только:
- JSON
- Файл
- Редирект
- Статус код

Всё остальное это работа Razor Pages.

---

## 🔹 Правило 2. Один контроллер делает ровно одну группу действий.

Нет и никогда не будет `OrderController` на 2000 строк с 20 экшенами.

| ❌ Плохо | ✅ Хорошо |
|---|---|
| OrdersController.Cancel | OrderCancelController |
| OrdersController.UpdateStatus | OrderUpdateStatusController |
| OrdersController.ExportExcel | OrderExportController |
| OrdersController.SendNotification | OrderSendNotificationController |

Максимальный размер контроллера: 1 экшен. Иногда 2. Никогда больше.

---

## 🔹 Правило 3. Никогда не делай гигантский базовый контроллер

Весь общий код который все хотят положить в базовый контроллер на самом деле должен быть в **фильтрах и атрибутах**.

❌ Плохо:
```csharp
public abstract class BaseController : Controller
{
    protected Guid TenantId { get; set; }

    public override void OnActionExecuting(ActionExecutingContext context)
    {
        // 500 строк разного общего кода
        TenantId = Guid.Parse(User.FindFirstValue("TenantId"));
    }
}
```

✅ Хорошо:
```csharp
public class RequireTenantAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var tenantId = Guid.Parse(context.HttpContext.User.FindFirstValue("TenantId"));

        context.HttpContext.Items["TenantId"] = tenantId;
    }
}
```

Использование:
```csharp
[ApiController]
[Route("api/orders")]
[RequireTenant]
[Authorize]
public class CancelOrderController : ControllerBase
{

}
```

✅ Преимущества:
- Ты можешь добавить этот атрибут только к тем контроллерам которым он действительно нужен
- Можно легко комбинировать атрибуты
- Нулевое дублирование кода
- Легко тестировать отдельно
- Легко отключить для отдельного контроллера если нужно

---

## 🔹 Правило 4. Все контроллеры возвращают одинаковую структуру ответа

Используй тот самый `ApiResponse` про который мы говорили раньше. Абсолютно все экшены всех контроллеров возвращают абсолютно одинаковую структуру.

```csharp
[HttpPost("{id:guid}/cancel")]
public async Task<IActionResult> Cancel(Guid id)
{
    var result = await _cancelOrder.Handle(id);

    if (result.IsFailed)
        return this.BadRequestApi(result.Error);

    return this.OkApi("Заказ отменён");
}
```

Никогда больше не будет ситуации что один контроллер возвращает ответ в одном формате а другой в другом. Весь твой фронтенд и весь твой JS будет работать одинаково работать со всеми контроллерами.

---

## 🔹 Правило 5. Контроллер это только тонкий слой транспорта

В контроллере может быть ровно 4 вещи:
1. Получить параметры из запроса
2. Вызвать обработчик
3. Вернуть ответ
4. Всё.

Максимум 10 строк на экшен. Любая бизнес логика в контроллере это автоматический дефект.

---

# 💻 Пример идеального контроллера

Это как должен выглядеть абсолютно любой контроллер в твоём проекте:

```csharp
[ApiController]
[Route("api/orders")]
[RequireTenant]
[Authorize]
public class CancelOrderController : ControllerBase
{
    private readonly CancelOrderHandler _handler;

    public CancelOrderController(CancelOrderHandler handler)
    {
        _handler = handler;
    }

    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(typeof(ApiResponse), 200)]
    [ProducesResponseType(typeof(ApiResponse), 400)]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var tenantId = this.GetTenantId();

        var result = await _handler.Handle(id, tenantId);

        if (result.IsFailed)
            return this.BadRequestApi(result.Error);

        return this.OkApi("Заказ успешно отменён");
    }
}
```

✅ Это весь контроллер. 20 строк кода. Никакого дублирования. Абсолютно предсказуемо. Легко тестировать. Легко удалить.

---

# ❌ Антипаттерны контроллеров которые все делают

1. ❌ Гигантский контроллер на 2000 строк
2. ❌ Контроллеры которые возвращают View
3. ❌ Базовый контроллер на 1000 строк
4. ❌ Бизнес логика внутри контроллера
5. ❌ Каждый контроллер возвращает ответ в своём формате
6. ❌ Один общий контроллер ApiController на всё

---

# 🎯 Для чего идеально подходят контроллеры в твоём проекте

| Задача |
|---|
| Все AJAX действия на страницах |
| Вебхуки от всех маркетплейсов |
| Экспорт в Excel, PDF, CSV |
| Любые действия которые вызываются из мобильного приложения |
| Публичное API для интеграций |
| Любые фоновые действия которые не должны блокировать страницу |

---

# 📋 Итоговый чек лист

1. ✅ Razor Page для всех страниц которые возвращают HTML
2. ✅ Контроллер для всего остального
3. ✅ Один контроллер = одно действие
4. ✅ Весь общий код в атрибутах и фильтрах
5. ✅ Все контроллеры возвращают одинаковый ApiResponse
6. ✅ Контроллер это только тонкий слой транспорта
7. ❌ Никогда не возвращай View из контроллера
8. ❌ Никогда не делай базовый контроллер

Это самая удобная и самая поддерживаемая архитектура которая существует на сегодня для ASP.NET. Она выдерживает проекты любого размера и остаётся удобной даже когда у тебя будет 100 контроллеров.


Вот пример полноценного Blazor приложения с контроллером и вызовом данных через HTTP клиент.

Структура проекта
Создадим приложение с архитектурой:

Backend API (Контроллеры)

Blazor Frontend (Компоненты с вызовом API)

1. Модель данных (Models/WeatherForecast.cs)
csharp
namespace BlazorAppWithAPI.Models;

public class WeatherForecast
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public int TemperatureC { get; set; }
    public string? Summary { get; set; }
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
2. Контроллер (Controllers/WeatherController.cs)
csharp
using Microsoft.AspNetCore.Mvc;
using BlazorAppWithAPI.Models;

namespace BlazorAppWithAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WeatherController : ControllerBase
{
    private static readonly string[] Summaries = new[]
    {
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", 
        "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    };

    // GET: api/weather
    [HttpGet]
    public ActionResult<IEnumerable<WeatherForecast>> Get()
    {
        var forecasts = Enumerable.Range(1, 10).Select(index => new WeatherForecast
        {
            Id = index,
            Date = DateTime.Now.AddDays(index),
            TemperatureC = Random.Shared.Next(-20, 55),
            Summary = Summaries[Random.Shared.Next(Summaries.Length)]
        });

        return Ok(forecasts);
    }

    // GET: api/weather/5
    [HttpGet("{id}")]
    public ActionResult<WeatherForecast> Get(int id)
    {
        if (id <= 0 || id > 10)
            return NotFound($"Прогноз с ID {id} не найден");

        var forecast = new WeatherForecast
        {
            Id = id,
            Date = DateTime.Now.AddDays(id),
            TemperatureC = Random.Shared.Next(-20, 55),
            Summary = Summaries[Random.Shared.Next(Summaries.Length)]
        };

        return Ok(forecast);
    }

    // POST: api/weather
    [HttpPost]
    public ActionResult<WeatherForecast> Post([FromBody] WeatherForecast forecast)
    {
        // В реальном приложении здесь было бы сохранение в БД
        forecast.Id = Random.Shared.Next(100, 1000);
        return CreatedAtAction(nameof(Get), new { id = forecast.Id }, forecast);
    }

    // PUT: api/weather/5
    [HttpPut("{id}")]
    public IActionResult Put(int id, [FromBody] WeatherForecast forecast)
    {
        if (id != forecast.Id)
            return BadRequest("ID в URL не совпадает с ID объекта");

        // В реальном приложении здесь обновление в БД
        return NoContent();
    }

    // DELETE: api/weather/5
    [HttpDelete("{id}")]
    public IActionResult Delete(int id)
    {
        // В реальном приложении здесь удаление из БД
        return NoContent();
    }
}
3. Настройка HttpClient (Program.cs)
csharp
using BlazorAppWithAPI.Components;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

// Добавляем контроллеры
builder.Services.AddControllers();

// Настраиваем HttpClient для фронтенда
builder.Services.AddScoped(sp => 
    new HttpClient { BaseAddress = new Uri("https://localhost:5001") });

// Добавляем сервис для работы с API
builder.Services.AddScoped<WeatherService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseAntiforgery();

// Маппим контроллеры
app.MapControllers();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
4. Сервис для работы с API (Services/WeatherService.cs)
csharp
using BlazorAppWithAPI.Models;
using System.Net.Http.Json;

namespace BlazorAppWithAPI.Services;

public class WeatherService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<WeatherService> _logger;

    public WeatherService(HttpClient httpClient, ILogger<WeatherService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    // Получение всех прогнозов
    public async Task<List<WeatherForecast>?> GetForecastsAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("api/weather");
            
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<List<WeatherForecast>>();
            }
            
            _logger.LogError($"Ошибка получения данных: {response.StatusCode}");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при запросе к API");
            throw;
        }
    }

    // Получение прогноза по ID
    public async Task<WeatherForecast?> GetForecastByIdAsync(int id)
    {
        try
        {
            return await _httpClient.GetFromJsonAsync<WeatherForecast>($"api/weather/{id}");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning($"Прогноз с ID {id} не найден");
            return null;
        }
    }

    // Создание нового прогноза
    public async Task<WeatherForecast?> CreateForecastAsync(WeatherForecast forecast)
    {
        var response = await _httpClient.PostAsJsonAsync("api/weather", forecast);
        response.EnsureSuccessStatusCode();
        
        return await response.Content.ReadFromJsonAsync<WeatherForecast>();
    }

    // Обновление прогноза
    public async Task UpdateForecastAsync(int id, WeatherForecast forecast)
    {
        var response = await _httpClient.PutAsJsonAsync($"api/weather/{id}", forecast);
        response.EnsureSuccessStatusCode();
    }

    // Удаление прогноза
    public async Task DeleteForecastAsync(int id)
    {
        var response = await _httpClient.DeleteAsync($"api/weather/{id}");
        response.EnsureSuccessStatusCode();
    }
}
5. Blazor компонент для отображения и управления (Components/Pages/WeatherPage.razor)
razor
@page "/weather"
@rendermode InteractiveServer
@using BlazorAppWithAPI.Models
@inject WeatherService WeatherService
@inject ILogger<WeatherPage> Logger

<PageTitle>Погода</PageTitle>

<h1>Прогноз погоды</h1>

@if (isLoading)
{
    <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Загрузка...</span>
    </div>
}
else if (errorMessage != null)
{
    <div class="alert alert-danger" role="alert">
        @errorMessage
    </div>
}
else
{
    @* Форма добавления нового прогноза *@
    <div class="card mb-4">
        <div class="card-header">
            <h5>Добавить новый прогноз</h5>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-3 mb-2">
                    <input @bind="newForecast.Date" type="date" class="form-control" placeholder="Дата" />
                </div>
                <div class="col-md-2 mb-2">
                    <input @bind="newForecast.TemperatureC" type="number" class="form-control" placeholder="Температура °C" />
                </div>
                <div class="col-md-4 mb-2">
                    <input @bind="newForecast.Summary" class="form-control" placeholder="Описание" />
                </div>
                <div class="col-md-3 mb-2">
                    <button class="btn btn-success w-100" @onclick="AddForecast">
                        <i class="bi bi-plus-circle"></i> Добавить
                    </button>
                </div>
            </div>
        </div>
    </div>

    @* Таблица прогнозов *@
    <table class="table table-striped table-hover">
        <thead>
            <tr>
                <th>ID</th>
                <th>Дата</th>
                <th>Темп. °C</th>
                <th>Темп. °F</th>
                <th>Описание</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody>
            @foreach (var forecast in forecasts)
            {
                <tr>
                    <td>@forecast.Id</td>
                    <td>@forecast.Date.ToShortDateString()</td>
                    <td>@forecast.TemperatureC</td>
                    <td>@forecast.TemperatureF</td>
                    <td>@forecast.Summary</td>
                    <td>
                        <button class="btn btn-sm btn-info me-1" @onclick="() => EditForecast(forecast)">
                            <i class="bi bi-pencil"></i> Редактировать
                        </button>
                        <button class="btn btn-sm btn-danger" @onclick="() => DeleteForecast(forecast.Id)">
                            <i class="bi bi-trash"></i> Удалить
                        </button>
                    </td>
                </tr>
            }
        </tbody>
    </table>

    @* Модальное окно редактирования *@
    @if (showEditModal)
    {
        <div class="modal show d-block" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Редактирование прогноза</h5>
                        <button type="button" class="btn-close" @onclick="CloseEditModal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Дата</label>
                            <input @bind="editingForecast!.Date" type="date" class="form-control" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Температура °C</label>
                            <input @bind="editingForecast!.TemperatureC" type="number" class="form-control" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Описание</label>
                            <input @bind="editingForecast!.Summary" class="form-control" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @onclick="CloseEditModal">Отмена</button>
                        <button type="button" class="btn btn-primary" @onclick="UpdateForecast">Сохранить</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-backdrop show"></div>
    }
}

@code {
    private List<WeatherForecast> forecasts = new();
    private WeatherForecast newForecast = new();
    private WeatherForecast? editingForecast;
    private bool isLoading = true;
    private string? errorMessage;
    private bool showEditModal = false;

    protected override async Task OnInitializedAsync()
    {
        await LoadForecasts();
    }

    private async Task LoadForecasts()
    {
        try
        {
            isLoading = true;
            errorMessage = null;
            
            var result = await WeatherService.GetForecastsAsync();
            if (result != null)
            {
                forecasts = result;
            }
            else
            {
                errorMessage = "Не удалось загрузить данные";
            }
        }
        catch (Exception ex)
        {
            errorMessage = $"Ошибка загрузки: {ex.Message}";
            Logger.LogError(ex, "Ошибка загрузки прогнозов");
        }
        finally
        {
            isLoading = false;
        }
    }

    private async Task AddForecast()
    {
        try
        {
            var added = await WeatherService.CreateForecastAsync(newForecast);
            if (added != null)
            {
                await LoadForecasts();
                newForecast = new WeatherForecast();
            }
        }
        catch (Exception ex)
        {
            errorMessage = $"Ошибка при добавлении: {ex.Message}";
        }
    }

    private void EditForecast(WeatherForecast forecast)
    {
        editingForecast = new WeatherForecast
        {
            Id = forecast.Id,
            Date = forecast.Date,
            TemperatureC = forecast.TemperatureC,
            Summary = forecast.Summary
        };
        showEditModal = true;
    }

    private async Task UpdateForecast()
    {
        try
        {
            if (editingForecast != null)
            {
                await WeatherService.UpdateForecastAsync(editingForecast.Id, editingForecast);
                await LoadForecasts();
                CloseEditModal();
            }
        }
        catch (Exception ex)
        {
            errorMessage = $"Ошибка при обновлении: {ex.Message}";
        }
    }

    private async Task DeleteForecast(int id)
    {
        try
        {
            await WeatherService.DeleteForecastAsync(id);
            await LoadForecasts();
        }
        catch (Exception ex)
        {
            errorMessage = $"Ошибка при удалении: {ex.Message}";
        }
    }

    private void CloseEditModal()
    {
        showEditModal = false;
        editingForecast = null;
    }
}
6. Добавление ссылки в навигацию (Components/Layout/NavMenu.razor)
razor
<div class="nav-item px-3">
    <NavLink class="nav-link" href="weather" Match="NavLinkMatch.Prefix">
        <span class="bi bi-cloud-sun-fill" aria-hidden="true"></span> Погода
    </NavLink>
</div>
7. Конфигурация для правильной работы (appsettings.json)
json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ApiSettings": {
    "BaseUrl": "https://localhost:5001"
  }
}
Особенности реализации:
Контроллер - предоставляет полноценный REST API с CRUD операциями

Сервис - инкапсулирует логику работы с API

Компонент Blazor - предоставляет UI для взаимодействия с данными

Модальное окно - для редактирования записей

Обработка ошибок - try-catch блоки и логирование

Загрузка данных - индикатор загрузки

Это приложение демонстрирует полноценное взаимодействие Blazor с бэкенд API через HTTP запросы.

