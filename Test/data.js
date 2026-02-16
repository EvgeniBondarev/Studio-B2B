// ============================================================
// MOCK DATA — все захардкоженные данные прототипа
// ============================================================

const STATUSES = [
    { id: 1, name: 'Новый', css: 'status-new', isFinal: false },
    { id: 2, name: 'В работе', css: 'status-in-work', isFinal: false },
    { id: 3, name: 'Заказан', css: 'status-ordered', isFinal: false },
    { id: 4, name: 'Отгружен', css: 'status-shipped', isFinal: false },
    { id: 5, name: 'Доставлен', css: 'status-delivered', isFinal: true },
    { id: 6, name: 'Возврат', css: 'status-returned', isFinal: true },
    { id: 7, name: 'Отменён', css: 'status-cancelled', isFinal: true },
];

// --- Status Mappings (Вавилонская башня статусов) ---
const STATUS_MAPPINGS = [
    // Ozon mappings
    { id: 1, tenantId: null, source: 'Ozon', externalKey: 'awaiting_packaging', externalName: 'Ожидает упаковки', internalStatusId: 2 },
    { id: 2, tenantId: null, source: 'Ozon', externalKey: 'awaiting_deliver', externalName: 'Ожидает доставки', internalStatusId: 3 },
    { id: 3, tenantId: null, source: 'Ozon', externalKey: 'delivering', externalName: 'Доставляется', internalStatusId: 4 },
    { id: 4, tenantId: null, source: 'Ozon', externalKey: 'delivered', externalName: 'Доставлен', internalStatusId: 5 },
    { id: 5, tenantId: null, source: 'Ozon', externalKey: 'cancelled', externalName: 'Отменен', internalStatusId: 7 },
    
    // Wildberries mappings
    { id: 6, tenantId: null, source: 'Wildberries', externalKey: 'confirm', externalName: 'Подтвержден', internalStatusId: 2 },
    { id: 7, tenantId: null, source: 'Wildberries', externalKey: 'sold', externalName: 'Продан', internalStatusId: 5 },
    { id: 8, tenantId: null, source: 'Wildberries', externalKey: 'canceled', externalName: 'Отменен', internalStatusId: 7 },
    
    // Yandex Market mappings
    { id: 9, tenantId: null, source: 'Yandex Market', externalKey: 'PROCESSING', externalName: 'В обработке', internalStatusId: 2 },
    { id: 10, tenantId: null, source: 'Yandex Market', externalKey: 'SHIPPED', externalName: 'Отправлен', internalStatusId: 4 },
    { id: 11, tenantId: null, source: 'Yandex Market', externalKey: 'DELIVERED', externalName: 'Доставлен', internalStatusId: 5 },
    { id: 12, tenantId: null, source: 'Yandex Market', externalKey: 'CANCELLED', externalName: 'Отменен', internalStatusId: 7 },
    
    // 1C mappings
    { id: 13, tenantId: null, source: '1C', externalKey: 'Утвержден', externalName: 'Утвержден', internalStatusId: 2 },
    { id: 14, tenantId: null, source: '1C', externalKey: 'КОтгрузке', externalName: 'К отгрузке', internalStatusId: 3 },
    { id: 15, tenantId: null, source: '1C', externalKey: 'Закрыт', externalName: 'Закрыт', internalStatusId: 5 },
    
    // Пример пользовательского маппинга (переопределение для конкретного тенанта)
    { id: 16, tenantId: 1, source: 'Ozon', externalKey: 'awaiting_packaging', externalName: 'Ожидает упаковки', internalStatusId: 1 }, // Переопределили на "Новый"
    
    // Неизвестные статусы (для демонстрации)
    { id: 17, tenantId: 1, source: 'Wildberries', externalKey: 'refused_by_client', externalName: 'Отказ клиента', internalStatusId: null }, // Не настроен
];

// --- Status Transitions (граф разрешённых переходов) ---
const STATUS_TRANSITIONS = [
    { id: 1, fromStatusId: 1, toStatusId: 2, allowedDefinitionId: 1, validationRules: {} },
    { id: 2, fromStatusId: 2, toStatusId: 3, allowedDefinitionId: 2, validationRules: { requireSupplier: true } },
    { id: 3, fromStatusId: 2, toStatusId: 4, allowedDefinitionId: 3, validationRules: { requireWarehouse: true } },
    { id: 4, fromStatusId: 3, toStatusId: 3, allowedDefinitionId: 4, validationRules: {} },
    { id: 5, fromStatusId: 3, toStatusId: 5, allowedDefinitionId: 5, validationRules: { requireStockCheck: true } },
    { id: 6, fromStatusId: 5, toStatusId: 6, allowedDefinitionId: 6, validationRules: { requireReturnReason: true } },
    { id: 7, fromStatusId: 1, toStatusId: 7, allowedDefinitionId: 7, validationRules: {} },
    { id: 8, fromStatusId: 2, toStatusId: 7, allowedDefinitionId: 7, validationRules: {} },
    { id: 9, fromStatusId: 3, toStatusId: 7, allowedDefinitionId: 7, validationRules: {} },
];

// --- Pipeline Steps ---
const PIPELINE_STEPS = [
    { key: 'validate', name: 'Валидация', icon: 'bi-shield-check', desc: 'Проверка графа переходов и бизнес-правил' },
    { key: 'ledger', name: 'Склад/Финансы', icon: 'bi-box-seam', desc: 'Складские и финансовые движения' },
    { key: 'commit', name: 'Фиксация', icon: 'bi-database-check', desc: 'Смена статуса и сохранение в БД' },
    { key: 'onec', name: 'Отправка в 1С', icon: 'bi-link-45deg', desc: 'Создание документа в 1С (Hangfire)' },
    { key: 'notify', name: 'Уведомления', icon: 'bi-bell', desc: 'SignalR уведомление пользователю' },
];

