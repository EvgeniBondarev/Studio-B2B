Это базовый слой, без которого SaaS не взлетит. И здесь тоже есть свои нюансы мульти-тенанта.

У тебя **два типа пользователей**:
1.  **Владелец Аккаунта (Account Owner):** Тот, кто регистрируется на сайте `mysaas.com`, платит деньги и создает компанию.
2.  **Сотрудник Компании (User):** Тот, кого пригласил Владелец. Он заходит на `company.mysaas.com`.

---

### 1. Регистрация Владельца (Sign Up Flow)

Это процесс создания **новой базы данных (Тенанта)**.

1.  **Форма на лендинге:** Email, Password, Company Name, Subdomain (например, `apple`).
2.  **Валидация:** Проверяем уникальность Email (в MasterDB) и Subdomain (в MasterDB).
3.  **Транзакция создания:**
    *   Создать запись `Tenant` в `MasterDbContext`.
    *   Запустить миграции для новой базы `Tenant_Apple`.
    *   Запустить `TenantSeeder` (наполнить статусами, ролями).
    *   Создать пользователя `Admin` в `Tenant_Apple` (таблица `AspNetUsers`).
    *   Выдать ему роль `Administrator`.
4.  **Отправка письма:** Ссылка на подтверждение Email.

---

### 2. Приглашение Сотрудника (Invite Flow)

Владелец не регистрирует сотрудников вручную (пароли придумывать — плохая практика). Он отправляет **Приглашение**.

1.  **Админка Владельца:** Страница "Сотрудники" -> Кнопка "Пригласить".
2.  **Ввод:** Email, Роль (например, "Менеджер").
3.  **Бэкенд:**
    *   Генерирует уникальный токен приглашения.
    *   Сохраняет в таблицу `TenantDb.Invites` (Email, RoleId, Token, ExpiresAt).
    *   Отправляет письмо: *"Вас пригласили в компанию Apple. Нажмите, чтобы присоединиться"*.
4.  **Ссылка:** Ведет на `https://apple.mysaas.com/join?token=xyz`.
5.  **Принятие:** Сотрудник переходит, вводит свои ФИО и Пароль -> Создается User -> Привязывается Роль -> Удаляется Инвайт.

---

### 3. Аутентификация (Login Flow)

Здесь важно понимать: **Где мы храним пользователей?**
В мульти-тенанте с изолированными базами (как у нас) пользователи хранятся **в базе Тенанта**.
Это значит, что пользователь `ivan@mail.ru` может быть зарегистрирован в компании А и в компании Б с разными паролями.

**Процесс входа:**
1.  Пользователь заходит на `apple.mysaas.com`.
2.  Вводит Email/Password.
3.  Бэкенд (Identity) ищет пользователя в `Tenant_Apple.AspNetUsers`.
4.  Если ок -> Выдает **JWT Token** (или Cookie).
5.  В токене зашиты Claims: `Sub` (UserId), `TenantId`, `Role`, `Permissions` (список прав).

---

### 4. Подтверждение Почты (Email Confirmation)

Это обязательно для защиты от спама и ботов.

**Как реализовать правильно:**
Не используй стандартный `UserManager.GenerateEmailConfirmationTokenAsync` в лоб, если у тебя SPA (React/Blazor WASM).

**Лучший флоу:**
1.  **Генерация:** При регистрации создаем код (например, 6 цифр или длинный токен).
2.  **Отправка:** Шлем письмо через SendGrid/Mailgun.
3.  **Ссылка:** `https://apple.mysaas.com/verify-email?userId=...&code=...`.
4.  **API:** Эндпоинт `POST /api/auth/confirm-email`.
5.  **Важно:** Пока почта не подтверждена (`EmailConfirmed == false`), пускать в систему нельзя (Middleware `RequireConfirmedEmail`).

---

### 5. Забыли пароль (Forgot Password)

1.  **Форма:** Ввод Email.
2.  **Бэкенд:** Генерирует токен сброса.
3.  **Письмо:** Ссылка на `https://apple.mysaas.com/reset-password?token=...`.
4.  **Важно:** Если email не найден — **никогда не говори об этом**. Пиши: *"Если такой email существует, мы отправили инструкцию"*. Это защита от перебора пользователей (User Enumeration Attack).

---

### 6. Техническая реализация (Identity + JWT)

В `Program.cs` клиента (или общем):

```csharp
// Настройка Identity
builder.Services.AddIdentity<ApplicationUser, ApplicationRole>(options =>
{
    options.SignIn.RequireConfirmedAccount = true; // Требовать подтверждение
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<TenantDbContext>()
.AddDefaultTokenProviders();

// Настройка JWT Bearer
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
    };
});
```

### Итоговый чек-лист безопасности Auth:

1.  **HTTPS:** Только защищенное соединение.
2.  **HttpOnly Cookies:** Если используешь куки, запрети доступ из JS (защита от XSS).
3.  **CSRF Protection:** Если используешь куки, нужен Antiforgery Token.
4.  **Rate Limiting:** Ограничь попытки входа (5 раз в минуту), чтобы не сбрутили пароль.
5.  **2FA (Двухфакторка):** В будущем — добавь TOTP (Google Authenticator) для админов.

С таким подходом ты закрываешь все сценарии входа, регистрации и безопасности для B2B клиентов.