// --- Order fields for mapping ---
const ORDER_FIELDS = [
    'Order.SupplierId', 'Order.DeliveryDate', 'Order.ShipmentWarehouse',
    'Order.ClientId', 'Order.Comment', 'Order.TrackingNumber',
    'Order.ExpectedDate', 'Order.PurchasePrice',
];

// --- Notifications ---
const NOTIFICATIONS = [
    { id: 1, date: '2026-02-14 22:10', text: 'Транзакция "Заказ поставщику" для OZ-100006 проведена', type: 'success', read: false },
    { id: 2, date: '2026-02-14 22:05', text: 'Ошибка отправки в 1С: OZ-100008 — timeout 15s', type: 'error', read: false },
    { id: 3, date: '2026-02-14 21:30', text: 'Синхронизация Ozon завершена: 3 новых заказа', type: 'info', read: false },
    { id: 4, date: '2026-02-13 18:00', text: 'Транзакция "Принять в работу" для WB-100003 проведена', type: 'success', read: true },
    { id: 5, date: '2026-02-13 15:20', text: 'Документ 1С DOC-001005 успешно создан', type: 'success', read: true },
    { id: 6, date: '2026-02-12 10:00', text: 'Архивация: 2 заказа перемещены в архив', type: 'info', read: true },
];

// --- Archived Orders ---
const ARCHIVED_ORDERS = [
    {
        id: 101,
        number: 'OZ-100101',
        date: '2025-12-01',
        marketplace: 'Ozon',
        statusId: 5,
        clientId: 1,
        supplierId: 1,
        shipmentWarehouse: 'Ozon Хоругвино',
        products: [
            { article: 'ART-001', name: 'Кроссовки Nike Air Max', quantity: 1, price: 8500, sum: 8500 }
        ],
        totalSum: 8500,
        archivedAt: '2026-01-15',
        archivedReason: 'Заказ выполнен'
    },
    {
        id: 102,
        number: 'WB-100102',
        date: '2025-11-28',
        marketplace: 'Wildberries',
        statusId: 7,
        clientId: 2,
        supplierId: 2,
        shipmentWarehouse: 'WB Коледино',
        products: [
            { article: 'ART-002', name: 'Футболка Adidas Originals', quantity: 2, price: 3200, sum: 6400 }
        ],
        totalSum: 6400,
        archivedAt: '2026-01-20',
        archivedReason: 'Заказ отменен'
    }
];

// --- Users and Roles Management ---
// Mock current company/tenant
const CURRENT_COMPANY = {
    id: 1,
    name: 'Demo Company',
    subdomain: 'demo',
    plan: 'Pro'
};

// Permissions
const PERMISSIONS = [
    { id: 1, key: 'orders.view', name: 'Просмотр заказов' },
    { id: 2, key: 'orders.edit', name: 'Редактирование заказов' },
    { id: 3, key: 'orders.delete', name: 'Удаление заказов' },
    { id: 4, key: 'transactions.view', name: 'Просмотр транзакций' },
    { id: 5, key: 'transactions.execute', name: 'Выполнение транзакций' },
    { id: 6, key: 'clients.view', name: 'Просмотр клиентов' },
    { id: 7, key: 'clients.edit', name: 'Редактирование клиентов' },
    { id: 8, key: 'suppliers.view', name: 'Просмотр поставщиков' },
    { id: 9, key: 'suppliers.edit', name: 'Редактирование поставщиков' },
    { id: 10, key: 'warehouses.view', name: 'Просмотр складов' },
    { id: 11, key: 'warehouses.edit', name: 'Редактирование складов' },
    { id: 12, key: 'settings.view', name: 'Просмотр настроек' },
    { id: 13, key: 'settings.edit', name: 'Редактирование настроек' },
    { id: 14, key: '1c.view', name: 'Просмотр интеграции 1С' },
    { id: 15, key: '1c.edit', name: 'Редактирование интеграции 1С' },
    { id: 16, key: 'transactions.constructor', name: 'Конструктор транзакций' },
    { id: 17, key: 'users.view', name: 'Просмотр пользователей' },
    { id: 18, key: 'users.edit', name: 'Управление пользователями' },
    { id: 19, key: 'roles.view', name: 'Просмотр ролей' },
    { id: 20, key: 'roles.edit', name: 'Управление ролями' },
];

// Roles
const ROLES = [
    { id: 1, name: 'Администратор', description: 'Полный доступ ко всем функциям' },
    { id: 2, name: 'Менеджер', description: 'Управление заказами и транзакциями' },
    { id: 3, name: 'Бухгалтер', description: 'Доступ к финансам и 1С' },
    { id: 4, name: 'Пользователь', description: 'Только просмотр' },
];

// Role-Permission mapping
const ROLE_PERMISSIONS = [
    // Admin: all permissions
    ...PERMISSIONS.map(p => ({ roleId: 1, permissionId: p.id })),
    // Manager: orders, transactions, clients, suppliers
    { roleId: 2, permissionId: 1 }, { roleId: 2, permissionId: 2 }, { roleId: 2, permissionId: 4 }, { roleId: 2, permissionId: 5 },
    { roleId: 2, permissionId: 6 }, { roleId: 2, permissionId: 7 }, { roleId: 2, permissionId: 8 }, { roleId: 2, permissionId: 9 },
    // Accountant: 1C, settings view, transactions view
    { roleId: 3, permissionId: 4 }, { roleId: 3, permissionId: 14 }, { roleId: 3, permissionId: 15 }, { roleId: 3, permissionId: 12 },
    // User: view only
    { roleId: 4, permissionId: 1 }, { roleId: 4, permissionId: 4 }, { roleId: 4, permissionId: 6 }, { roleId: 4, permissionId: 8 },
    { roleId: 4, permissionId: 10 }, { roleId: 4, permissionId: 12 }, { roleId: 4, permissionId: 14 },
];

// Users
const USERS = [
    { id: 1, email: 'admin@demo.ru', name: 'Администратор', isEmailVerified: true, isActive: true, createdAt: '2025-01-01', lastLogin: '2026-02-14' },
    { id: 2, email: 'manager@demo.ru', name: 'Менеджер Иванов', isEmailVerified: true, isActive: true, createdAt: '2025-02-01', lastLogin: '2026-02-13' },
    { id: 3, email: 'accountant@demo.ru', name: 'Бухгалтер Петрова', isEmailVerified: false, isActive: true, createdAt: '2025-03-01', lastLogin: null },
    { id: 4, email: 'user@demo.ru', name: 'Пользователь Сидоров', isEmailVerified: true, isActive: false, createdAt: '2025-04-01', lastLogin: null },
];

// Company Users (linking users to company)
const COMPANY_USERS = USERS.map(u => ({ companyId: 1, userId: u.id }));

// User Roles
const USER_ROLES = [
    { userId: 1, roleId: 1 }, // admin
    { userId: 2, roleId: 2 }, // manager
    { userId: 3, roleId: 3 }, // accountant
    { userId: 4, roleId: 4 }, // user
];

// Helper functions
function getUser(userId) {
    return USERS.find(u => u.id === userId);
}

function getRole(roleId) {
    return ROLES.find(r => r.id === roleId);
}

function getUserRoles(userId) {
    return USER_ROLES.filter(ur => ur.userId === userId).map(ur => getRole(ur.roleId));
}

function getUserPermissions(userId) {
    const roles = getUserRoles(userId);
    const permIds = ROLE_PERMISSIONS.filter(rp => roles.some(r => r.id === rp.roleId)).map(rp => rp.permissionId);
    return PERMISSIONS.filter(p => permIds.includes(p.id));
}

function hasPermission(userId, permKey) {
    return getUserPermissions(userId).some(p => p.key === permKey);
}

const MARKETPLACES = ['Ozon', 'Wildberries', 'Yandex Market'];

const MP_CSS = {
    'Ozon': 'mp-ozon',
    'Wildberries': 'mp-wildberries',
    'Yandex Market': 'mp-yandex',
};

// --- Clients ---
const CLIENTS = [
    { id: 1, name: 'ООО "Альфа Трейд"', inn: '7701234567', warehouse: 'Склад Альфа', ordersCount: 12 },
    { id: 2, name: 'ИП Петров С.А.', inn: '770987654321', warehouse: 'Склад Петров', ordersCount: 8 },
    { id: 3, name: 'ООО "Гамма Логистик"', inn: '7703456789', warehouse: 'Склад Гамма', ordersCount: 5 },
    { id: 4, name: 'ООО "Дельта"', inn: '7704567890', warehouse: 'Склад Дельта', ordersCount: 3 },
];

// --- Suppliers ---
const SUPPLIERS = [
    { id: 1, name: 'ООО "Поставщик №1"', fullName: 'ООО "Поставщик Номер Один"', inn: '5001234567', vat: true, ordersCount: 15 },
    { id: 2, name: 'ИП Иванов', fullName: 'ИП Иванов Иван Иванович', inn: '500987654321', vat: false, ordersCount: 9 },
    { id: 3, name: 'ООО "МегаОпт"', fullName: 'ООО "МегаОпт Групп"', inn: '5003456789', vat: true, ordersCount: 6 },
    { id: 4, name: 'ООО "ТрансСнаб"', fullName: 'ООО "ТрансСнаб Логистика"', inn: '5004567890', vat: false, ordersCount: 2 },
];

// --- Warehouse mappings ---
const WAREHOUSE_MAPPINGS = [
    { id: 1, marketplaceName: 'Ozon Хоругвино', oneCName: 'Основной склад', marketplace: 'Ozon' },
    { id: 2, marketplaceName: 'Ozon Пушкино', oneCName: 'Склад Пушкино', marketplace: 'Ozon' },
    { id: 3, marketplaceName: 'WB Коледино', oneCName: 'Склад Коледино', marketplace: 'Wildberries' },
    { id: 4, marketplaceName: 'WB Электросталь', oneCName: 'Склад Электросталь', marketplace: 'Wildberries' },
    { id: 5, marketplaceName: 'Яндекс Софьино', oneCName: 'Склад Софьино', marketplace: 'Yandex Market' },
];

// --- 1C Warehouses (from API) ---
const ONEC_WAREHOUSES = [
    { name: 'Основной склад', link: 'e1c://warehouse/001' },
    { name: 'Склад Пушкино', link: 'e1c://warehouse/002' },
    { name: 'Склад Коледино', link: 'e1c://warehouse/003' },
    { name: 'Склад Электросталь', link: 'e1c://warehouse/004' },
    { name: 'Склад Софьино', link: 'e1c://warehouse/005' },
];

// --- 1C Treaties ---
const ONEC_TREATIES = [
    { name: 'Договор поставки №12', link: 'e1c://treaty/001', partner: 'ООО "Поставщик №1"', inn: '5001234567' },
    { name: 'Договор поставки №34', link: 'e1c://treaty/002', partner: 'ИП Иванов', inn: '500987654321' },
    { name: 'Договор поставки №56', link: 'e1c://treaty/003', partner: 'ООО "МегаОпт"', inn: '5003456789' },
];

// --- 1C Suppliers (from API) ---
const ONEC_SUPPLIERS = [
    { name: 'Поставщик №1', fullName: 'ООО "Поставщик Номер Один"', inn: '5001234567', link: 'e1c://supplier/001' },
    { name: 'Иванов', fullName: 'ИП Иванов Иван Иванович', inn: '500987654321', link: 'e1c://supplier/002' },
    { name: 'МегаОпт', fullName: 'ООО "МегаОпт Групп"', inn: '5003456789', link: 'e1c://supplier/003' },
    { name: 'ТрансСнаб', fullName: 'ООО "ТрансСнаб Логистика"', inn: '5004567890', link: 'e1c://supplier/004' },
];

// --- Transaction Definitions ---
const TRANSACTION_DEFINITIONS = [
    {
        id: 1, name: 'Принять в работу', fromStatusId: 1, toStatusId: 2,
        oneCDocType: null, active: true,
        formSchema: [],
        fieldMapping: {}
    },
    {
        id: 2, name: 'Заказ поставщику', fromStatusId: 2, toStatusId: 3,
        oneCDocType: 'Receipt', active: true,
        formSchema: [
            { key: 'SupplierId', type: 'Select', source: 'Suppliers', label: 'Поставщик', required: true },
            { key: 'Contract', type: 'Select', source: 'Treaties', label: 'Договор', required: true },
            { key: 'NDS', type: 'Select', source: 'NDS', label: 'НДС', required: true },
            { key: 'DeliveryDate', type: 'Date', label: 'Дата поставки', required: true },
            { key: 'NumberVh', type: 'Text', label: 'Входящий номер', required: false },
        ],
        fieldMapping: { SupplierId: 'Order.SupplierId', DeliveryDate: 'Order.DeliveryDate' }
    },
    {
        id: 3, name: 'Заказ реализатору', fromStatusId: 2, toStatusId: 4,
        oneCDocType: 'Movement', active: true,
        formSchema: [
            { key: 'WarehouseTo', type: 'Select', source: 'Warehouses', label: 'Склад назначения', required: true },
        ],
        fieldMapping: {}
    },
    {
        id: 4, name: 'Смена поставщика', fromStatusId: 3, toStatusId: 3,
        oneCDocType: 'Movement', active: true,
        formSchema: [
            { key: 'NewSupplierId', type: 'Select', source: 'Suppliers', label: 'Новый поставщик', required: true },
        ],
        fieldMapping: { NewSupplierId: 'Order.SupplierId' }
    },
    {
        id: 5, name: 'Принять на склад', fromStatusId: 3, toStatusId: 5,
        oneCDocType: 'Movement', active: true,
        formSchema: [],
        fieldMapping: {}
    },
    {
        id: 6, name: 'Возврат на склад', fromStatusId: 5, toStatusId: 6,
        oneCDocType: 'Movement', active: true,
        formSchema: [
            { key: 'ReturnReason', type: 'Text', label: 'Причина возврата', required: true },
        ],
        fieldMapping: {}
    },
    {
        id: 7, name: 'Отмена', fromStatusId: 0, toStatusId: 7,
        oneCDocType: null, active: true,
        formSchema: [
            { key: 'CancelReason', type: 'Text', label: 'Причина отмены', required: true },
        ],
        fieldMapping: {}
    },
];

// --- Products pool ---
const PRODUCTS_POOL = [
    { article: 'ART-001', name: 'Кроссовки Nike Air Max', price: 8500, purchasePrice: 4200 },
    { article: 'ART-002', name: 'Футболка Adidas Originals', price: 3200, purchasePrice: 1500 },
    { article: 'ART-003', name: 'Рюкзак Puma Phase', price: 4100, purchasePrice: 2000 },
    { article: 'ART-004', name: 'Куртка Columbia Omni-Heat', price: 15900, purchasePrice: 8500 },
    { article: 'ART-005', name: 'Джинсы Levi\'s 501', price: 7800, purchasePrice: 3800 },
    { article: 'ART-006', name: 'Шапка The North Face', price: 2900, purchasePrice: 1200 },
    { article: 'ART-007', name: 'Перчатки Under Armour', price: 1800, purchasePrice: 800 },
    { article: 'ART-008', name: 'Носки Nike Everyday (3 пары)', price: 1200, purchasePrice: 500 },
    { article: 'ART-009', name: 'Спортивные штаны Reebok', price: 4500, purchasePrice: 2200 },
    { article: 'ART-010', name: 'Кеды Converse Chuck Taylor', price: 6200, purchasePrice: 3000 },
];

// --- Generate Orders ---
function generateOrders() {
    const orders = [];
    const shipmentWarehouses = ['Ozon Хоругвино', 'Ozon Пушкино', 'WB Коледино', 'WB Электросталь', 'Яндекс Софьино'];
    
    for (let i = 1; i <= 25; i++) {
        const statusId = [1,1,2,2,2,3,3,3,4,4,5,5,5,5,6,7,2,3,4,5,1,2,3,5,4][i-1];
        const mp = MARKETPLACES[i % 3];
        const client = CLIENTS[i % CLIENTS.length];
        const supplier = SUPPLIERS[i % SUPPLIERS.length];
        const wh = shipmentWarehouses[i % shipmentWarehouses.length];
        
        const numProducts = 1 + (i % 3);
        const products = [];
        for (let p = 0; p < numProducts; p++) {
            const prod = PRODUCTS_POOL[(i + p) % PRODUCTS_POOL.length];
            const qty = 1 + (i % 4);
            products.push({
                article: prod.article,
                name: prod.name,
                quantity: qty,
                price: prod.price,
                purchasePrice: prod.purchasePrice,
                sum: prod.price * qty,
            });
        }

        const totalSum = products.reduce((s, p) => s + p.sum, 0);
        const daysAgo = 25 - i;
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);

        orders.push({
            id: i,
            number: `${mp === 'Ozon' ? 'OZ' : mp === 'Wildberries' ? 'WB' : 'YM'}-${String(100000 + i)}`,
            date: date.toISOString().split('T')[0],
            marketplace: mp,
            statusId: statusId,
            clientId: client.id,
            supplierId: supplier.id,
            shipmentWarehouse: wh,
            products: products,
            totalSum: totalSum,
            deliveryDate: statusId >= 3 ? new Date(date.getTime() + 5 * 86400000).toISOString().split('T')[0] : null,
        });
    }
    return orders;
}

const ORDERS = generateOrders();

// --- Generate Transaction Records ---
function generateTransactions() {
    const records = [];
    let id = 1;
    
    ORDERS.forEach(order => {
        if (order.statusId >= 2) {
            const d = new Date(order.date);
            records.push({
                id: id++,
                orderId: order.id,
                orderNumber: order.number,
                definitionId: 1,
                definitionName: 'Принять в работу',
                user: 'Админ',
                date: d.toISOString().split('T')[0],
                inputData: {},
                oneCStatus: null,
                oneCId: null,
                oneCError: null,
            });
        }
        if (order.statusId >= 3) {
            const d = new Date(order.date);
            d.setDate(d.getDate() + 1);
            const statuses = ['Success', 'Success', 'Success', 'Pending', 'Error'];
            const st = statuses[id % statuses.length];
            records.push({
                id: id++,
                orderId: order.id,
                orderNumber: order.number,
                definitionId: 2,
                definitionName: 'Заказ поставщику',
                user: 'Админ',
                date: d.toISOString().split('T')[0],
                inputData: { SupplierId: SUPPLIERS[order.id % SUPPLIERS.length].name, DeliveryDate: order.deliveryDate },
                oneCStatus: st,
                oneCId: st === 'Success' ? `DOC-${String(1000 + id).padStart(6, '0')}` : null,
                oneCError: st === 'Error' ? 'Ошибка подключения к 1С: timeout 15s' : null,
            });
        }
        if (order.statusId >= 4) {
            const d = new Date(order.date);
            d.setDate(d.getDate() + 2);
            records.push({
                id: id++,
                orderId: order.id,
                orderNumber: order.number,
                definitionId: 3,
                definitionName: 'Заказ реализатору',
                user: 'Менеджер',
                date: d.toISOString().split('T')[0],
                inputData: { WarehouseTo: 'Основной склад' },
                oneCStatus: 'Success',
                oneCId: `DOC-${String(1000 + id).padStart(6, '0')}`,
                oneCError: null,
            });
        }
        if (order.statusId === 6) {
            const d = new Date(order.date);
            d.setDate(d.getDate() + 5);
            records.push({
                id: id++,
                orderId: order.id,
                orderNumber: order.number,
                definitionId: 6,
                definitionName: 'Возврат на склад',
                user: 'Менеджер',
                date: d.toISOString().split('T')[0],
                inputData: { ReturnReason: 'Брак товара' },
                oneCStatus: 'Success',
                oneCId: `DOC-${String(1000 + id).padStart(6, '0')}`,
                oneCError: null,
            });
        }
    });
    
    return records.sort((a, b) => b.id - a.id);
}

const TRANSACTIONS = generateTransactions();

// --- Helper functions ---
function getStatus(id) {
    return STATUSES.find(s => s.id === id) || { name: '?', css: '' };
}

function getClient(id) {
    return CLIENTS.find(c => c.id === id) || { name: '?', inn: '' };
}

function getSupplier(id) {
    return SUPPLIERS.find(s => s.id === id) || { name: '?', inn: '' };
}

function getAvailableTransactions(statusId) {
    const status = getStatus(statusId);
    if (status.isFinal) return [];
    return TRANSACTION_DEFINITIONS.filter(td =>
        td.active && (td.fromStatusId === statusId || td.fromStatusId === 0)
    );
}

function getOneCStatusBadge(status) {
    if (!status) return '<span class="text-muted">—</span>';
    const map = {
        'Pending': '<span class="badge onec-pending">Ожидание</span>',
        'Success': '<span class="badge onec-success">Успешно</span>',
        'Error': '<span class="badge onec-error">Ошибка</span>',
    };
    return map[status] || status;
}

function formatMoney(n) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function getSelectOptions(source) {
    switch (source) {
        case 'Suppliers': return SUPPLIERS.map(s => ({ value: s.id, label: s.name }));
        case 'Warehouses': return ONEC_WAREHOUSES.map(w => ({ value: w.name, label: w.name }));
        case 'Treaties': return ONEC_TREATIES.map(t => ({ value: t.link, label: t.name + ' — ' + t.partner }));
        case 'NDS': return [{ value: 'да', label: 'С НДС (20%)' }, { value: '', label: 'Без НДС' }];
        default: return [];
    }
}

// --- Additional Entities from Drawio Schema ---

// Client Types
const CLIENT_TYPES = [
    { id: 1, name: 'Физическое лицо', description: 'Частный покупатель' },
    { id: 2, name: 'Юридическое лицо', description: 'Компания' },
    { id: 3, name: 'Индивидуальный предприниматель', description: 'ИП' },
];

// Client 1C Settings
const CLIENT_1C_SETTINGS = [
    { id: 1, clientId: 1, externalId: '1C-001', syncEnabled: true, lastSync: '2025-12-01' },
    { id: 2, clientId: 2, externalId: '1C-002', syncEnabled: true, lastSync: '2025-12-02' },
];

// Prices
const PRICES = [
    { id: 1, orderId: 1, type: 'retail', amount: 15000, currency: 'RUB', createdAt: '2025-01-01' },
    { id: 2, orderId: 2, type: 'wholesale', amount: 12000, currency: 'RUB', createdAt: '2025-01-02' },
];

// Order Dates
const ORDER_DATES = [
    { id: 1, orderId: 1, type: 'created', date: '2025-01-01' },
    { id: 2, orderId: 1, type: 'paid', date: '2025-01-02' },
    { id: 3, orderId: 1, type: 'shipped', date: '2025-01-05' },
];

// Delivery Types
const DELIVERY_TYPES = [
    { id: 1, name: 'FBS', description: 'Fulfillment by Seller' },
    { id: 2, name: 'FBO', description: 'Fulfillment by Ozon' },
    { id: 3, name: 'Express', description: 'Экспресс-доставка' },
];

// Addresses
const ADDRESSES = [
    { id: 1, type: 'sender', name: 'ООО "Магазин"', address: 'Москва, ул. Ленина 10', phone: '+7-495-123-45-67' },
    { id: 2, type: 'receiver', name: 'Иванов И.И.', address: 'СПб, Невский пр. 20', phone: '+7-812-987-65-43' },
];

// Deliveries
const DELIVERIES = [
    { id: 1, orderId: 1, deliveryTypeId: 1, senderAddressId: 1, receiverAddressId: 2, trackingNumber: 'WB-123456', status: 'В пути' },
];

// Manufacturers
const MANUFACTURERS = [
    { id: 1, name: 'Samsung Electronics', country: 'Южная Корея' },
    { id: 2, name: 'Apple Inc.', country: 'США' },
    { id: 3, name: 'Xiaomi', country: 'Китай' },
];

// Categories
const CATEGORIES = [
    { id: 1, name: 'Смартфоны', parentId: null },
    { id: 2, name: 'Ноутбуки', parentId: null },
    { id: 3, name: 'Аксессуары', parentId: null },
    { id: 4, name: 'Чехлы для смартфонов', parentId: 3 },
];

// Product Attributes
const PRODUCT_ATTRIBUTES = [
    { id: 1, name: 'Цвет', type: 'string' },
    { id: 2, name: 'Размер экрана', type: 'number' },
    { id: 3, name: 'Оперативная память', type: 'number' },
];

// Product Attribute Values
const PRODUCT_ATTRIBUTE_VALUES = [
    { id: 1, productId: 1, attributeId: 1, value: 'Черный' },
    { id: 2, productId: 1, attributeId: 2, value: '6.5' },
    { id: 3, productId: 1, attributeId: 3, value: '8' },
];

// Status Colors
const STATUS_COLORS = [
    { id: 1, name: 'Зеленый', hex: '#28a745' },
    { id: 2, name: 'Желтый', hex: '#ffc107' },
    { id: 3, name: 'Красный', hex: '#dc3545' },
    { id: 4, name: 'Синий', hex: '#007bff' },
];

// Projects
const PROJECTS = [
    { id: 1, name: 'Демо проект', description: 'Прототип SaaS', createdAt: '2025-01-01', ownerId: 1 },
];

// Project Settings
const PROJECT_SETTINGS = [
    { id: 1, projectId: 1, key: 'theme', value: 'light' },
    { id: 2, projectId: 1, key: 'language', value: 'ru' },
];

// Project Users
const PROJECT_USERS = [
    { projectId: 1, userId: 1 },
    { projectId: 1, userId: 2 },
];

// Update existing entities with foreign keys from schema
// Add to CLIENTS
CLIENTS.forEach(c => {
    c.typeId = c.id <= 2 ? 2 : 1; // First two are companies, others individuals
    c.settingsId = c.id; // Link to 1C settings
});

// Add to ORDERS
ORDERS.forEach(o => {
    o.priceId = o.id;
    o.deliveryId = o.id;
});

// Add to PRODUCTS
PRODUCTS_POOL.forEach(p => {
    p.manufacturerId = (p.id % 3) + 1;
    p.categoryId = (p.id % 4) + 1;
});

// Add to STATUSES
STATUSES.forEach(s => {
    s.colorId = (s.id % 4) + 1;
});

// Helper functions for new entities
function getClientType(typeId) {
    return CLIENT_TYPES.find(ct => ct.id === typeId);
}

function getClient1CSettings(clientId) {
    return CLIENT_1C_SETTINGS.find(s => s.clientId === clientId);
}

function getOrderPrices(orderId) {
    return PRICES.filter(p => p.orderId === orderId);
}

function getOrderDates(orderId) {
    return ORDER_DATES.filter(d => d.orderId === orderId);
}

function getDelivery(orderId) {
    return DELIVERIES.find(d => d.orderId === orderId);
}

function getManufacturer(manId) {
    return MANUFACTURERS.find(m => m.id === manId);
}

function getCategory(catId) {
    return CATEGORIES.find(c => c.id === catId);
}

function getProductAttributes(productId) {
    return PRODUCT_ATTRIBUTE_VALUES.filter(pav => pav.productId === productId).map(pav => ({
        ...pav,
        attribute: PRODUCT_ATTRIBUTES.find(pa => pa.id === pav.attributeId)
    }));
}

function getStatusColor(statusId) {
    const status = STATUSES.find(s => s.id === statusId);
    return status ? STATUS_COLORS.find(c => c.id === status.colorId) : null;
}

function getProjectUsers(projectId) {
    return PROJECT_USERS.filter(pu => pu.projectId === projectId).map(pu => getUser(pu.userId));
}

function getProjectSettings(projectId) {
    return PROJECT_SETTINGS.filter(ps => ps.projectId === projectId);
}

// --- Status Resolver Functions ---
function resolveStatus(tenantId, source, externalKey) {
    // 1. Ищем настройку пользователя
    const userMap = STATUS_MAPPINGS.find(m => 
        m.tenantId === tenantId && 
        m.source === source && 
        m.externalKey === externalKey
    );
    
    if (userMap && userMap.internalStatusId) {
        return userMap.internalStatusId;
    }
    
    // 2. Ищем глобальную настройку
    const globalMap = STATUS_MAPPINGS.find(m => 
        m.tenantId === null && 
        m.source === source && 
        m.externalKey === externalKey
    );
    
    if (globalMap && globalMap.internalStatusId) {
        return globalMap.internalStatusId;
    }
    
    // 3. Статус неизвестен - возвращаем специальный статус "Ошибка маппинга"
    // В реальной системе здесь был бы статус с id = 8 (MappingError)
    return 7; // Возвращаем "Отменён" как заглушку
}

function getStatusMappings(tenantId) {
    return STATUS_MAPPINGS.filter(m => 
        m.tenantId === null || m.tenantId === tenantId
    );
}

function getUnknownStatuses(tenantId) {
    return STATUS_MAPPINGS.filter(m => 
        m.tenantId === tenantId && 
        m.internalStatusId === null
    );
}

// --- Hangfire Jobs Dashboard ---
const HANGFIRE_JOBS = [
    {
        id: 1,
        jobName: 'ArchiveOldOrders',
        state: 'Succeeded',
        createdAt: '2026-02-14 10:00:00',
        startedAt: '2026-02-14 10:00:05',
        completedAt: '2026-02-14 10:00:15',
        duration: '00:00:10',
        queue: 'default',
        serverName: 'Server-01',
        error: null,
        retryCount: 0
    },
    {
        id: 2,
        jobName: 'SyncWith1C',
        state: 'Processing',
        createdAt: '2026-02-14 10:15:00',
        startedAt: '2026-02-14 10:15:02',
        completedAt: null,
        duration: null,
        queue: '1c-sync',
        serverName: 'Server-02',
        error: null,
        retryCount: 0
    },
    {
        id: 3,
        jobName: 'SendNotifications',
        state: 'Enqueued',
        createdAt: '2026-02-14 10:20:00',
        startedAt: null,
        completedAt: null,
        duration: null,
        queue: 'notifications',
        serverName: null,
        error: null,
        retryCount: 0
    },
    {
        id: 4,
        jobName: 'CalculatePrices',
        state: 'Failed',
        createdAt: '2026-02-14 09:00:00',
        startedAt: '2026-02-14 09:00:01',
        completedAt: null,
        duration: null,
        queue: 'pricing',
        serverName: 'Server-01',
        error: 'Timeout connecting to price service',
        retryCount: 3
    },
    {
        id: 5,
        jobName: 'UpdateProductStock',
        state: 'Scheduled',
        createdAt: '2026-02-14 08:00:00',
        startedAt: null,
        completedAt: null,
        duration: null,
        queue: 'inventory',
        serverName: null,
        error: null,
        retryCount: 0
    },
    {
        id: 6,
        jobName: 'ProcessTransactions',
        state: 'Succeeded',
        createdAt: '2026-02-13 22:00:00',
        startedAt: '2026-02-13 22:00:02',
        completedAt: '2026-02-13 22:05:30',
        duration: '00:05:28',
        queue: 'transactions',
        serverName: 'Server-02',
        error: null,
        retryCount: 0
    }
];

function getJobStateBadge(state) {
    const map = {
        'Succeeded': 'badge bg-success',
        'Processing': 'badge bg-primary',
        'Enqueued': 'badge bg-secondary',
        'Failed': 'badge bg-danger',
        'Scheduled': 'badge bg-warning'
    };
    return map[state] || 'badge bg-light';
}

// --- Support Tickets ---
const SUPPORT_TICKETS = [
    {
        id: 1,
        title: 'Ошибка синхронизации с 1С',
        description: 'При проведении транзакции возникает ошибка timeout 15s',
        status: 'In Progress',
        priority: 'High',
        createdBy: 'Менеджер Иванов',
        createdAt: '2026-02-14 09:00:00',
        assignedTo: 'Админ',
        lastUpdated: '2026-02-14 11:00:00',
        comments: [
            { user: 'Менеджер Иванов', text: 'Проблема в заказе OZ-100006', date: '2026-02-14 09:00:00' },
            { user: 'Админ', text: 'Проверяю конфигурацию 1С', date: '2026-02-14 11:00:00' }
        ]
    },
    {
        id: 2,
        title: 'Не работает фильтр по дате в заказах',
        description: 'При выборе диапазона дат список не фильтруется',
        status: 'Open',
        priority: 'Medium',
        createdBy: 'Бухгалтер Петрова',
        createdAt: '2026-02-13 15:30:00',
        assignedTo: null,
        lastUpdated: '2026-02-13 15:30:00',
        comments: []
    },
    {
        id: 3,
        title: 'Неправильный расчет цен',
        description: 'В новом заказе цены рассчитываются некорректно',
        status: 'Closed',
        priority: 'Low',
        createdBy: 'Пользователь Сидоров',
        createdAt: '2026-02-12 10:00:00',
        assignedTo: 'Админ',
        lastUpdated: '2026-02-13 12:00:00',
        comments: [
            { user: 'Пользователь Сидоров', text: 'Цена на кроссовки Nike показывается 8500 вместо 8200', date: '2026-02-12 10:00:00' },
            { user: 'Админ', text: 'Исправлено: была ошибка в PRODUCTS_POOL', date: '2026-02-13 12:00:00' }
        ]
    }
];

function getTicketStatusBadge(status) {
    const map = {
        'Open': 'badge bg-danger',
        'In Progress': 'badge bg-warning',
        'Closed': 'badge bg-success'
    };
    return map[status] || 'badge bg-secondary';
}

function getTicketPriorityBadge(priority) {
    const map = {
        'Low': 'badge bg-secondary',
        'Medium': 'badge bg-warning',
        'High': 'badge bg-danger'
    };
    return map[priority] || 'badge bg-secondary';
}

// --- SaaS Admin Dashboard Data ---
const SAAS_TENANTS = [
    {
        id: 1,
        companyName: 'ООО "Альфа Трейд"',
        subdomain: 'alpha',
        plan: 'Pro',
        status: 'Active',
        createdAt: '2025-01-15',
        lastActive: '2026-02-14',
        connectionString: 'Server=.;Database=alpha_db;Trusted_Connection=True;',
        databaseSize: '245 MB',
        orderCount: 1247,
        userCount: 5,
        monthlyRevenue: 15000,
        isActive: true,
        adminEmail: 'admin@alpha.ru',
        adminName: 'Иван Петров'
    },
    {
        id: 2,
        companyName: 'ИП Сидоров А.В.',
        subdomain: 'sidorov',
        plan: 'Starter',
        status: 'Active',
        createdAt: '2025-02-20',
        lastActive: '2026-02-13',
        connectionString: 'Server=.;Database=sidorov_db;Trusted_Connection=True;',
        databaseSize: '89 MB',
        orderCount: 342,
        userCount: 2,
        monthlyRevenue: 3000,
        isActive: true,
        adminEmail: 'sidorov@demo.ru',
        adminName: 'Александр Сидоров'
    },
    {
        id: 3,
        companyName: 'ООО "Гамма Логистик"',
        subdomain: 'gamma',
        plan: 'Enterprise',
        status: 'Active',
        createdAt: '2024-11-10',
        lastActive: '2026-02-14',
        connectionString: 'Server=.;Database=gamma_db;Trusted_Connection=True;',
        databaseSize: '1.2 GB',
        orderCount: 5678,
        userCount: 15,
        monthlyRevenue: 45000,
        isActive: true,
        adminEmail: 'admin@gamma.ru',
        adminName: 'Мария Иванова'
    },
    {
        id: 4,
        companyName: 'ООО "Бета Тех"',
        subdomain: 'beta',
        plan: 'Pro',
        status: 'Suspended',
        createdAt: '2025-03-05',
        lastActive: '2026-01-20',
        connectionString: 'Server=.;Database=beta_db;Trusted_Connection=True;',
        databaseSize: '156 MB',
        orderCount: 892,
        userCount: 3,
        monthlyRevenue: 8000,
        isActive: false,
        adminEmail: 'admin@beta.ru',
        adminName: 'Дмитрий Козлов',
        suspensionReason: 'Неоплата с 01.02.2026'
    },
    {
        id: 5,
        companyName: 'ИП Попова Е.С.',
        subdomain: 'popova',
        plan: 'Starter',
        status: 'Trial',
        createdAt: '2026-02-01',
        lastActive: '2026-02-14',
        connectionString: 'Server=.;Database=popova_db;Trusted_Connection=True;',
        databaseSize: '12 MB',
        orderCount: 45,
        userCount: 1,
        monthlyRevenue: 0,
        isActive: true,
        adminEmail: 'popova@demo.ru',
        adminName: 'Елена Попова',
        trialEndsAt: '2026-02-15'
    }
];

const SAAS_PLANS = [
    { id: 'Starter', name: 'Starter', price: 2990, features: ['До 1000 заказов', '3 пользователя', '5 GB хранилище', 'Базовая поддержка'] },
    { id: 'Pro', name: 'Pro', price: 9990, features: ['До 5000 заказов', '10 пользователей', '50 GB хранилище', 'Приоритетная поддержка', 'API доступ'] },
    { id: 'Enterprise', name: 'Enterprise', price: 29990, features: ['Безлимит заказов', 'Безлимит пользователей', '500 GB хранилище', 'Выделенный менеджер', 'SLA 99.9%', 'Белый лейбл'] }
];

const SAAS_ACTIVITY_LOG = [
    { id: 1, tenantId: 1, action: 'order_created', description: 'Создан заказ #OZ-1001247', timestamp: '2026-02-14 15:30:00', userId: 1 },
    { id: 2, tenantId: 1, action: 'user_login', description: 'Вход пользователя: Иван Петров', timestamp: '2026-02-14 15:25:00', userId: 1 },
    { id: 3, tenantId: 3, action: 'order_created', description: 'Создан заказ #WB-1005679', timestamp: '2026-02-14 15:20:00', userId: 8 },
    { id: 4, tenantId: 2, action: 'user_login', description: 'Вход пользователя: Александр Сидоров', timestamp: '2026-02-14 14:45:00', userId: 4 },
    { id: 5, tenantId: 5, action: 'order_created', description: 'Создан заказ #YM-1000045', timestamp: '2026-02-14 14:30:00', userId: 12 },
    { id: 6, tenantId: 4, action: 'suspension', description: 'Аккаунт приостановлен: Неоплата', timestamp: '2026-02-01 00:00:00', userId: null },
    { id: 7, tenantId: 1, action: 'database_backup', description: 'Автоматический бэкап базы данных', timestamp: '2026-02-14 02:00:00', userId: null },
    { id: 8, tenantId: 3, action: 'user_added', description: 'Добавлен пользователь: Ольга Смирнова', timestamp: '2026-02-13 16:20:00', userId: 8 }
];

const SAAS_SYSTEM_METRICS = {
    totalTenants: 5,
    activeTenants: 4,
    trialTenants: 1,
    suspendedTenants: 1,
    totalOrders: 8204,
    totalUsers: 26,
    monthlyRevenue: 71000,
    totalDatabaseSize: '1.7 GB',
    systemUptime: '99.8%',
    lastBackup: '2026-02-14 02:00:00'
};
