// ============================================================
// PAGES — рендеринг каждой страницы
// ============================================================

// --- Orders List ---
function renderOrdersPage() {
    const stats = {
        total: ORDERS.length,
        new: ORDERS.filter(o => o.statusId === 1).length,
        inWork: ORDERS.filter(o => o.statusId === 2).length,
        ordered: ORDERS.filter(o => o.statusId === 3).length,
    };

    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Заказы</h4>
        <button class="btn btn-outline-primary btn-sm" onclick="showToast('Синхронизация запущена. Ожидайте обновления.', 'info')">
            <i class="bi bi-arrow-clockwise"></i> Синхронизировать
        </button>
    </div>

    <div class="row g-3 mb-4">
        <div class="col-md-3"><div class="card stat-card" style="border-color:#6c757d"><div class="card-body py-2"><div class="stat-value">${stats.total}</div><small class="text-muted">Всего</small></div></div></div>
        <div class="col-md-3"><div class="card stat-card" style="border-color:#0d6efd"><div class="card-body py-2"><div class="stat-value">${stats.new}</div><small class="text-muted">Новых</small></div></div></div>
        <div class="col-md-3"><div class="card stat-card" style="border-color:#6f42c1"><div class="card-body py-2"><div class="stat-value">${stats.inWork}</div><small class="text-muted">В работе</small></div></div></div>
        <div class="col-md-3"><div class="card stat-card" style="border-color:#198754"><div class="card-body py-2"><div class="stat-value">${stats.ordered}</div><small class="text-muted">Заказано</small></div></div></div>
    </div>

    <div class="card mb-3">
        <div class="card-body py-2">
            <div class="d-flex flex-wrap align-items-center gap-2">
                <span class="text-muted me-1">Статус:</span>
                <span class="chip active" onclick="filterOrders(this, 0)">Все</span>
                ${STATUSES.map(s => `<span class="chip" onclick="filterOrders(this, ${s.id})">${s.name}</span>`).join('')}
                <span class="text-muted ms-3 me-1">Маркетплейс:</span>
                <select class="form-select form-select-sm" style="width:150px" onchange="filterOrdersByMp(this.value)">
                    <option value="">Все</option>
                    ${MARKETPLACES.map(m => `<option>${m}</option>`).join('')}
                </select>
                <span class="text-muted ms-3 me-1">Дата:</span>
                <input type="date" class="form-control form-control-sm" style="width:140px" id="dateFrom" onchange="filterOrdersByDate()">
                <span class="text-muted">—</span>
                <input type="date" class="form-control form-control-sm" style="width:140px" id="dateTo" onchange="filterOrdersByDate()">
                <input type="text" class="form-control form-control-sm ms-auto" style="width:200px" placeholder="Поиск по номеру..." oninput="searchOrders(this.value)">
            </div>
        </div>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover table-clickable mb-0" id="ordersTable">
                <thead class="table-light">
                    <tr>
                        <th style="width:40px"><input type="checkbox" class="form-check-input" id="selectAllOrders" onchange="toggleAllOrders(this.checked)"></th>
                        <th class="sortable" onclick="sortOrders('number')">№ <i class="bi bi-arrow-down-up text-muted"></i></th>
                        <th class="sortable" onclick="sortOrders('date')">Дата <i class="bi bi-arrow-down-up text-muted"></i></th>
                        <th>Маркетплейс</th>
                        <th>Статус</th>
                        <th class="sortable" onclick="sortOrders('client')">Клиент <i class="bi bi-arrow-down-up text-muted"></i></th>
                        <th class="sortable" onclick="sortOrders('sum')">Сумма <i class="bi bi-arrow-down-up text-muted"></i></th>
                        <th>Склад</th>
                    </tr>
                </thead>
                <tbody id="ordersTableBody">
                </tbody>
            </table>
        </div>
        <div class="card-footer d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
                <small class="text-muted" id="ordersCount"></small>
                <select class="form-select form-select-sm" style="width:80px" onchange="window._ordersPerPage=parseInt(this.value);window._ordersPage=1;renderOrdersTable()">
                    <option value="25" selected>25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                </select>
            </div>
            <nav><ul class="pagination pagination-sm mb-0" id="ordersPagination"></ul></nav>
        </div>
    </div>

    <!-- Mass action bar -->
    <div class="card mt-3 d-none" id="massActionBar">
        <div class="card-body py-2 d-flex align-items-center gap-3">
            <strong><span id="selectedCount">0</span> выбрано</strong>
            <select class="form-select form-select-sm" style="width:250px" id="massActionSelect">
                <option value="">— Выберите действие —</option>
                ${TRANSACTION_DEFINITIONS.filter(d => d.active).map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" onclick="executeMassAction()"><i class="bi bi-play-fill"></i> Применить</button>
            <button class="btn btn-outline-secondary btn-sm" onclick="clearSelection()">Снять выделение</button>
        </div>
    </div>`;

    document.getElementById('pageContent').innerHTML = html;
    window._ordersFilter = { statusId: 0, mp: '', search: '', dateFrom: '', dateTo: '' };
    window._ordersPage = 1;
    window._ordersPerPage = 25;
    window._ordersSort = { key: 'date', dir: -1 };
    renderOrdersTable();
}

function renderOrdersTable() {
    const f = window._ordersFilter;
    let filtered = ORDERS.filter(o => {
        if (f.statusId && o.statusId !== f.statusId) return false;
        if (f.mp && o.marketplace !== f.mp) return false;
        if (f.search && !o.number.toLowerCase().includes(f.search.toLowerCase())) return false;
        if (f.dateFrom && o.date < f.dateFrom) return false;
        if (f.dateTo && o.date > f.dateTo) return false;
        return true;
    });

    const s = window._ordersSort;
    if (s && s.key) {
        filtered.sort((a, b) => {
            let va, vb;
            switch (s.key) {
                case 'number': va = a.number; vb = b.number; break;
                case 'date': va = a.date; vb = b.date; break;
                case 'client': va = getClient(a.clientId).name; vb = getClient(b.clientId).name; break;
                case 'sum': va = a.totalSum; vb = b.totalSum; break;
                default: return 0;
            }
            if (va < vb) return -1 * s.dir;
            if (va > vb) return 1 * s.dir;
            return 0;
        });
    }

    const total = filtered.length;
    const pages = Math.ceil(total / window._ordersPerPage);
    const start = (window._ordersPage - 1) * window._ordersPerPage;
    const pageOrders = filtered.slice(start, start + window._ordersPerPage);

    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = pageOrders.map(o => {
        const st = getStatus(o.statusId);
        const cl = getClient(o.clientId);
        return `<tr onclick="navigateTo('order/${o.id}')">
            <td onclick="event.stopPropagation()"><input type="checkbox" class="form-check-input order-cb" value="${o.id}" onchange="updateMassBar()"></td>
            <td><strong>${o.number}</strong></td>
            <td>${o.date}</td>
            <td><span class="badge ${MP_CSS[o.marketplace]}">${o.marketplace}</span></td>
            <td><span class="badge badge-status ${st.css}">${st.name}${st.isFinal ? ' <i class="bi bi-lock-fill"></i>' : ''}</span></td>
            <td>${cl.name}</td>
            <td>${formatMoney(o.totalSum)}</td>
            <td><small>${o.shipmentWarehouse}</small></td>
        </tr>`;
    }).join('');

    document.getElementById('ordersCount').textContent = `Показано ${pageOrders.length} из ${total}`;

    const pag = document.getElementById('ordersPagination');
    let pagHtml = '';
    for (let i = 1; i <= pages; i++) {
        pagHtml += `<li class="page-item ${i === window._ordersPage ? 'active' : ''}"><a class="page-link" href="#" onclick="window._ordersPage=${i};renderOrdersTable();return false;">${i}</a></li>`;
    }
    pag.innerHTML = pagHtml;
}

function filterOrders(el, statusId) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    window._ordersFilter.statusId = statusId;
    window._ordersPage = 1;
    renderOrdersTable();
}

function filterOrdersByMp(mp) {
    window._ordersFilter.mp = mp;
    window._ordersPage = 1;
    renderOrdersTable();
}

function filterOrdersByDate() {
    window._ordersFilter.dateFrom = document.getElementById('dateFrom').value;
    window._ordersFilter.dateTo = document.getElementById('dateTo').value;
    window._ordersPage = 1;
    renderOrdersTable();
}

function sortOrders(key) {
    const s = window._ordersSort;
    if (s.key === key) { s.dir *= -1; } else { s.key = key; s.dir = 1; }
    renderOrdersTable();
}

function searchOrders(val) {
    window._ordersFilter.search = val;
    window._ordersPage = 1;
    renderOrdersTable();
}

// --- Order Detail ---
function renderOrderDetailPage(orderId) {
    const order = ORDERS.find(o => o.id === parseInt(orderId));
    if (!order) { document.getElementById('pageContent').innerHTML = '<div class="alert alert-danger">Заказ не найден</div>'; return; }

    const st = getStatus(order.statusId);
    const cl = getClient(order.clientId);
    const sup = getSupplier(order.supplierId);
    const availTx = getAvailableTransactions(order.statusId);
    const orderTx = TRANSACTIONS.filter(t => t.orderId === order.id);

    let html = `
    <div class="d-flex align-items-center mb-3">
        <a href="#orders" class="btn btn-sm btn-outline-secondary me-3"><i class="bi bi-arrow-left"></i></a>
        <h4 class="mb-0 me-3">Заказ ${order.number}</h4>
        <span class="badge badge-status ${st.css} me-2">${st.name}${st.isFinal ? ' <i class="bi bi-lock-fill"></i>' : ''}</span>
        <span class="badge ${MP_CSS[order.marketplace]}">${order.marketplace}</span>
    </div>

    ${st.isFinal ? `<div class="alert alert-secondary py-2 mb-3"><i class="bi bi-lock-fill"></i> <strong>Конечный статус (IsFinal).</strong> Действия заблокированы. Заказ будет автоматически архивирован через 6 месяцев.</div>` : ''}

    <div class="row g-3 mb-4">
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-header"><i class="bi bi-info-circle"></i> Информация</div>
                <div class="card-body">
                    <p class="mb-1"><strong>Дата:</strong> ${order.date}</p>
                    <p class="mb-1"><strong>Склад:</strong> ${order.shipmentWarehouse}</p>
                    <p class="mb-1"><strong>Сумма:</strong> ${formatMoney(order.totalSum)}</p>
                    ${order.deliveryDate ? `<p class="mb-0"><strong>Дата поставки:</strong> ${order.deliveryDate}</p>` : ''}
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-header"><i class="bi bi-building"></i> Клиент</div>
                <div class="card-body">
                    <p class="mb-1"><strong>${cl.name}</strong></p>
                    <p class="mb-1">ИНН: ${cl.inn}</p>
                    <p class="mb-0">Склад: ${cl.warehouse}</p>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card h-100">
                <div class="card-header"><i class="bi bi-truck"></i> Поставщик</div>
                <div class="card-body">
                    <p class="mb-1"><strong>${sup.name}</strong></p>
                    <p class="mb-1">ИНН: ${sup.inn}</p>
                    <p class="mb-0">НДС: ${sup.vat ? '<span class="text-success">Да (20%)</span>' : '<span class="text-muted">Нет</span>'}</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Action buttons -->
    ${availTx.length > 0 ? `
    <div class="card mb-4">
        <div class="card-header"><i class="bi bi-lightning"></i> Действия</div>
        <div class="card-body d-flex flex-wrap gap-2">
            ${availTx.map(tx => `
                <button class="btn ${tx.oneCDocType ? 'btn-primary' : 'btn-outline-primary'}" onclick="openTransactionModal(${order.id}, ${tx.id})">
                    ${tx.oneCDocType ? '<i class="bi bi-link-45deg"></i>' : '<i class="bi bi-play"></i>'} ${tx.name}
                    ${tx.oneCDocType ? `<small class="ms-1 opacity-75">(1С: ${tx.oneCDocType})</small>` : ''}
                </button>
            `).join('')}
        </div>
    </div>` : ''}

    <!-- Products -->
    <div class="card mb-4">
        <div class="card-header"><i class="bi bi-box"></i> Товары (${order.products.length})</div>
        <div class="table-responsive">
            <table class="table mb-0">
                <thead class="table-light">
                    <tr><th>Артикул</th><th>Название</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr>
                </thead>
                <tbody>
                    ${order.products.map(p => `
                        <tr>
                            <td><code>${p.article}</code></td>
                            <td>${p.name}</td>
                            <td>${p.quantity}</td>
                            <td>${formatMoney(p.price)}</td>
                            <td><strong>${formatMoney(p.sum)}</strong></td>
                        </tr>
                    `).join('')}
                    <tr class="table-light">
                        <td colspan="4" class="text-end"><strong>Итого:</strong></td>
                        <td><strong>${formatMoney(order.totalSum)}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Transaction history -->
    <div class="card">
        <div class="card-header"><i class="bi bi-clock-history"></i> История транзакций (${orderTx.length})</div>
        ${orderTx.length > 0 ? `
        <div class="table-responsive">
            <table class="table mb-0">
                <thead class="table-light">
                    <tr><th>Дата</th><th>Операция</th><th>Пользователь</th><th>Статус 1С</th><th>ID документа</th></tr>
                </thead>
                <tbody>
                    ${orderTx.map(t => `
                        <tr>
                            <td>${t.date}</td>
                            <td><strong>${t.definitionName}</strong></td>
                            <td>${t.user}</td>
                            <td>${getOneCStatusBadge(t.oneCStatus)}</td>
                            <td>${t.oneCId ? `<code>${t.oneCId}</code>` : '<span class="text-muted">—</span>'}</td>
                        </tr>
                        ${t.oneCError ? `<tr class="detail-row"><td colspan="5"><i class="bi bi-exclamation-triangle text-danger"></i> ${t.oneCError}</td></tr>` : ''}
                    `).join('')}
                </tbody>
            </table>
        </div>` : '<div class="card-body text-muted">Нет проведённых транзакций</div>'}
    </div>`;

    document.getElementById('pageContent').innerHTML = html;
}

// --- Transaction Modal ---
function openTransactionModal(orderId, defId) {
    const order = ORDERS.find(o => o.id === orderId);
    const def = TRANSACTION_DEFINITIONS.find(d => d.id === defId);
    if (!order || !def) return;

    const fromSt = getStatus(def.fromStatusId);
    const toSt = getStatus(def.toStatusId);

    let formHtml = `
        <div class="alert alert-info py-2 mb-3">
            <small>Переход статуса: <strong>${fromSt.name}</strong> → <strong>${toSt.name}</strong>
            ${def.oneCDocType ? ` | Документ 1С: <strong>${def.oneCDocType}</strong>` : ''}</small>
        </div>
        ${renderPipelineSteps(def)}
    `;

    def.formSchema.forEach(field => {
        const req = field.required ? 'required' : '';
        formHtml += `<div class="mb-3">`;
        formHtml += `<label class="form-label">${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}</label>`;

        switch (field.type) {
            case 'Select':
                const opts = getSelectOptions(field.source);
                formHtml += `<select class="form-select" id="txField_${field.key}" ${req}>
                    <option value="">— Выберите —</option>
                    ${opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                </select>`;
                break;
            case 'Date':
                formHtml += `<input type="date" class="form-control" id="txField_${field.key}" ${req}>`;
                break;
            case 'Number':
                formHtml += `<input type="number" class="form-control" id="txField_${field.key}" ${req}>`;
                break;
            case 'Checkbox':
                formHtml += `<div class="form-check"><input type="checkbox" class="form-check-input" id="txField_${field.key}"><label class="form-check-label">${field.label}</label></div>`;
                break;
            default:
                formHtml += `<input type="text" class="form-control" id="txField_${field.key}" ${req}>`;
        }
        formHtml += `</div>`;
    });

    formHtml += `<div class="mb-3">
        <label class="form-label">Комментарий</label>
        <textarea class="form-control" id="txField_comment" rows="2"></textarea>
    </div>`;

    document.getElementById('modalTitle').textContent = def.name;
    document.getElementById('modalBody').innerHTML = formHtml;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="executeTransaction(${orderId}, ${defId})">
            <i class="bi bi-check-lg"></i> Провести
        </button>
    `;

    const modal = new bootstrap.Modal(document.getElementById('universalModal'));
    modal.show();
}

function executeTransaction(orderId, defId) {
    const order = ORDERS.find(o => o.id === orderId);
    const def = TRANSACTION_DEFINITIONS.find(d => d.id === defId);
    if (!order || !def) return;

    order.statusId = def.toStatusId;

    const newTx = {
        id: TRANSACTIONS.length + 1,
        orderId: order.id,
        orderNumber: order.number,
        definitionId: def.id,
        definitionName: def.name,
        user: 'Админ',
        date: new Date().toISOString().split('T')[0],
        inputData: {},
        oneCStatus: def.oneCDocType ? 'Pending' : null,
        oneCId: null,
        oneCError: null,
    };
    TRANSACTIONS.unshift(newTx);

    bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide();

    const msg = def.oneCDocType
        ? `Транзакция "${def.name}" проведена. Документ 1С (${def.oneCDocType}) отправлен в очередь.`
        : `Транзакция "${def.name}" проведена.`;
    showToast(msg, 'success');

    renderOrderDetailPage(orderId);
}

// --- Transactions List ---
function renderTransactionsPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Журнал транзакций</h4>
    </div>

    <div class="card mb-3">
        <div class="card-body py-2 d-flex flex-wrap gap-2 align-items-center">
            <span class="text-muted">Статус 1С:</span>
            <select class="form-select form-select-sm" style="width:150px" id="txFilterStatus" onchange="renderTxTable()">
                <option value="">Все</option>
                <option value="Pending">Ожидание</option>
                <option value="Success">Успешно</option>
                <option value="Error">Ошибка</option>
            </select>
            <span class="text-muted ms-2">Операция:</span>
            <select class="form-select form-select-sm" style="width:200px" id="txFilterDef" onchange="renderTxTable()">
                <option value="">Все</option>
                ${TRANSACTION_DEFINITIONS.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
        </div>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr><th>Дата</th><th>Заказ</th><th>Операция</th><th>Пользователь</th><th>Статус 1С</th><th>ID документа</th><th></th></tr>
                </thead>
                <tbody id="txTableBody"></tbody>
            </table>
        </div>
    </div>`;

    document.getElementById('pageContent').innerHTML = html;
    renderTxTable();
}

function renderTxTable() {
    const statusFilter = document.getElementById('txFilterStatus').value;
    const defFilter = document.getElementById('txFilterDef').value;

    let filtered = TRANSACTIONS.filter(t => {
        if (statusFilter) {
            if (!t.oneCStatus) return false;
            if (t.oneCStatus !== statusFilter) return false;
        }
        if (defFilter && t.definitionId !== parseInt(defFilter)) return false;
        return true;
    });

    const tbody = document.getElementById('txTableBody');
    tbody.innerHTML = filtered.slice(0, 50).map(t => `
        <tr class="${t.oneCError ? '' : ''}" onclick="this.nextElementSibling?.classList.toggle('d-none')" style="cursor:pointer">
            <td>${t.date}</td>
            <td><a href="#order/${t.orderId}" onclick="event.stopPropagation()">${t.orderNumber}</a></td>
            <td><strong>${t.definitionName}</strong></td>
            <td>${t.user}</td>
            <td>${getOneCStatusBadge(t.oneCStatus)}</td>
            <td>${t.oneCId ? `<code>${t.oneCId}</code>` : '<span class="text-muted">—</span>'}</td>
            <td>${t.oneCStatus === 'Error' ? `<button class="btn btn-sm btn-outline-warning" onclick="event.stopPropagation(); retryTransaction(${t.id})"><i class="bi bi-arrow-clockwise"></i></button>` : ''}</td>
        </tr>
        <tr class="detail-row d-none">
            <td colspan="7">
                <strong>Входные данные:</strong> <code>${JSON.stringify(t.inputData)}</code>
                ${t.oneCError ? `<br><strong class="text-danger">Ошибка:</strong> ${t.oneCError}` : ''}
            </td>
        </tr>
    `).join('');
}

function retryTransaction(txId) {
    const tx = TRANSACTIONS.find(t => t.id === txId);
    if (tx) {
        tx.oneCStatus = 'Pending';
        tx.oneCError = null;
    }
    showToast('Повторная отправка в 1С запланирована', 'info');
    renderTxTable();
}

// --- Clients ---
function renderClientsPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Клиенты</h4>
        <button class="btn btn-primary btn-sm" onclick="openClientModal()"><i class="bi bi-plus-lg"></i> Добавить</button>
    </div>
    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr><th>Название</th><th>ИНН</th><th>Склад</th><th>Заказов</th><th></th></tr>
                </thead>
                <tbody>
                    ${CLIENTS.map(c => `
                        <tr>
                            <td><strong>${c.name}</strong></td>
                            <td><code>${c.inn}</code></td>
                            <td>${c.warehouse}</td>
                            <td><span class="badge bg-secondary">${c.ordersCount}</span></td>
                            <td><button class="btn btn-sm btn-outline-secondary" onclick="openClientModal(${c.id})"><i class="bi bi-pencil"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function openClientModal(clientId) {
    const client = clientId ? CLIENTS.find(c => c.id === clientId) : null;
    const title = client ? 'Редактировать клиента' : 'Новый клиент';

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <div class="mb-3"><label class="form-label">Название</label><input type="text" class="form-control" value="${client ? client.name : ''}"></div>
        <div class="mb-3"><label class="form-label">ИНН</label><input type="text" class="form-control" value="${client ? client.inn : ''}"></div>
        <div class="mb-3"><label class="form-label">Склад</label><input type="text" class="form-control" value="${client ? client.warehouse : ''}"></div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide(); showToast('Клиент сохранён', 'success')">Сохранить</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

// --- Suppliers ---
function renderSuppliersPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Поставщики</h4>
        <button class="btn btn-primary btn-sm" onclick="openSupplierModal()"><i class="bi bi-plus-lg"></i> Добавить</button>
    </div>
    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr><th>Название</th><th>Полное название</th><th>ИНН</th><th>НДС</th><th>Заказов</th><th></th></tr>
                </thead>
                <tbody>
                    ${SUPPLIERS.map(s => `
                        <tr>
                            <td><strong>${s.name}</strong></td>
                            <td><small class="text-muted">${s.fullName}</small></td>
                            <td><code>${s.inn}</code></td>
                            <td>${s.vat ? '<span class="badge bg-success">Да (20%)</span>' : '<span class="badge bg-secondary">Нет</span>'}</td>
                            <td><span class="badge bg-secondary">${s.ordersCount}</span></td>
                            <td><button class="btn btn-sm btn-outline-secondary" onclick="openSupplierModal(${s.id})"><i class="bi bi-pencil"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function openSupplierModal(supplierId) {
    const sup = supplierId ? SUPPLIERS.find(s => s.id === supplierId) : null;
    document.getElementById('modalTitle').textContent = sup ? 'Редактировать поставщика' : 'Новый поставщик';
    document.getElementById('modalBody').innerHTML = `
        <div class="mb-3"><label class="form-label">Название</label><input type="text" class="form-control" value="${sup ? sup.name : ''}"></div>
        <div class="mb-3"><label class="form-label">Полное название</label><input type="text" class="form-control" value="${sup ? sup.fullName : ''}"></div>
        <div class="mb-3"><label class="form-label">ИНН</label><input type="text" class="form-control" value="${sup ? sup.inn : ''}"></div>
        <div class="form-check mb-3"><input type="checkbox" class="form-check-input" ${sup && sup.vat ? 'checked' : ''}><label class="form-check-label">Плательщик НДС (20%)</label></div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide(); showToast('Поставщик сохранён', 'success')">Сохранить</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

// --- Warehouses ---
function renderWarehousesPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Склады и маппинг</h4>
        <div class="d-flex gap-2">
            <button class="btn btn-outline-info btn-sm" onclick="showToast('Загружено ${ONEC_WAREHOUSES.length} складов из 1С', 'info')"><i class="bi bi-cloud-download"></i> Загрузить из 1С</button>
            <button class="btn btn-primary btn-sm" onclick="openWarehouseModal()"><i class="bi bi-plus-lg"></i> Добавить связь</button>
        </div>
    </div>
    <div class="card">
        <div class="card-header">Маппинг: Склад маркетплейса → Склад 1С</div>
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr><th>Маркетплейс</th><th>Склад маркетплейса</th><th><i class="bi bi-arrow-right"></i></th><th>Склад 1С</th><th></th></tr>
                </thead>
                <tbody>
                    ${WAREHOUSE_MAPPINGS.map(w => `
                        <tr>
                            <td><span class="badge ${MP_CSS[w.marketplace] || 'bg-secondary'}">${w.marketplace}</span></td>
                            <td>${w.marketplaceName}</td>
                            <td><i class="bi bi-arrow-right text-muted"></i></td>
                            <td><strong>${w.oneCName}</strong></td>
                            <td><button class="btn btn-sm btn-outline-secondary" onclick="openWarehouseModal(${w.id})"><i class="bi bi-pencil"></i></button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <div class="card mt-3">
        <div class="card-header">Склады в 1С (справочник)</div>
        <div class="table-responsive">
            <table class="table mb-0">
                <thead class="table-light"><tr><th>Название</th><th>Ссылка 1С</th></tr></thead>
                <tbody>
                    ${ONEC_WAREHOUSES.map(w => `<tr><td>${w.name}</td><td><code>${w.link}</code></td></tr>`).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function openWarehouseModal(mappingId) {
    const m = mappingId ? WAREHOUSE_MAPPINGS.find(w => w.id === mappingId) : null;
    document.getElementById('modalTitle').textContent = m ? 'Редактировать связь' : 'Новая связь склада';
    document.getElementById('modalBody').innerHTML = `
        <div class="mb-3"><label class="form-label">Маркетплейс</label>
            <select class="form-select"><option>Ozon</option><option>Wildberries</option><option>Yandex Market</option></select>
        </div>
        <div class="mb-3"><label class="form-label">Склад маркетплейса</label><input type="text" class="form-control" value="${m ? m.marketplaceName : ''}"></div>
        <div class="mb-3"><label class="form-label">Склад 1С</label>
            <select class="form-select">
                ${ONEC_WAREHOUSES.map(w => `<option ${m && m.oneCName === w.name ? 'selected' : ''}>${w.name}</option>`).join('')}
            </select>
        </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide(); showToast('Связь сохранена', 'success')">Сохранить</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

// --- Settings ---
function renderSettingsPage() {
    document.getElementById('pageContent').innerHTML = `
    <h4 class="mb-3">Настройки компании</h4>
    <div class="card" style="max-width:600px">
        <div class="card-body">
            <div class="mb-3"><label class="form-label">Название компании</label><input type="text" class="form-control" value='ООО "Демо Компания"'></div>
            <div class="mb-3"><label class="form-label">Поддомен</label>
                <div class="input-group"><input type="text" class="form-control" value="demo"><span class="input-group-text">.saas-platform.ru</span></div>
            </div>
            <div class="mb-3"><label class="form-label">Тарифный план</label><input type="text" class="form-control" value="Бизнес" disabled></div>
            <button class="btn btn-primary" onclick="showToast('Настройки сохранены', 'success')"><i class="bi bi-check-lg"></i> Сохранить</button>
        </div>
    </div>`;
}

// --- Settings 1C ---
function renderSettings1CPage() {
    document.getElementById('pageContent').innerHTML = `
    <h4 class="mb-3">Интеграция с 1С</h4>

    <div class="card mb-4" style="max-width:700px">
        <div class="card-header">Подключение к 1С</div>
        <div class="card-body">
            <div class="mb-3"><label class="form-label">URL сервера 1С</label><input type="text" class="form-control" value="http://85.198.81.46/unf/hs/"></div>
            <div class="row g-3 mb-3">
                <div class="col-md-6"><label class="form-label">Логин</label><input type="text" class="form-control" value="api_user"></div>
                <div class="col-md-6"><label class="form-label">Пароль</label><input type="password" class="form-control" value="secret123"></div>
            </div>
            <div class="mb-3"><label class="form-label">ИНН организации</label><input type="text" class="form-control" value="7701234567"></div>
            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" checked id="onecEnabled">
                <label class="form-check-label" for="onecEnabled">Интеграция включена</label>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-primary" onclick="showToast('Настройки 1С сохранены', 'success')"><i class="bi bi-check-lg"></i> Сохранить</button>
                <button class="btn btn-outline-info" onclick="testOneCConnection()"><i class="bi bi-plug"></i> Проверить подключение</button>
            </div>
        </div>
    </div>

    <div class="card" style="max-width:700px">
        <div class="card-header">Справочники 1С</div>
        <div class="card-body">
            <div class="d-flex flex-wrap gap-2 mb-3">
                <button class="btn btn-outline-secondary btn-sm" onclick="show1CData('warehouses')"><i class="bi bi-house-gear"></i> Загрузить склады</button>
                <button class="btn btn-outline-secondary btn-sm" onclick="show1CData('treaties')"><i class="bi bi-file-earmark-text"></i> Загрузить договоры</button>
                <button class="btn btn-outline-secondary btn-sm" onclick="show1CData('suppliers')"><i class="bi bi-truck"></i> Загрузить поставщиков</button>
            </div>
            <div id="onecDataContainer"></div>
        </div>
    </div>`;
}

function testOneCConnection() {
    const btn = event.target.closest('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Проверка...';
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-plug"></i> Проверить подключение';
        if (Math.random() > 0.3) {
            showToast('Подключение к 1С успешно! Версия: 3.0.75.58', 'success');
        } else {
            showToast('Ошибка подключения к 1С: Connection timeout', 'error');
        }
    }, 1500);
}

function show1CData(type) {
    let tableHtml = '';
    switch (type) {
        case 'warehouses':
            tableHtml = `<table class="table table-sm"><thead><tr><th>Название</th><th>Ссылка</th></tr></thead><tbody>
                ${ONEC_WAREHOUSES.map(w => `<tr><td>${w.name}</td><td><code>${w.link}</code></td></tr>`).join('')}</tbody></table>`;
            showToast(`Загружено ${ONEC_WAREHOUSES.length} складов`, 'info');
            break;
        case 'treaties':
            tableHtml = `<table class="table table-sm"><thead><tr><th>Договор</th><th>Партнёр</th><th>ИНН</th></tr></thead><tbody>
                ${ONEC_TREATIES.map(t => `<tr><td>${t.name}</td><td>${t.partner}</td><td><code>${t.inn}</code></td></tr>`).join('')}</tbody></table>`;
            showToast(`Загружено ${ONEC_TREATIES.length} договоров`, 'info');
            break;
        case 'suppliers':
            tableHtml = `<table class="table table-sm"><thead><tr><th>Название</th><th>Полное</th><th>ИНН</th></tr></thead><tbody>
                ${ONEC_SUPPLIERS.map(s => `<tr><td>${s.name}</td><td>${s.fullName}</td><td><code>${s.inn}</code></td></tr>`).join('')}</tbody></table>`;
            showToast(`Загружено ${ONEC_SUPPLIERS.length} поставщиков`, 'info');
            break;
    }
    document.getElementById('onecDataContainer').innerHTML = tableHtml;
}

// --- Transaction Definitions (Constructor) ---
function renderTransactionDefinitionsPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Конструктор транзакций</h4>
        <button class="btn btn-primary btn-sm" onclick="openDefinitionModal()"><i class="bi bi-plus-lg"></i> Создать транзакцию</button>
    </div>
    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr><th>Название</th><th>Из статуса</th><th></th><th>В статус</th><th>Документ 1С</th><th>Полей формы</th><th>Активна</th><th></th></tr>
                </thead>
                <tbody>
                    ${TRANSACTION_DEFINITIONS.map(d => {
                        const from = d.fromStatusId === 0 ? 'Любой' : getStatus(d.fromStatusId).name;
                        const to = getStatus(d.toStatusId).name;
                        return `<tr>
                            <td><strong>${d.name}</strong></td>
                            <td><span class="badge badge-status ${d.fromStatusId === 0 ? 'bg-secondary' : getStatus(d.fromStatusId).css}">${from}</span></td>
                            <td><i class="bi bi-arrow-right"></i></td>
                            <td><span class="badge badge-status ${getStatus(d.toStatusId).css}">${to}</span></td>
                            <td>${d.oneCDocType ? `<span class="badge bg-info">${d.oneCDocType}</span>` : '<span class="text-muted">—</span>'}</td>
                            <td>${d.formSchema.length}</td>
                            <td>${d.active ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle text-muted"></i>'}</td>
                            <td><button class="btn btn-sm btn-outline-secondary" onclick="openDefinitionModal(${d.id})"><i class="bi bi-pencil"></i></button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function openDefinitionModal(defId) {
    const def = defId ? TRANSACTION_DEFINITIONS.find(d => d.id === defId) : null;
    const title = def ? `Редактировать: ${def.name}` : 'Новая транзакция';

    const statusOpts = STATUSES.map(s => `<option value="${s.id}" ${def && def.fromStatusId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
    const statusOptsTo = STATUSES.map(s => `<option value="${s.id}" ${def && def.toStatusId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

    let fieldsHtml = '';
    const fields = def ? def.formSchema : [];
    fields.forEach((f, idx) => {
        fieldsHtml += buildFieldRow(idx, f);
    });

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <div class="mb-3"><label class="form-label">Название операции</label><input type="text" class="form-control" value="${def ? def.name : ''}"></div>
        <div class="row g-3 mb-3">
            <div class="col-md-5">
                <label class="form-label">Начальный статус</label>
                <select class="form-select"><option value="0">Любой</option>${statusOpts}</select>
            </div>
            <div class="col-md-2 d-flex align-items-end justify-content-center"><i class="bi bi-arrow-right fs-4"></i></div>
            <div class="col-md-5">
                <label class="form-label">Конечный статус</label>
                <select class="form-select">${statusOptsTo}</select>
            </div>
        </div>
        <div class="mb-3">
            <label class="form-label">Тип документа 1С</label>
            <select class="form-select">
                <option value="" ${!def || !def.oneCDocType ? 'selected' : ''}>Нет (без 1С)</option>
                <option value="Movement" ${def && def.oneCDocType === 'Movement' ? 'selected' : ''}>Movement (Перемещение)</option>
                <option value="Receipt" ${def && def.oneCDocType === 'Receipt' ? 'selected' : ''}>Receipt (Поступление)</option>
            </select>
        </div>
        <hr>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <strong>Поля формы</strong>
            <button class="btn btn-sm btn-outline-primary" onclick="addFieldRow()"><i class="bi bi-plus"></i> Добавить поле</button>
        </div>
        <div id="formFieldsContainer">${fieldsHtml}</div>
        ${fields.length === 0 ? '<p class="text-muted" id="noFieldsMsg">Нет полей. Нажмите "Добавить поле".</p>' : ''}
        <hr>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <strong>Маппинг полей (Форма → Заказ)</strong>
            <button class="btn btn-sm btn-outline-primary" onclick="addMappingRow()"><i class="bi bi-plus"></i> Добавить</button>
        </div>
        <div id="mappingContainer">
            ${Object.entries(def ? def.fieldMapping : {}).map(([k, v], i) => buildMappingRow(i, k, v, def ? def.formSchema : [])).join('')}
        </div>
        ${Object.keys(def ? def.fieldMapping : {}).length === 0 ? '<p class="text-muted" id="noMappingMsg">Нет маппинга. Нажмите "Добавить".</p>' : ''}
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide(); showToast('Транзакция сохранена', 'success'); renderTransactionDefinitionsPage();">Сохранить</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

let _fieldCounter = 100;
function buildFieldRow(idx, field) {
    _fieldCounter++;
    return `
    <div class="field-row" id="fieldRow_${_fieldCounter}">
        <div class="row g-2 align-items-center">
            <div class="col-md-3"><input type="text" class="form-control form-control-sm" placeholder="Ключ" value="${field ? field.key : ''}"></div>
            <div class="col-md-3">
                <select class="form-select form-select-sm">
                    <option value="Text" ${field && field.type === 'Text' ? 'selected' : ''}>Text</option>
                    <option value="Select" ${field && field.type === 'Select' ? 'selected' : ''}>Select</option>
                    <option value="Date" ${field && field.type === 'Date' ? 'selected' : ''}>Date</option>
                    <option value="Number" ${field && field.type === 'Number' ? 'selected' : ''}>Number</option>
                    <option value="Checkbox" ${field && field.type === 'Checkbox' ? 'selected' : ''}>Checkbox</option>
                </select>
            </div>
            <div class="col-md-3"><input type="text" class="form-control form-control-sm" placeholder="Подпись" value="${field ? field.label : ''}"></div>
            <div class="col-md-2"><div class="form-check"><input type="checkbox" class="form-check-input" ${field && field.required ? 'checked' : ''}><label class="form-check-label">Обяз.</label></div></div>
            <div class="col-md-1"><button class="btn btn-sm btn-outline-danger" onclick="document.getElementById('fieldRow_${_fieldCounter}').remove()"><i class="bi bi-trash"></i></button></div>
        </div>
    </div>`;
}

function addFieldRow() {
    const noMsg = document.getElementById('noFieldsMsg');
    if (noMsg) noMsg.remove();
    document.getElementById('formFieldsContainer').insertAdjacentHTML('beforeend', buildFieldRow(null, null));
}

let _mappingCounter = 200;
function buildMappingRow(idx, formKey, orderField, formSchema) {
    _mappingCounter++;
    const formKeys = formSchema.map(f => f.key);
    return `
    <div class="field-row" id="mappingRow_${_mappingCounter}">
        <div class="row g-2 align-items-center">
            <div class="col-md-4">
                <input type="text" class="form-control form-control-sm" placeholder="Ключ формы" value="${formKey || ''}" list="formKeysList">
                <datalist id="formKeysList">${formKeys.map(k => `<option value="${k}">`).join('')}</datalist>
            </div>
            <div class="col-md-1 text-center"><i class="bi bi-arrow-right"></i></div>
            <div class="col-md-5">
                <select class="form-select form-select-sm">
                    <option value="">— Поле заказа —</option>
                    ${ORDER_FIELDS.map(f => `<option value="${f}" ${f === orderField ? 'selected' : ''}>${f}</option>`).join('')}
                </select>
            </div>
            <div class="col-md-2"><button class="btn btn-sm btn-outline-danger" onclick="document.getElementById('mappingRow_${_mappingCounter}').remove()"><i class="bi bi-trash"></i></button></div>
        </div>
    </div>`;
}

function addMappingRow() {
    const noMsg = document.getElementById('noMappingMsg');
    if (noMsg) noMsg.remove();
    document.getElementById('mappingContainer').insertAdjacentHTML('beforeend', buildMappingRow(null, '', '', []));
}

// ============================================================
// MASS OPERATIONS
// ============================================================

function toggleAllOrders(checked) {
    document.querySelectorAll('.order-cb').forEach(cb => cb.checked = checked);
    updateMassBar();
}

function updateMassBar() {
    const selected = document.querySelectorAll('.order-cb:checked');
    const bar = document.getElementById('massActionBar');
    if (selected.length > 0) {
        bar.classList.remove('d-none');
        document.getElementById('selectedCount').textContent = selected.length;
    } else {
        bar.classList.add('d-none');
    }
}

function clearSelection() {
    document.querySelectorAll('.order-cb').forEach(cb => cb.checked = false);
    document.getElementById('selectAllOrders').checked = false;
    updateMassBar();
}

function executeMassAction() {
    const defId = document.getElementById('massActionSelect').value;
    if (!defId) { showToast('Выберите действие', 'warning'); return; }
    const def = TRANSACTION_DEFINITIONS.find(d => d.id === parseInt(defId));
    const selected = [...document.querySelectorAll('.order-cb:checked')].map(cb => parseInt(cb.value));

    let applied = 0;
    let skipped = 0;
    selected.forEach(orderId => {
        const order = ORDERS.find(o => o.id === orderId);
        if (!order) return;
        const st = getStatus(order.statusId);
        if (st.isFinal) { skipped++; return; }
        if (def.fromStatusId !== 0 && order.statusId !== def.fromStatusId) { skipped++; return; }
        order.statusId = def.toStatusId;
        TRANSACTIONS.unshift({
            id: TRANSACTIONS.length + 1 + applied,
            orderId: order.id, orderNumber: order.number,
            definitionId: def.id, definitionName: def.name,
            user: 'Админ', date: new Date().toISOString().split('T')[0],
            inputData: {}, oneCStatus: def.oneCDocType ? 'Pending' : null,
            oneCId: null, oneCError: null,
        });
        applied++;
    });

    clearSelection();
    showToast(`Массовое проведение "${def.name}": ${applied} применено, ${skipped} пропущено`, applied > 0 ? 'success' : 'warning');
    renderOrdersTable();
}

// ============================================================
// PIPELINE VISUALIZATION (in transaction modal)
// ============================================================

function renderPipelineSteps(def) {
    const steps = PIPELINE_STEPS.filter(s => {
        if (s.key === 'onec' && !def.oneCDocType) return false;
        return true;
    });
    return `
    <div class="mb-3">
        <small class="text-muted">Pipeline выполнения:</small>
        <div class="d-flex align-items-center gap-1 mt-1 flex-wrap">
            ${steps.map((s, i) => `
                <div class="d-flex align-items-center">
                    <span class="badge bg-light text-dark border px-2 py-1" title="${s.desc}">
                        <i class="bi ${s.icon} me-1"></i>${s.name}
                    </span>
                    ${i < steps.length - 1 ? '<i class="bi bi-chevron-right text-muted mx-1"></i>' : ''}
                </div>
            `).join('')}
        </div>
    </div>`;
}

// ============================================================
// NOTIFICATIONS PAGE
// ============================================================

function renderNotificationsPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Уведомления</h4>
        <button class="btn btn-outline-secondary btn-sm" onclick="markAllRead()"><i class="bi bi-check2-all"></i> Прочитать все</button>
    </div>
    <div class="card">
        <div class="list-group list-group-flush" id="notifList">
            ${NOTIFICATIONS.map(n => {
                const iconMap = { success: 'bi-check-circle-fill text-success', error: 'bi-exclamation-triangle-fill text-danger', info: 'bi-info-circle-fill text-info' };
                return `
                <div class="list-group-item ${n.read ? '' : 'list-group-item-light'}" id="notif_${n.id}">
                    <div class="d-flex align-items-start gap-3">
                        <i class="bi ${iconMap[n.type]} fs-5 mt-1"></i>
                        <div class="flex-grow-1">
                            <div class="${n.read ? 'text-muted' : 'fw-semibold'}">${n.text}</div>
                            <small class="text-muted">${n.date}</small>
                        </div>
                        ${!n.read ? `<button class="btn btn-sm btn-outline-secondary" onclick="markRead(${n.id})"><i class="bi bi-check"></i></button>` : '<i class="bi bi-check2 text-muted"></i>'}
                    </div>
                </div>`;
            }).join('')}
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function markRead(id) {
    const n = NOTIFICATIONS.find(x => x.id === id);
    if (n) n.read = true;
    renderNotificationsPage();
    updateNotifBadge();
}

function markAllRead() {
    NOTIFICATIONS.forEach(n => n.read = true);
    renderNotificationsPage();
    updateNotifBadge();
    showToast('Все уведомления прочитаны', 'info');
}

function updateNotifBadge() {
    const unread = NOTIFICATIONS.filter(n => !n.read).length;
    const badge = document.querySelector('.navbar .position-relative .badge');
    if (badge) badge.textContent = unread || '';
}

// ============================================================
// ARCHIVE PAGE
// ============================================================

function renderArchivePage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0">Архив заказов</h4>
    </div>
    <div class="alert alert-info py-2">
        <i class="bi bi-info-circle"></i> Заказы в конечном статусе (Доставлен, Возврат, Отменён) автоматически архивируются через 6 месяцев.
        Данные хранятся в JSON-формате для экономии места в оперативной БД.
    </div>
    <div class="card mb-3">
        <div class="card-body py-2">
            <input type="text" class="form-control form-control-sm" style="max-width:300px" placeholder="Поиск по номеру заказа..." id="archiveSearch" oninput="renderArchiveTable()">
        </div>
    </div>
    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr><th>№ заказа</th><th>Дата</th><th>Маркетплейс</th><th>Статус</th><th>Клиент</th><th>Сумма</th><th>Архивирован</th><th></th></tr>
                </thead>
                <tbody id="archiveTableBody"></tbody>
            </table>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
    renderArchiveTable();
}

function renderArchiveTable() {
    const search = (document.getElementById('archiveSearch')?.value || '').toLowerCase();
    const filtered = ARCHIVED_ORDERS.filter(o => !search || o.searchNumber.toLowerCase().includes(search));
    document.getElementById('archiveTableBody').innerHTML = filtered.map(o => `
        <tr>
            <td><strong>${o.number}</strong></td>
            <td>${o.date}</td>
            <td><span class="badge ${MP_CSS[o.marketplace] || 'bg-secondary'}">${o.marketplace}</span></td>
            <td><span class="badge bg-secondary">${o.status} <i class="bi bi-lock-fill"></i></span></td>
            <td>${o.client}</td>
            <td>${formatMoney(o.totalSum)}</td>
            <td><small class="text-muted">${o.archivedAt}</small></td>
            <td><button class="btn btn-sm btn-outline-info" onclick="viewArchivedOrder('${o.id}')"><i class="bi bi-eye"></i></button></td>
        </tr>
    `).join('');
}

function viewArchivedOrder(id) {
    const o = ARCHIVED_ORDERS.find(a => a.id === id);
    if (!o) return;
    document.getElementById('modalTitle').textContent = `Архив: ${o.number}`;
    document.getElementById('modalBody').innerHTML = `
        <div class="alert alert-secondary py-2"><i class="bi bi-archive"></i> Этот заказ находится в архиве. Данные доступны только для чтения.</div>
        <table class="table table-sm">
            <tr><th>Номер</th><td>${o.number}</td></tr>
            <tr><th>Дата</th><td>${o.date}</td></tr>
            <tr><th>Маркетплейс</th><td>${o.marketplace}</td></tr>
            <tr><th>Статус</th><td>${o.status}</td></tr>
            <tr><th>Клиент</th><td>${o.client}</td></tr>
            <tr><th>Сумма</th><td>${formatMoney(o.totalSum)}</td></tr>
            <tr><th>Архивирован</th><td>${o.archivedAt}</td></tr>
        </table>
        <div class="mt-2"><small class="text-muted">Полные данные хранятся в <code>FullDataJson</code> (OrderArchiveBlob)</small></div>
    `;
    document.getElementById('modalFooter').innerHTML = `<button class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>`;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

// ============================================================
// STATUS TRANSITIONS (Workflow Graph) PAGE
// ============================================================

function renderStatusTransitionsPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
            <h4 class="mb-0">Граф переходов статусов</h4>
            <p class="text-muted mb-0">
                <i class="bi bi-info-circle me-1"></i>
                Визуализация разрешенных переходов между статусами заказов
                <a href="#" onclick="showDocModal('транзакции.md'); return false;" 
                   data-bs-toggle="tooltip" data-bs-placement="top" title="Подробнее о транзакциях и переходах">
                    <i class="bi bi-box-arrow-up-right ms-1"></i>
                </a>
            </p>
        </div>
        <div>
            <button class="btn btn-outline-secondary btn-sm me-2" onclick="showDocModal('транзакции.md')"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Открыть документацию по транзакциям">
                <i class="bi bi-file-text"></i> Документация
            </button>
            <button class="btn btn-primary btn-sm" onclick="openTransitionModal()"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Добавить новое правило перехода">
                <i class="bi bi-plus-lg"></i> Добавить правило
            </button>
        </div>
    </div>

    <!-- Visual graph -->
    <div class="card mb-4">
        <div class="card-header">
            <i class="bi bi-diagram-3"></i> Визуальная схема переходов
            <small class="text-muted ms-2">
                <a href="#" onclick="showDocModal('транзакции.md'); return false;" 
                   data-bs-toggle="tooltip" data-bs-placement="top" title="Подробнее о графе переходов">
                    <i class="bi bi-question-circle"></i>
                </a>
            </small>
        </div>
        <div class="card-body">
            <div class="d-flex flex-wrap justify-content-center gap-2 mb-3">
                ${STATUSES.map(s => `<span class="badge badge-status ${s.css} px-3 py-2">${s.name}${s.isFinal ? ' <i class="bi bi-lock-fill"></i>' : ''}</span>`).join('')}
            </div>
            <div class="table-responsive">
                <table class="table table-bordered table-sm text-center mb-0" style="font-size:0.8rem">
                    <thead class="table-light">
                        <tr>
                            <th class="text-start">Из \\ В</th>
                            ${STATUSES.map(s => `<th><span class="badge badge-status ${s.css}">${s.name}</span></th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${STATUSES.filter(s => !s.isFinal).map(from => `
                            <tr>
                                <td class="fw-bold">${from.name}</td>
                                ${STATUSES.map(to => {
                                    const trans = STATUS_TRANSITIONS.find(t => t.fromStatusId === from.id && t.toStatusId === to.id);
                                    return `<td class="text-center ${trans ? 'bg-success text-white' : 'bg-light'}">${trans ? '✓' : ''}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Rules Table -->
    <div class="card">
        <div class="card-header">
            <h6 class="mb-0">Таблица правил переходов</h6>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr><th>Из статуса</th><th>В статус</th><th>Транзакция</th><th>Валидация</th><th></th></tr>
                    </thead>
                    <tbody>
                        ${STATUS_TRANSITIONS.map(tr => {
                            const fromSt = STATUSES.find(s => s.id === tr.fromStatusId);
                            const toSt = STATUSES.find(s => s.id === tr.toStatusId);
                            const def = TRANSACTION_DEFINITIONS.find(d => d.id === tr.allowedDefinitionId);
                            return `<tr>
                                <td>${fromSt ? fromSt.name : '?'}</td>
                                <td>${toSt ? toSt.name : '?'}</td>
                                <td>${def ? def.name : 'Любая'}</td>
                                <td><small class="text-muted">${tr.validationRules ? Object.keys(tr.validationRules).join(', ') : 'Нет'}</small></td>
                                <td><button class="btn btn-sm btn-outline-secondary" onclick="openTransitionModal(${tr.id})"><i class="bi bi-pencil"></i></button></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Pipeline Explanation -->
    <div class="card mt-4">
        <div class="card-header">
            <h6 class="mb-0">Pipeline обработки транзакций</h6>
            <small class="text-muted ms-2">
                <a href="#" onclick="showDocModal('транзакции.md'); return false;" 
                   data-bs-toggle="tooltip" data-bs-placement="top" title="Подробнее о pipeline транзакций">
                    <i class="bi bi-question-circle"></i>
                </a>
            </small>
        </div>
        <div class="card-body">
            <div class="row g-3">
                <div class="col-md-3 text-center">
                    <div class="border rounded p-3" 
                         data-bs-toggle="tooltip" data-bs-placement="top" 
                         title="Проверка графа переходов и бизнес-правил">
                        <i class="bi bi-check-circle-fill text-success fs-2"></i>
                        <div class="mt-2"><strong>Validate</strong></div>
                        <small class="text-muted">Проверка условий</small>
                    </div>
                </div>
                <div class="col-md-1 text-center d-flex align-items-center">
                    <i class="bi bi-arrow-right fs-4 text-muted"></i>
                </div>
                <div class="col-md-3 text-center">
                    <div class="border rounded p-3"
                         data-bs-toggle="tooltip" data-bs-placement="top" 
                         title="Складские и финансовые движения">
                        <i class="bi bi-box-seam-fill text-primary fs-2"></i>
                        <div class="mt-2"><strong>Ledger</strong></div>
                        <small class="text-muted">Склад/Финансы</small>
                    </div>
                </div>
                <div class="col-md-1 text-center d-flex align-items-center">
                    <i class="bi bi-arrow-right fs-4 text-muted"></i>
                </div>
                <div class="col-md-3 text-center">
                    <div class="border rounded p-3"
                         data-bs-toggle="tooltip" data-bs-placement="top" 
                         title="Смена статуса и сохранение в БД">
                        <i class="bi bi-database-fill text-info fs-2"></i>
                        <div class="mt-2"><strong>Commit</strong></div>
                        <small class="text-muted">Фиксация</small>
                    </div>
                </div>
            </div>
            <div class="row g-3 mt-3">
                <div class="col-md-3 text-center">
                    <div class="border rounded p-3"
                         data-bs-toggle="tooltip" data-bs-placement="top" 
                         title="Создание документа в 1С через Hangfire">
                        <i class="bi bi-link-45deg text-warning fs-2"></i>
                        <div class="mt-2"><strong>1C Sync</strong></div>
                        <small class="text-muted">Отправка в 1С</small>
                    </div>
                </div>
                <div class="col-md-1 text-center d-flex align-items-center">
                    <i class="bi bi-arrow-right fs-4 text-muted"></i>
                </div>
                <div class="col-md-3 text-center">
                    <div class="border rounded p-3"
                         data-bs-toggle="tooltip" data-bs-placement="top" 
                         title="SignalR уведомление пользователю">
                        <i class="bi bi-bell-fill text-success fs-2"></i>
                        <div class="mt-2"><strong>Notify</strong></div>
                        <small class="text-muted">Уведомления</small>
                    </div>
                </div>
                <div class="col-md-4 text-center d-flex align-items-center justify-content-center">
                    <div class="text-muted">
                        <small>
                            <i class="bi bi-info-circle me-1"></i>
                            Подробности в <a href="#" onclick="showDocModal('транзакции.md'); return false;" 
                                           data-bs-toggle="tooltip" data-bs-placement="top" 
                                           title="Открыть документацию по транзакциям">документации по транзакциям</a>
                        </small>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function generateStatusGraphSVG() {
    const nodes = STATUSES.map((s, i) => ({
        id: s.id,
        label: s.name,
        x: 100 + (i % 5) * 150,
        y: 100 + Math.floor(i / 5) * 100,
        color: getStatusColor(s.id)?.hex || '#ccc'
    }));

    const edges = STATUS_TRANSITIONS.map(tr => ({
        from: nodes.find(n => n.id === tr.fromStatusId),
        to: nodes.find(n => n.id === tr.toStatusId)
    }));

    let svg = '';

    // Draw edges
    edges.forEach(edge => {
        if (edge.from && edge.to) {
            svg += `<line x1="${edge.from.x}" y1="${edge.from.y}" x2="${edge.to.x}" y2="${edge.to.y}" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>`;
        }
    });

    // Draw nodes
    nodes.forEach(node => {
        svg += `<circle cx="${node.x}" cy="${node.y}" r="40" fill="${node.color}" stroke="#fff" stroke-width="3"/>
                <text x="${node.x}" y="${node.y + 5}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${node.label}</text>`;
    });

    return svg;
}

function openTransitionModal(transId) {
    const tr = transId ? STATUS_TRANSITIONS.find(t => t.id === transId) : null;
    const title = tr ? 'Редактировать правило' : 'Новое правило перехода';
    const statusOpts = STATUSES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const defOpts = TRANSACTION_DEFINITIONS.map(d => `<option value="${d.id}" ${tr && tr.allowedDefinitionId === d.id ? 'selected' : ''}>${d.name}</option>`).join('');

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <div class="row g-3 mb-3">
            <div class="col-md-5">
                <label class="form-label">Из статуса</label>
                <select class="form-select">${STATUSES.filter(s => !s.isFinal).map(s => `<option value="${s.id}" ${tr && tr.fromStatusId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
            </div>
            <div class="col-md-2 d-flex align-items-end justify-content-center"><i class="bi bi-arrow-right fs-4"></i></div>
            <div class="col-md-5">
                <label class="form-label">В статус</label>
                <select class="form-select">${statusOpts}</select>
            </div>
        </div>
        <div class="mb-3">
            <label class="form-label">Разрешённая транзакция</label>
            <select class="form-select">${defOpts}</select>
        </div>
        <div class="mb-3">
            <label class="form-label">Правила валидации (JSON)</label>
            <textarea class="form-control font-monospace" rows="3">${tr ? JSON.stringify(tr.validationRules, null, 2) : '{\n  \n}'}</textarea>
            <small class="text-muted">Примеры: requireSupplier, requireWarehouse, requireStockCheck, requirePayment</small>
        </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide(); showToast('Правило сохранено', 'success'); renderStatusTransitionsPage();">Сохранить</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

// ============================================================
// USERS MANAGEMENT PAGE
// ============================================================

function renderUsersPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
            <h4 class="mb-0">Пользователи компании</h4>
            <p class="text-muted mb-0">
                <i class="bi bi-info-circle me-1"></i>
                Управление пользователями, ролями и доступами в системе
                <a href="#" onclick="showDocModal('SaaS multi-tenant .md'); return false;" 
                   data-bs-toggle="tooltip" data-bs-placement="top" title="Подробнее о multi-tenant архитектуре">
                    <i class="bi bi-box-arrow-up-right ms-1"></i>
                </a>
            </p>
        </div>
        <div>
            <button class="btn btn-outline-secondary btn-sm me-2" onclick="showDocModal('SaaS multi-tenant .md')"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Открыть документацию по управлению пользователями">
                <i class="bi bi-file-text"></i> Документация
            </button>
            <button class="btn btn-primary btn-sm" onclick="openUserModal()"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Добавить нового пользователя">
                <i class="bi bi-person-plus"></i> Добавить пользователя
            </button>
        </div>
    </div>
    <div class="alert alert-info py-2">
        <i class="bi bi-info-circle"></i> Управляйте пользователями компании, их ролями и доступом. Текущая компания: <strong>${CURRENT_COMPANY.name}</strong>
    </div>
    <div class="card">
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr><th>Email</th><th>Имя</th><th>Роли</th><th>Статус</th><th>Почта</th><th>Последний вход</th><th></th></tr>
                </thead>
                <tbody>
                    ${USERS.map(u => {
                        const roles = getUserRoles(u.id).map(r => `<span class="badge bg-primary">${r.name}</span>`).join(' ');
                        const statusBadge = u.isActive ? '<span class="badge bg-success">Активен</span>' : '<span class="badge bg-secondary">Заблокирован</span>';
                        const emailBadge = u.isEmailVerified ? '<i class="bi bi-check-circle-fill text-success"></i> Подтверждена' : '<i class="bi bi-exclamation-triangle-fill text-warning"></i> Не подтверждена';
                        return `<tr>
                            <td><strong>${u.email}</strong></td>
                            <td>${u.name}</td>
                            <td>${roles || '<span class="text-muted">Нет ролей</span>'}</td>
                            <td>${statusBadge}</td>
                            <td>${emailBadge} ${!u.isEmailVerified ? `<button class="btn btn-sm btn-outline-warning ms-1" onclick="sendVerificationEmail(${u.id})"><i class="bi bi-envelope"></i></button>` : ''}</td>
                            <td><small>${u.lastLogin || 'Никогда'}</small></td>
                            <td><button class="btn btn-sm btn-outline-secondary" onclick="openUserModal(${u.id})"><i class="bi bi-pencil"></i></button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function openUserModal(userId) {
    const user = userId ? getUser(userId) : null;
    const title = user ? `Редактировать: ${user.name}` : 'Добавить пользователя';
    const userRoles = user ? USER_ROLES.filter(ur => ur.userId === userId).map(ur => ur.roleId) : [];

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <div class="mb-3">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" value="${user ? user.email : ''}" placeholder="user@company.com">
        </div>
        <div class="mb-3">
            <label class="form-label">Имя</label>
            <input type="text" class="form-control" value="${user ? user.name : ''}" placeholder="ФИО">
        </div>
        <div class="mb-3">
            <label class="form-label">Роли</label>
            <div class="border rounded p-2">
                ${ROLES.map(r => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${r.id}" id="role_${r.id}" ${userRoles.includes(r.id) ? 'checked' : ''}>
                        <label class="form-check-label" for="role_${r.id}">${r.name}</label>
                        <small class="text-muted d-block">${r.description}</small>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="row g-3">
            <div class="col-md-6">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="isActive" ${user && user.isActive ? 'checked' : ''}>
                    <label class="form-check-label" for="isActive">Активен</label>
                </div>
            </div>
            <div class="col-md-6">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="isEmailVerified" ${user && user.isEmailVerified ? 'checked' : ''}>
                    <label class="form-check-label" for="isEmailVerified">Почта подтверждена</label>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="saveUser(${userId || 0})">Сохранить</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

function saveUser(userId) {
    const email = document.querySelector('#modalBody input[type="email"]').value;
    const name = document.querySelector('#modalBody input[type="text"]').value;
    const isActive = document.getElementById('isActive').checked;
    const isEmailVerified = document.getElementById('isEmailVerified').checked;
    const selectedRoles = [...document.querySelectorAll('#modalBody input[type="checkbox"]:checked')].filter(cb => cb.id.startsWith('role_')).map(cb => parseInt(cb.value));

    if (!email || !name) { showToast('Заполните email и имя', 'warning'); return; }

    if (userId) {
        // Update existing
        const user = getUser(userId);
        user.email = email;
        user.name = name;
        user.isActive = isActive;
        user.isEmailVerified = isEmailVerified;
        // Update roles
        USER_ROLES.splice(0, USER_ROLES.length, ...USER_ROLES.filter(ur => ur.userId !== userId));
        selectedRoles.forEach(roleId => USER_ROLES.push({ userId, roleId }));
    } else {
        // Add new
        const newId = Math.max(...USERS.map(u => u.id)) + 1;
        USERS.push({
            id: newId,
            email,
            name,
            isEmailVerified,
            isActive,
            createdAt: new Date().toISOString().split('T')[0],
            lastLogin: null
        });
        selectedRoles.forEach(roleId => USER_ROLES.push({ userId: newId, roleId }));
    }

    bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide();
    showToast('Пользователь сохранён', 'success');
    renderUsersPage();
}

// Email verification simulation
function sendVerificationEmail(userId) {
    const user = getUser(userId);
    if (!user) return;
    // Simulate sending email
    showToast(`Письмо с подтверждением отправлено на ${user.email}`, 'info');
    // In real app, this would trigger actual email send
}

// ============================================================
// ROLES MANAGEMENT PAGE
// ============================================================

function renderRolesPage() {
    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
            <h4 class="mb-0">Управление ролями</h4>
            <p class="text-muted mb-0">
                <i class="bi bi-info-circle me-1"></i>
                Определение ролей и прав доступа для пользователей
                <a href="#" onclick="showDocModal('Code Quality.md'); return false;" 
                   data-bs-toggle="tooltip" data-bs-placement="top" title="Подробнее о безопасности и правах доступа">
                    <i class="bi bi-box-arrow-up-right ms-1"></i>
                </a>
            </p>
        </div>
        <div>
            <button class="btn btn-outline-secondary btn-sm me-2" onclick="showDocModal('Code Quality.md')"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Открыть документацию по управлению доступом">
                <i class="bi bi-file-text"></i> Документация
            </button>
            <button class="btn btn-primary btn-sm" onclick="openRoleModal()"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Создать новую роль">
                <i class="bi bi-shield-plus"></i> Создать роль
            </button>
        </div>
    </div>
    <div class="alert alert-info py-2">
        <i class="bi bi-info-circle"></i> Определяйте роли и права доступа для пользователей компании.
    </div>
    <div class="row g-3">
        ${ROLES.map(r => {
            const perms = ROLE_PERMISSIONS.filter(rp => rp.roleId === r.id).map(rp => PERMISSIONS.find(p => p.id === rp.permissionId)).filter(Boolean);
            const userCount = USER_ROLES.filter(ur => ur.roleId === r.id).length;
            return `
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-header d-flex justify-content-between">
                        <strong>${r.name}</strong>
                        <button class="btn btn-sm btn-outline-secondary" onclick="openRoleModal(${r.id})"><i class="bi bi-pencil"></i></button>
                    </div>
                    <div class="card-body">
                        <p class="text-muted mb-2">${r.description}</p>
                        <div class="mb-2"><small class="text-muted">Пользователей: ${userCount}</small></div>
                        <div><strong>Права:</strong></div>
                        <div class="d-flex flex-wrap gap-1">
                            ${perms.map(p => `<span class="badge bg-light text-dark">${p.name}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('')}
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function openRoleModal(roleId) {
    const role = roleId ? getRole(roleId) : null;
    const title = role ? `Редактировать: ${role.name}` : 'Создать роль';
    const rolePerms = role ? ROLE_PERMISSIONS.filter(rp => rp.roleId === roleId).map(rp => rp.permissionId) : [];

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = `
        <div class="mb-3">
            <label class="form-label">Название роли</label>
            <input type="text" class="form-control" value="${role ? role.name : ''}" placeholder="Администратор">
        </div>
        <div class="mb-3">
            <label class="form-label">Описание</label>
            <textarea class="form-control" rows="2" placeholder="Полный доступ ко всем функциям">${role ? role.description : ''}</textarea>
        </div>
        <div class="mb-3">
            <label class="form-label">Права доступа</label>
            <div class="border rounded p-2" style="max-height:300px; overflow-y:auto">
                ${PERMISSIONS.map(p => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" value="${p.id}" id="perm_${p.id}" ${rolePerms.includes(p.id) ? 'checked' : ''}>
                        <label class="form-check-label" for="perm_${p.id}">${p.name}</label>
                        <small class="text-muted d-block"><code>${p.key}</code></small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="saveRole(${roleId || 0})">Сохранить</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

function saveRole(roleId) {
    const name = document.querySelector('#modalBody input[type="text"]').value;
    const desc = document.querySelector('#modalBody textarea').value;
    const selectedPerms = [...document.querySelectorAll('#modalBody input[type="checkbox"]:checked')].filter(cb => cb.id.startsWith('perm_')).map(cb => parseInt(cb.value));

    if (!name) { showToast('Укажите название роли', 'warning'); return; }

    if (roleId) {
        // Update existing
        const role = getRole(roleId);
        role.name = name;
        role.description = desc;
        // Update permissions
        ROLE_PERMISSIONS.splice(0, ROLE_PERMISSIONS.length, ...ROLE_PERMISSIONS.filter(rp => rp.roleId !== roleId));
        selectedPerms.forEach(permId => ROLE_PERMISSIONS.push({ roleId, permissionId: permId }));
    } else {
        // Add new
        const newId = Math.max(...ROLES.map(r => r.id)) + 1;
        ROLES.push({ id: newId, name, description: desc });
        selectedPerms.forEach(permId => ROLE_PERMISSIONS.push({ roleId: newId, permissionId: permId }));
    }

    bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide();
    showToast('Роль сохранена', 'success');
    renderRolesPage();
}

// ============================================================
// HANGFIRE JOBS DASHBOARD
// ============================================================

function renderHangfirePage() {
    const jobs = HANGFIRE_JOBS;
    const stats = {
        succeeded: jobs.filter(j => j.state === 'Succeeded').length,
        processing: jobs.filter(j => j.state === 'Processing').length,
        enqueued: jobs.filter(j => j.state === 'Enqueued').length,
        failed: jobs.filter(j => j.state === 'Failed').length,
        scheduled: jobs.filter(j => j.state === 'Scheduled').length
    };

    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
            <h4 class="mb-0">Hangfire Dashboard</h4>
            <p class="text-muted mb-0">
                <i class="bi bi-info-circle me-1"></i>
                Мониторинг фоновых задач и очередей
                <a href="#" onclick="showDocModal('SaaS+Hangfire.md'); return false;" 
                   data-bs-toggle="tooltip" data-bs-placement="top" title="Подробнее о Hangfire в Multi-Tenant">
                    <i class="bi bi-box-arrow-up-right ms-1"></i>
                </a>
            </p>
        </div>
        <div>
            <button class="btn btn-outline-secondary btn-sm me-2" onclick="showDocModal('SaaS+Hangfire.md')"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Открыть документацию по Hangfire">
                <i class="bi bi-file-text"></i> Документация
            </button>
            <button class="btn btn-primary btn-sm" onclick="showToast('Обновление задач...', 'info');"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Обновить список задач">
                <i class="bi bi-arrow-clockwise"></i> Обновить
            </button>
        </div>
    </div>

    <!-- Stats Cards -->
    <div class="row g-3 mb-4">
        <div class="col-md-2">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-success">${stats.succeeded}</h3>
                    <small class="text-muted">Succeeded</small>
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-primary">${stats.processing}</h3>
                    <small class="text-muted">Processing</small>
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-secondary">${stats.enqueued}</h3>
                    <small class="text-muted">Enqueued</small>
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-danger">${stats.failed}</h3>
                    <small class="text-muted">Failed</small>
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-warning">${stats.scheduled}</h3>
                    <small class="text-muted">Scheduled</small>
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-info">${jobs.length}</h3>
                    <small class="text-muted">Total</small>
                </div>
            </div>
        </div>
    </div>

    <!-- Jobs Table -->
    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Задачи</h6>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" onclick="filterHangfireJobs('all')">Все</button>
                <button class="btn btn-outline-success" onclick="filterHangfireJobs('Succeeded')">Succeeded</button>
                <button class="btn btn-outline-primary" onclick="filterHangfireJobs('Processing')">Processing</button>
                <button class="btn btn-outline-danger" onclick="filterHangfireJobs('Failed')">Failed</button>
            </div>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Имя задачи</th>
                            <th>Статус</th>
                            <th>Создано</th>
                            <th>Запущено</th>
                            <th>Завершено</th>
                            <th>Длительность</th>
                            <th>Очередь</th>
                            <th>Сервер</th>
                            <th>Повторы</th>
                            <th>Ошибка</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="hangfireJobsTableBody">
                        ${jobs.map(job => `
                            <tr>
                                <td>${job.id}</td>
                                <td><strong>${job.jobName}</strong></td>
                                <td><span class="${getJobStateBadge(job.state)}">${job.state}</span></td>
                                <td><small>${job.createdAt}</small></td>
                                <td><small>${job.startedAt || '-'}</small></td>
                                <td><small>${job.completedAt || '-'}</small></td>
                                <td><small>${job.duration || '-'}</small></td>
                                <td><small>${job.queue}</small></td>
                                <td><small>${job.serverName || '-'}</small></td>
                                <td><small>${job.retryCount}</small></td>
                                <td><small class="text-danger">${job.error || '-'}</small></td>
                                <td>
                                    <button class="btn btn-sm btn-outline-secondary" onclick="viewHangfireJobDetails(${job.id})"><i class="bi bi-eye"></i></button>
                                    ${job.state === 'Failed' ? `<button class="btn btn-sm btn-outline-warning ms-1" onclick="retryHangfireJob(${job.id})"><i class="bi bi-arrow-clockwise"></i></button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function filterHangfireJobs(state) {
    const tbody = document.getElementById('hangfireJobsTableBody');
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const jobState = row.querySelector('td:nth-child(3) span').textContent;
        if (state === 'all' || jobState === state) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function viewHangfireJobDetails(jobId) {
    const job = HANGFIRE_JOBS.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('modalTitle').textContent = `Детали задачи: ${job.jobName}`;
    document.getElementById('modalBody').innerHTML = `
        <div class="row g-3">
            <div class="col-md-6">
                <strong>ID:</strong> ${job.id}<br>
                <strong>Имя:</strong> ${job.jobName}<br>
                <strong>Статус:</strong> <span class="${getJobStateBadge(job.state)}">${job.state}</span><br>
                <strong>Очередь:</strong> ${job.queue}<br>
                <strong>Сервер:</strong> ${job.serverName || 'Не назначен'}<br>
                <strong>Повторы:</strong> ${job.retryCount}
            </div>
            <div class="col-md-6">
                <strong>Создано:</strong> ${job.createdAt}<br>
                <strong>Запущено:</strong> ${job.startedAt || 'Не запущено'}<br>
                <strong>Завершено:</strong> ${job.completedAt || 'Не завершено'}<br>
                <strong>Длительность:</strong> ${job.duration || 'Не измерено'}
            </div>
            ${job.error ? `
            <div class="col-12">
                <strong class="text-danger">Ошибка:</strong>
                <div class="alert alert-danger py-2">${job.error}</div>
            </div>
            ` : ''}
        </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
        ${job.state === 'Failed' ? `<button class="btn btn-warning" onclick="retryHangfireJob(${job.id}); bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide();">Повторить</button>` : ''}
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

function retryHangfireJob(jobId) {
    const job = HANGFIRE_JOBS.find(j => j.id === jobId);
    if (job) {
        job.retryCount++;
        job.state = 'Enqueued';
        job.error = null;
        showToast(`Задача ${job.jobName} повторно поставлена в очередь`, 'info');
        renderHangfirePage();
    }
}

// ============================================================
// TECH SUPPORT PAGE
// ============================================================

function renderSupportPage() {
    const tickets = SUPPORT_TICKETS;
    const stats = {
        open: tickets.filter(t => t.status === 'Open').length,
        inProgress: tickets.filter(t => t.status === 'In Progress').length,
        closed: tickets.filter(t => t.status === 'Closed').length
    };

    let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
            <h4 class="mb-0">Техническая поддержка</h4>
            <p class="text-muted mb-0">
                <i class="bi bi-info-circle me-1"></i>
                Создание и отслеживание тикетов технической поддержки
            </p>
        </div>
        <div>
            <button class="btn btn-outline-secondary btn-sm me-2"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Справка по работе с тикетами">
                <i class="bi bi-question-circle"></i> Справка
            </button>
            <button class="btn btn-primary btn-sm" onclick="openNewTicketModal()"
                    data-bs-toggle="tooltip" data-bs-placement="left" title="Создать новый тикет">
                <i class="bi bi-plus-circle"></i> Создать тикет
            </button>
        </div>
    </div>

    <!-- Stats Cards -->
    <div class="row g-3 mb-4">
        <div class="col-md-4">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-danger">${stats.open}</h3>
                    <small class="text-muted">Открытые</small>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-warning">${stats.inProgress}</h3>
                    <small class="text-muted">В работе</small>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card text-center">
                <div class="card-body">
                    <h3 class="text-success">${stats.closed}</h3>
                    <small class="text-muted">Закрытые</small>
                </div>
            </div>
        </div>
    </div>

    <!-- Tickets List -->
    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h6 class="mb-0">Мои тикеты</h6>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary active" onclick="filterTickets('all')">Все</button>
                <button class="btn btn-outline-danger" onclick="filterTickets('Open')">Открытые</button>
                <button class="btn btn-outline-warning" onclick="filterTickets('In Progress')">В работе</button>
                <button class="btn btn-outline-success" onclick="filterTickets('Closed')">Закрытые</button>
            </div>
        </div>
        <div class="card-body">
            <div class="list-group" id="ticketsList">
                ${tickets.map(ticket => `
                    <div class="list-group-item list-group-item-action ticket-item" data-status="${ticket.status}" onclick="viewTicketDetails(${ticket.id})">
                        <div class="d-flex w-100 justify-content-between">
                            <h6 class="mb-1">${ticket.title}</h6>
                            <small class="text-muted">${ticket.createdAt}</small>
                        </div>
                        <p class="mb-1">${ticket.description}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="${getTicketStatusBadge(ticket.status)} me-2">${ticket.status}</span>
                                <span class="${getTicketPriorityBadge(ticket.priority)}">${ticket.priority}</span>
                            </div>
                            <small class="text-muted">
                                ${ticket.assignedTo ? `Назначен: ${ticket.assignedTo}` : 'Не назначен'}
                                • ${ticket.comments.length} комментариев
                            </small>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>`;
    document.getElementById('pageContent').innerHTML = html;
}

function openNewTicketModal() {
    document.getElementById('modalTitle').textContent = 'Создать новый тикет';
    document.getElementById('modalBody').innerHTML = `
        <div class="mb-3">
            <label class="form-label">Заголовок</label>
            <input type="text" class="form-control" id="ticketTitle" placeholder="Краткое описание проблемы">
        </div>
        <div class="mb-3">
            <label class="form-label">Описание</label>
            <textarea class="form-control" id="ticketDescription" rows="4" placeholder="Подробное описание проблемы"></textarea>
        </div>
        <div class="mb-3">
            <label class="form-label">Приоритет</label>
            <select class="form-select" id="ticketPriority">
                <option value="Low">Низкий</option>
                <option value="Medium" selected>Средний</option>
                <option value="High">Высокий</option>
            </select>
        </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="createNewTicket()">Создать</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

function createNewTicket() {
    const title = document.getElementById('ticketTitle').value;
    const description = document.getElementById('ticketDescription').value;
    const priority = document.getElementById('ticketPriority').value;

    if (!title || !description) {
        showToast('Заполните заголовок и описание', 'warning');
        return;
    }

    const newId = Math.max(...SUPPORT_TICKETS.map(t => t.id)) + 1;
    SUPPORT_TICKETS.push({
        id: newId,
        title,
        description,
        status: 'Open',
        priority,
        createdBy: 'Текущий пользователь', // В реальном приложении брать из сессии
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        assignedTo: null,
        lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19),
        comments: []
    });

    bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide();
    showToast('Тикет создан', 'success');
    renderSupportPage();
}

function filterTickets(status) {
    const items = document.querySelectorAll('.ticket-item');
    items.forEach(item => {
        const itemStatus = item.getAttribute('data-status');
        if (status === 'all' || itemStatus === status) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    // Update active button
    document.querySelectorAll('#ticketsList').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function viewTicketDetails(ticketId) {
    const ticket = SUPPORT_TICKETS.find(t => t.id === ticketId);
    if (!ticket) return;

    let commentsHtml = ticket.comments.map(c => `
        <div class="border-start border-primary ps-3 mb-3">
            <strong>${c.user}</strong> <small class="text-muted">${c.date}</small>
            <p class="mb-0">${c.text}</p>
        </div>
    `).join('') || '<p class="text-muted">Комментариев нет</p>';

    document.getElementById('modalTitle').textContent = `Тикет #${ticket.id}: ${ticket.title}`;
    document.getElementById('modalBody').innerHTML = `
        <div class="row g-3 mb-3">
            <div class="col-md-6">
                <strong>Статус:</strong> <span class="${getTicketStatusBadge(ticket.status)}">${ticket.status}</span><br>
                <strong>Приоритет:</strong> <span class="${getTicketPriorityBadge(ticket.priority)}">${ticket.priority}</span><br>
                <strong>Создан:</strong> ${ticket.createdAt}<br>
                <strong>Автор:</strong> ${ticket.createdBy}
            </div>
            <div class="col-md-6">
                <strong>Назначен:</strong> ${ticket.assignedTo || 'Не назначен'}<br>
                <strong>Последнее обновление:</strong> ${ticket.lastUpdated}
            </div>
        </div>
        <div class="mb-3">
            <strong>Описание:</strong>
            <p>${ticket.description}</p>
        </div>
        <div class="mb-3">
            <strong>Комментарии:</strong>
            <div class="mt-2">${commentsHtml}</div>
        </div>
        ${ticket.status !== 'Closed' ? `
        <div class="mb-3">
            <label class="form-label">Добавить комментарий</label>
            <textarea class="form-control" id="newComment" rows="2" placeholder="Ваш комментарий"></textarea>
        </div>
        ` : ''}
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
        ${ticket.status !== 'Closed' ? `<button class="btn btn-primary" onclick="addComment(${ticket.id})">Добавить комментарий</button>` : ''}
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

function addComment(ticketId) {
    const commentText = document.getElementById('newComment').value;
    if (!commentText.trim()) {
        showToast('Введите текст комментария', 'warning');
        return;
    }

    const ticket = SUPPORT_TICKETS.find(t => t.id === ticketId);
    ticket.comments.push({
        user: 'Текущий пользователь', // В реальном приложении брать из сессии
        text: commentText,
        date: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
    ticket.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 19);

    showToast('Комментарий добавлен', 'success');
    bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide();
    renderSupportPage();
}

// --- Status Mappings Page ---
function renderStatusMappingsPage() {
    const tenantId = CURRENT_COMPANY.id;
    const mappings = getStatusMappings(tenantId);
    const unknownStatuses = getUnknownStatuses(tenantId);
    
    // Group by source
    const grouped = {};
    mappings.forEach(m => {
        if (!grouped[m.source]) grouped[m.source] = [];
        grouped[m.source].push(m);
    });
    
    let html = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2><i class="bi bi-diagram-3 me-2"></i>Маппинг статусов интеграций</h2>
                <p class="text-muted mb-0">
                    <i class="bi bi-info-circle me-1"></i>
                    Решение проблемы <a href="#" onclick="showDocModal('маппинг статусов.md'); return false;" 
                                       data-bs-toggle="tooltip" data-bs-placement="top" 
                                       title="Открыть документацию по маппингу статусов">
                        <u>"Вавилонской башни статусов"</u>
                    </a> - динамическое сопоставление статусов маркетплейсов и 1С
                </p>
            </div>
            <div>
                <button class="btn btn-outline-secondary me-2" onclick="showDocModal('маппинг статусов.md')"
                        data-bs-toggle="tooltip" data-bs-placement="left" title="Открыть полную документацию">
                    <i class="bi bi-file-text"></i> Документация
                </button>
                <button class="btn btn-outline-secondary" onclick="resetToDefaults()"
                        data-bs-toggle="tooltip" data-bs-placement="left" title="Сбросить все пользовательские настройки к значениям по умолчанию">
                    <i class="bi bi-arrow-counterclockwise"></i> Сбросить к дефолту
                </button>
            </div>
        </div>
        
        ${unknownStatuses.length > 0 ? `
        <div class="alert alert-warning mb-3">
            <i class="bi bi-exclamation-triangle me-2"></i>
            <strong>Обнаружены новые статусы!</strong> Настройте маппинг для статусов, помеченных как "Не настроено".
        </div>
        ` : ''}
        
        <div class="card">
            <div class="card-body">
    `;
    
    Object.entries(grouped).forEach(([source, sourceMappings]) => {
        html += `
            <h5 class="mb-3">
                <span class="badge bg-primary me-2">${source}</span>
                ${source === 'Ozon' ? '<i class="bi bi-bag"></i>' : 
                  source === 'Wildberries' ? '<i class="bi bi-bag-fill"></i>' :
                  source === 'Yandex Market' ? '<i class="bi bi-cart"></i>' :
                  source === '1C' ? '<i class="bi bi-database"></i>' : ''}
            </h5>
            <div class="table-responsive mb-4">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Статус источника</th>
                            <th>Ключ</th>
                            <th>Статус в системе</th>
                            <th>Действие</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        sourceMappings.forEach(mapping => {
            const isUnknown = mapping.internalStatusId === null;
            const statusBadge = mapping.internalStatusId ? 
                `<span class="badge ${getStatus(mapping.internalStatusId).css}">${getStatus(mapping.internalStatusId).name}</span>` :
                '<span class="badge bg-warning">⚠️ Не настроено</span>';
            
            const isUserMapping = mapping.tenantId === tenantId;
            
            html += `
                <tr class="${isUnknown ? 'table-warning' : ''}">
                    <td>
                        ${mapping.externalName}
                        ${isUserMapping ? '<span class="badge bg-info ms-1">Пользовательский</span>' : ''}
                    </td>
                    <td><code>${mapping.externalKey}</code></td>
                    <td>
                        <select class="form-select form-select-sm" id="mapping-${mapping.id}" 
                                ${!isUserMapping ? 'disabled' : ''}>
                            <option value="">Выберите статус</option>
                            ${STATUSES.map(s => `
                                <option value="${s.id}" ${mapping.internalStatusId === s.id ? 'selected' : ''}>
                                    ${s.name}
                                </option>
                            `).join('')}
                        </select>
                        ${!isUserMapping ? '<small class="text-muted">Глобальная настройка</small>' : ''}
                    </td>
                    <td>
                        ${isUserMapping ? `
                            <button class="btn btn-sm btn-success" onclick="saveMapping(${mapping.id})">
                                <i class="bi bi-check"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteMapping(${mapping.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline-primary" onclick="createUserMapping(${mapping.id})">
                                <i class="bi bi-plus"></i> Переопределить
                            </button>
                        `}
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-info-circle me-2"></i>Как это работает?</h6>
            </div>
            <div class="card-body">
                <ul class="mb-0">
                    <li>Система автоматически определяет статус заказа при импорте из маркетплейса или 1С 
                        <a href="#" onclick="showDocModal('Адаптеры заказов.md'); return false;" 
                           data-bs-toggle="tooltip" data-bs-placement="top" title="Подробнее об адаптерах заказов">
                            <i class="bi bi-box-arrow-up-right ms-1"></i>
                        </a>
                    </li>
                    <li>Глобальные настройки применяются ко всем клиентам</li>
                    <li>Пользовательские настройки переопределяют глобальные для вашего тенанта</li>
                    <li>Если статус неизвестен, заказ создается со статусом "Отменён" и появляется в этом списке</li>
                    <li>Обратная синхронизация настраивается в <a href="#" onclick="navigateTo('transaction-definitions'); return false;"
                           data-bs-toggle="tooltip" data-bs-placement="top" title="Перейти к конструктору транзакций">конструкторе транзакций</a></li>
                </ul>
                <div class="mt-3">
                    <small class="text-muted">
                        <i class="bi bi-book me-1"></i>
                        Подробности в документации: 
                        <a href="#" onclick="showDocModal('маппинг статусов.md'); return false;" 
                           data-bs-toggle="tooltip" data-bs-placement="top" title="Открыть полную документацию по маппингу статусов">
                            Маппинг статусов
                        </a> •
                        <a href="#" onclick="showDocModal('интеграция с 1С.md'); return false;" 
                           data-bs-toggle="tooltip" data-bs-placement="top" title="Открыть документацию по интеграции с 1С">
                            Интеграция с 1С
                        </a>
                    </small>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('pageContent').innerHTML = html;
}

function saveMapping(mappingId) {
    const select = document.getElementById(`mapping-${mappingId}`);
    const statusId = parseInt(select.value);
    
    if (!statusId) {
        showToast('Выберите статус', 'warning');
        return;
    }
    
    // В реальной системе здесь был бы API вызов
    const mapping = STATUS_MAPPINGS.find(m => m.id === mappingId);
    if (mapping) {
        mapping.internalStatusId = statusId;
        showToast('Маппинг сохранен', 'success');
        renderStatusMappingsPage();
    }
}

function deleteMapping(mappingId) {
    if (!confirm('Удалить пользовательский маппинг?')) return;
    
    // В реальной системе здесь был бы API вызов
    const index = STATUS_MAPPINGS.findIndex(m => m.id === mappingId);
    if (index > -1) {
        STATUS_MAPPINGS.splice(index, 1);
        showToast('Маппинг удален', 'success');
        renderStatusMappingsPage();
    }
}

function createUserMapping(globalMappingId) {
    const globalMapping = STATUS_MAPPINGS.find(m => m.id === globalMappingId);
    if (!globalMapping) return;
    
    const newMapping = {
        id: Math.max(...STATUS_MAPPINGS.map(m => m.id)) + 1,
        tenantId: CURRENT_COMPANY.id,
        source: globalMapping.source,
        externalKey: globalMapping.externalKey,
        externalName: globalMapping.externalName,
        internalStatusId: globalMapping.internalStatusId
    };
    
    STATUS_MAPPINGS.push(newMapping);
    showToast('Создана пользовательская копия маппинга', 'success');
    renderStatusMappingsPage();
}

function resetToDefaults() {
    if (!confirm('Сбросить все пользовательские настройки к значениям по умолчанию?')) return;
    
    // Удаляем все пользовательские маппинги для текущего тенанта
    const initialLength = STATUS_MAPPINGS.length;
    STATUS_MAPPINGS = STATUS_MAPPINGS.filter(m => m.tenantId !== CURRENT_COMPANY.id);
    
    const deletedCount = initialLength - STATUS_MAPPINGS.length;
    showToast(`Сброшено ${deletedCount} пользовательских настроек`, 'success');
    renderStatusMappingsPage();
}

// --- Documentation Modal ---
function showDocModal(docFile) {
    const docMap = {
        'маппинг статусов.md': {
            title: 'Маппинг статусов',
            content: `
                <h5>Решение "Вавилонской башни статусов"</h5>
                <p>Система динамического сопоставления статусов маркетплейсов и 1С.</p>
                <h6>Ключевые принципы:</h6>
                <ul>
                    <li><strong>Fallback стратегия:</strong> Тенант → Глобальный → Ошибка</li>
                    <li><strong>Авто-обнаружение:</strong> Неизвестные статусы помечаются как "Не настроено"</li>
                    <li><strong>Обратная синхронизация:</strong> Через конструктор транзакций</li>
                </ul>
                <h6>Использование:</h6>
                <ol>
                    <li>При импорте заказа система вызывает <code>resolveStatus()</code></li>
                    <li>Сначала ищется пользовательский маппинг</li>
                    <li>Затем глобальный маппинг</li>
                    <li>Если не найден - статус "Ошибка маппинга"</li>
                </ol>
            `
        },
        'транзакции.md': {
            title: 'Конструктор транзакций',
            content: `
                <h5>Архитектура конструктора бизнес-транзакций</h5>
                <p>Мета-модель для определения бизнес-процессов и проводок.</p>
                <h6>Компоненты:</h6>
                <ul>
                    <li><strong>TransactionDefinition:</strong> Мета-описание транзакции</li>
                    <li><strong>TransactionRecord:</strong> Журнал проведений</li>
                    <li><strong>Pipeline:</strong> Validate → Ledger → Commit → 1C → Notify</li>
                </ul>
                <h6>Преимущества:</h6>
                <ul>
                    <li>Динамические формы из JSON schema</li>
                    <li>Визуальный граф переходов</li>
                    <li>Интеграция с 1С через Outbox паттерн</li>
                </ul>
            `
        },
        'SaaS multi-tenant .md': {
            title: 'Multi-Tenant архитектура',
            content: `
                <h5>Изоляция данных по клиентам</h5>
                <p>Каждый клиент имеет отдельную базу данных для полной изоляции.</p>
                <h6>Ключевые компоненты:</h6>
                <ul>
                    <li><strong>TenantMiddleware:</strong> Определение тенанта по субдомену</li>
                    <li><strong>Scoped DbContext:</strong> Подключение к БД клиента</li>
                    <li><strong>MasterDbContext:</strong> Управление тенантами</li>
                </ul>
                <h6>Преимущества:</h6>
                <ul>
                    <li>Полная изоляция данных</li>
                    <li>Независимое масштабирование</li>
                    <li>Персонализация под каждого клиента</li>
                </ul>
            `
        },
        'Code Quality.md': {
            title: 'Управление доступом',
            content: `
                <h5>Роли и права доступа</h5>
                <p>Гибкая система управления доступом на основе ролей.</p>
                <h6>Сущности:</h6>
                <ul>
                    <li><strong>User:</strong> Пользователь системы</li>
                    <li><strong>Role:</strong> Набор прав доступа</li>
                    <li><strong>Permission:</strong> Конкретное право (orders.view, transactions.execute)</li>
                </ul>
                <h6>Проверка доступа:</h6>
                <ul>
                    <li>Атрибуты на контроллерах</li>
                    <li>Функция <code>hasPermission(userId, permKey)</code></li>
                    <li>UI скрывает недоступные элементы</li>
                </ul>
            `
        },
        'SaaS+Hangfire.md': {
            title: 'Hangfire в Multi-Tenant',
            content: `
                <h5>Фоновые задачи с изоляцией по тенантам</h5>
                <p>Hangfire для обработки фоновых задач в мультитенантной системе.</p>
                <h6>Особенности:</h6>
                <ul>
                    <li><strong>TenantId в аргументах:</strong> Каждая задача знает свой тенант</li>
                    <li><strong>Отдельные очереди:</strong> По типам задач</li>
                    <li><strong>Мониторинг:</strong> Dashboard с фильтрацией</li>
                </ul>
                <h6>Типы задач:</h6>
                <ul>
                    <li>Синхронизация с маркетплейсами</li>
                    <li>Экспорт в 1С</li>
                    <li>Архивация старых данных</li>
                    <li>Отправка уведомлений</li>
                </ul>
            `
        },
        'интеграция с 1С.md': {
            title: 'Интеграция с 1С',
            content: `
                <h5>Интеграция с 1С:Предприятие</h5>
                <p>Надежная интеграция через Outbox паттерн и Hangfire.</p>
                <h6>Архитектура:</h6>
                <ul>
                    <li><strong>Outbox:</strong> Гарантированная доставка</li>
                    <li><strong>Hangfire:</strong> Фоновая обработка</li>
                    <li><strong>Идемпотентность:</strong> One TransactionId = One Document</li>
                </ul>
                <h6>Преимущества:</h6>
                <ul>
                    <li>Отказоустойчивость</li>
                    <li>Отслеживание статуса</li>
                    <li>Автоматические ретраи</li>
                </ul>
            `
        },
        'Адаптеры заказов.md': {
            title: 'Адаптеры заказов',
            content: `
                <h5>Адаптеры для маркетплейсов</h5>
                <p>Унифицированный интерфейс для работы с разными API.</p>
                <h6>Компоненты:</h6>
                <ul>
                    <li><strong>IOrderAdapter:</strong> Общий интерфейс</li>
                    <li><strong>Enricher Pipeline:</strong> Обогащение данных</li>
                    <li><strong>IHttpClientFactory:</strong> HTTP клиенты</li>
                </ul>
                <h6>Поддерживаемые МП:</h6>
                <ul>
                    <li>Ozon API</li>
                    <li>Wildberries API</li>
                    <li>Yandex Market API</li>
                </ul>
            `
        }
    };
    
    const doc = docMap[docFile] || { title: 'Документация', content: '<p>Документация не найдена</p>' };
    
    document.getElementById('modalTitle').innerHTML = `
        <i class="bi bi-file-text me-2"></i>${doc.title}
    `;
    document.getElementById('modalBody').innerHTML = doc.content;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

// --- SaaS Admin Dashboard ---
function renderSaaSAdminPage() {
    const metrics = SAAS_SYSTEM_METRICS;
    const tenants = SAAS_TENANTS;
    
    let html = `
    <div class="saas-admin-dashboard">
        <!-- Header -->
        <div class="saas-header mb-4">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h4 class="mb-0 text-white">
                        <i class="bi bi-server me-2"></i>SaaS Admin Console
                    </h4>
                    <p class="text-muted mb-0">
                        <i class="bi bi-info-circle me-1"></i>
                        Multi-Tenant Management System
                        <a href="#" onclick="showDocModal('SaaS multi-tenant .md'); return false;" 
                           data-bs-toggle="tooltip" data-bs-placement="top" title="SaaS Architecture Documentation">
                            <i class="bi bi-box-arrow-up-right ms-1"></i>
                        </a>
                    </p>
                </div>
                <div>
                    <button class="btn btn-outline-light btn-sm me-2" onclick="showDocModal('SaaS multi-tenant .md')"
                            data-bs-toggle="tooltip" data-bs-placement="left" title="Documentation">
                        <i class="bi bi-file-text"></i> Docs
                    </button>
                    <button class="btn btn-success btn-sm" onclick="createNewTenant()"
                            data-bs-toggle="tooltip" data-bs-placement="left" title="Add New Client">
                        <i class="bi bi-plus-circle"></i> New Client
                    </button>
                </div>
            </div>
        </div>

        <!-- System Overview -->
        <div class="row g-3 mb-4">
            <div class="col-md-3">
                <div class="saas-metric-card">
                    <div class="metric-icon">
                        <i class="bi bi-building"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-value">${metrics.totalTenants}</div>
                        <div class="metric-label">Total Clients</div>
                        <div class="metric-details">
                            <span class="text-success">+${metrics.trialTenants} trial</span>
                            <span class="text-danger ms-2">- ${metrics.suspendedTenants} suspended</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="saas-metric-card">
                    <div class="metric-icon">
                        <i class="bi bi-currency-dollar"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-value">${formatMoney(metrics.monthlyRevenue)}</div>
                        <div class="metric-label">Monthly Revenue</div>
                        <div class="metric-details">
                            <span class="text-success">+12% vs last month</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="saas-metric-card">
                    <div class="metric-icon">
                        <i class="bi bi-cart3"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-value">${metrics.totalOrders}</div>
                        <div class="metric-label">Total Orders</div>
                        <div class="metric-details">
                            <span class="text-info">${metrics.totalUsers} users</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="saas-metric-card">
                    <div class="metric-icon">
                        <i class="bi bi-activity"></i>
                    </div>
                    <div class="metric-content">
                        <div class="metric-value">${metrics.systemUptime}</div>
                        <div class="metric-label">System Uptime</div>
                        <div class="metric-details">
                            <span class="text-muted">Backup: ${metrics.lastBackup}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tenants Table -->
        <div class="saas-card">
            <div class="saas-card-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0 text-white">
                    <i class="bi bi-people me-2"></i>Clients Management
                </h6>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-light active" onclick="filterTenants('all')">All</button>
                    <button class="btn btn-outline-success" onclick="filterTenants('Active')">Active</button>
                    <button class="btn btn-outline-warning" onclick="filterTenants('Trial')">Trial</button>
                    <button class="btn btn-outline-danger" onclick="filterTenants('Suspended')">Suspended</button>
                </div>
            </div>
            <div class="saas-card-body">
                <div class="table-responsive">
                    <table class="table table-dark table-hover">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Subdomain</th>
                                <th>Plan</th>
                                <th>Status</th>
                                <th>Orders</th>
                                <th>Users</th>
                                <th>Database</th>
                                <th>Revenue</th>
                                <th>Last Active</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tenants.map(tenant => {
                                const statusBadge = tenant.status === 'Active' ? 'badge bg-success' : 
                                                  tenant.status === 'Trial' ? 'badge bg-warning' : 
                                                  tenant.status === 'Suspended' ? 'badge bg-danger' : 'badge bg-secondary';
                                const planBadge = tenant.plan === 'Enterprise' ? 'badge bg-purple' : 
                                                 tenant.plan === 'Pro' ? 'badge bg-primary' : 'badge bg-info';
                                
                                return `
                                    <tr>
                                        <td>
                                            <div class="fw-bold text-white">${tenant.companyName}</div>
                                            <small class="text-muted">${tenant.adminEmail}</small>
                                        </td>
                                        <td>
                                            <code class="text-info">${tenant.subdomain}</code>
                                            <br><a href="http://${tenant.subdomain}.demo.ru" target="_blank" class="text-decoration-none">
                                                <small class="text-cyan">Open →</small>
                                            </a>
                                        </td>
                                        <td><span class="${planBadge}">${tenant.plan}</span></td>
                                        <td><span class="${statusBadge}">${tenant.status}</span></td>
                                        <td>${tenant.orderCount}</td>
                                        <td>${tenant.userCount}</td>
                                        <td>
                                            <small class="text-muted">${tenant.databaseSize}</small>
                                            <br><code class="text-muted" style="font-size: 0.7rem;">${tenant.subdomain}_db</code>
                                        </td>
                                        <td><strong class="text-success">${formatMoney(tenant.monthlyRevenue)}</strong></td>
                                        <td><small>${tenant.lastActive}</small></td>
                                        <td>
                                            <div class="btn-group btn-group-sm">
                                                <button class="btn btn-outline-info btn-sm" onclick="viewTenantDetails(${tenant.id})"
                                                        data-bs-toggle="tooltip" title="View Details">
                                                    <i class="bi bi-eye"></i>
                                                </button>
                                                <button class="btn btn-outline-secondary btn-sm" onclick="manageTenant(${tenant.id})"
                                                        data-bs-toggle="tooltip" title="Manage">
                                                    <i class="bi bi-gear"></i>
                                                </button>
                                                ${tenant.isActive ? `
                                                    <button class="btn btn-outline-warning btn-sm" onclick="suspendTenant(${tenant.id})"
                                                            data-bs-toggle="tooltip" title="Suspend">
                                                        <i class="bi bi-pause"></i>
                                                    </button>
                                                ` : `
                                                    <button class="btn btn-outline-success btn-sm" onclick="activateTenant(${tenant.id})"
                                                            data-bs-toggle="tooltip" title="Activate">
                                                        <i class="bi bi-play"></i>
                                                    </button>
                                                `}
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Activity Log -->
        <div class="saas-card mt-4">
            <div class="saas-card-header">
                <h6 class="mb-0 text-white">
                    <i class="bi bi-clock-history me-2"></i>Recent Activity
                </h6>
            </div>
            <div class="saas-card-body">
                <div class="saas-timeline">
                    ${SAAS_ACTIVITY_LOG.slice(0, 10).map(log => {
                        const tenant = SAAS_TENANTS.find(t => t.id === log.tenantId);
                        const actionIcon = log.action === 'order_created' ? 'bi-cart-plus' :
                                          log.action === 'user_login' ? 'bi-person-check' :
                                          log.action === 'user_added' ? 'bi-person-plus' :
                                          log.action === 'suspension' ? 'bi-pause-circle' :
                                          log.action === 'database_backup' ? 'bi-database-down' :
                                          'bi-info-circle';
                        
                        return `
                            <div class="saas-timeline-item">
                                <div class="saas-timeline-marker">
                                    <i class="bi ${actionIcon}"></i>
                                </div>
                                <div class="saas-timeline-content">
                                    <div class="d-flex justify-content-between">
                                        <span class="fw-bold text-white">${tenant?.companyName || 'System'}</span>
                                        <small class="text-muted">${log.timestamp}</small>
                                    </div>
                                    <div class="text-muted">${log.description}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.getElementById('pageContent').innerHTML = html;
}

function filterTenants(status) {
    // В реальном приложении здесь будет фильтрация данных
    renderSaaSAdminPage();
    showToast(`Фильтр: ${status}`, 'info');
}

function viewTenantDetails(tenantId) {
    const tenant = SAAS_TENANTS.find(t => t.id === tenantId);
    if (!tenant) return;
    
    const plan = SAAS_PLANS.find(p => p.id === tenant.plan);
    
    document.getElementById('modalTitle').innerHTML = `
        <i class="bi bi-building me-2"></i>${tenant.companyName}
    `;
    document.getElementById('modalBody').innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Общая информация</h6>
                <table class="table table-sm">
                    <tr><td>ID:</td><td>${tenant.id}</td></tr>
                    <tr><td>Компания:</td><td>${tenant.companyName}</td></tr>
                    <tr><td>Субдомен:</td><td><code>${tenant.subdomain}</code></td></tr>
                    <tr><td>Тариф:</td><td><span class="badge bg-primary">${tenant.plan}</span></td></tr>
                    <tr><td>Статус:</td><td><span class="badge ${tenant.status === 'Active' ? 'bg-success' : tenant.status === 'Trial' ? 'bg-warning' : 'bg-danger'}">${tenant.status}</span></td></tr>
                    <tr><td>Создан:</td><td>${tenant.createdAt}</td></tr>
                    <tr><td>Последняя активность:</td><td>${tenant.lastActive}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>Администратор</h6>
                <table class="table table-sm">
                    <tr><td>Имя:</td><td>${tenant.adminName}</td></tr>
                    <tr><td>Email:</td><td>${tenant.adminEmail}</td></tr>
                </table>
                
                <h6 class="mt-3">Тарифный план</h6>
                <div class="card">
                    <div class="card-body">
                        <h6 class="text-primary">${plan?.name} - ${formatMoney(plan?.price)}/мес</h6>
                        <ul class="list-unstyled">
                            ${plan?.features.map(f => `<li><i class="bi bi-check-circle text-success"></i> ${f}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row mt-3">
            <div class="col-md-12">
                <h6>Статистика</h6>
                <div class="row g-3">
                    <div class="col-md-3">
                        <div class="card text-center">
                            <div class="card-body">
                                <h4 class="text-primary">${tenant.orderCount}</h4>
                                <small class="text-muted">Заказов</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center">
                            <div class="card-body">
                                <h4 class="text-info">${tenant.userCount}</h4>
                                <small class="text-muted">Пользователей</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center">
                            <div class="card-body">
                                <h4 class="text-success">${formatMoney(tenant.monthlyRevenue)}</h4>
                                <small class="text-muted">Месячный доход</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center">
                            <div class="card-body">
                                <h4 class="text-warning">${tenant.databaseSize}</h4>
                                <small class="text-muted">Размер БД</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        ${tenant.suspensionReason ? `
        <div class="alert alert-warning mt-3">
            <h6>Причина блокировки:</h6>
            <p>${tenant.suspensionReason}</p>
        </div>
        ` : ''}
        
        ${tenant.trialEndsAt ? `
        <div class="alert alert-info mt-3">
            <h6>Триальный период:</h6>
            <p>Заканчивается ${tenant.trialEndsAt}</p>
        </div>
        ` : ''}
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
        <button class="btn btn-primary" onclick="manageTenant(${tenant.id})">Управление</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

function manageTenant(tenantId) {
    const tenant = SAAS_TENANTS.find(t => t.id === tenantId);
    if (!tenant) return;
    
    document.getElementById('modalTitle').innerHTML = `
        <i class="bi bi-gear me-2"></i>Управление клиентом: ${tenant.companyName}
    `;
    document.getElementById('modalBody').innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Изменение тарифа</h6>
                <select class="form-select" id="tenantPlan">
                    ${SAAS_PLANS.map(p => `
                        <option value="${p.id}" ${p.id === tenant.plan ? 'selected' : ''}>
                            ${p.name} - ${formatMoney(p.price)}/мес
                        </option>
                    `).join('')}
                </select>
                <div class="mt-2">
                    <small class="text-muted">Изменение тарифа вступит в силу с начала следующего месяца</small>
                </div>
            </div>
            <div class="col-md-6">
                <h6>Статус клиента</h6>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="tenantActive" ${tenant.isActive ? 'checked' : ''}>
                    <label class="form-check-label" for="tenantActive">
                        Активен
                    </label>
                </div>
                ${!tenant.isActive ? `
                <div class="mt-2">
                    <label class="form-label">Причина блокировки:</label>
                    <input type="text" class="form-control" id="suspensionReason" value="${tenant.suspensionReason || ''}" placeholder="Укажите причину">
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="row mt-3">
            <div class="col-md-12">
                <h6>Connection String</h6>
                <textarea class="form-control font-monospace" rows="2" readonly>${tenant.connectionString}</textarea>
                <small class="text-muted">Для изменения обратитесь к системному администратору</small>
            </div>
        </div>
        
        <div class="row mt-3">
            <div class="col-md-12">
                <h6>Действия</h6>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-warning" onclick="backupTenantDatabase(${tenant.id})">
                        <i class="bi bi-database-down"></i> Бэкап БД
                    </button>
                    <button class="btn btn-outline-info" onclick="resetTenantPassword(${tenantId})">
                        <i class="bi bi-key"></i> Сбросить пароль админа
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteTenant(${tenant.id})">
                        <i class="bi bi-trash"></i> Удалить клиента
                    </button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="saveTenantSettings(${tenantId})">Сохранить</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

function saveTenantSettings(tenantId) {
    const tenant = SAAS_TENANTS.find(t => t.id === tenantId);
    if (!tenant) return;
    
    const newPlan = document.getElementById('tenantPlan').value;
    const isActive = document.getElementById('tenantActive').checked;
    const suspensionReason = document.getElementById('suspensionReason')?.value;
    
    // В реальном приложении здесь был бы API вызов
    tenant.plan = newPlan;
    tenant.isActive = isActive;
    tenant.suspensionReason = suspensionReason;
    
    bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide();
    showToast('Настройки клиента сохранены', 'success');
    renderSaaSAdminPage();
}

function createNewTenant() {
    document.getElementById('modalTitle').innerHTML = `
        <i class="bi bi-plus-circle me-2"></i>Добавление нового клиента
    `;
    document.getElementById('modalBody').innerHTML = `
        <form id="newTenantForm">
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Название компании *</label>
                        <input type="text" class="form-control" id="companyName" required>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Субдомен *</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="subdomain" required>
                            <span class="input-group-text">.demo.ru</span>
                        </div>
                        <small class="text-muted">Уникальное имя для доступа к системе</small>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Email администратора *</label>
                        <input type="email" class="form-control" id="adminEmail" required>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Имя администратора *</label>
                        <input type="text" class="form-control" id="adminName" required>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Пароль администратора *</label>
                        <input type="password" class="form-control" id="adminPassword" required>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Тарифный план *</label>
                        <select class="form-select" id="plan" required>
                            ${SAAS_PLANS.map(p => `
                                <option value="${p.id}">${p.name} - ${formatMoney(p.price)}/мес</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            </div>
            <div class="alert alert-info">
                <h6>Что будет создано:</h6>
                <ul class="mb-0">
                    <li>Запись клиента в мастер-базе</li>
                    <li>Отдельная база данных для заказов</li>
                    <li>Пользователь-администратор с указанными данными</li>
                    <li>Автоматическая настройка подключения</li>
                </ul>
            </div>
        </form>
    `;
    document.getElementById('modalFooter').innerHTML = `
        <button class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
        <button class="btn btn-primary" onclick="createTenant()">Создать клиента</button>
    `;
    new bootstrap.Modal(document.getElementById('universalModal')).show();
}

function createTenant() {
    const companyName = document.getElementById('companyName').value;
    const subdomain = document.getElementById('subdomain').value;
    const adminEmail = document.getElementById('adminEmail').value;
    const adminName = document.getElementById('adminName').value;
    const adminPassword = document.getElementById('adminPassword').value;
    const plan = document.getElementById('plan').value;
    
    if (!companyName || !subdomain || !adminEmail || !adminName || !adminPassword || !plan) {
        showToast('Заполните все обязательные поля', 'warning');
        return;
    }
    
    // В реальном приложении здесь был бы API вызов
    const newTenant = {
        id: Math.max(...SAAS_TENANTS.map(t => t.id)) + 1,
        companyName,
        subdomain,
        plan,
        status: 'Trial',
        createdAt: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString().split('T')[0],
        connectionString: `Server=.;Database=${subdomain}_db;Trusted_Connection=True;`,
        databaseSize: '0 MB',
        orderCount: 0,
        userCount: 1,
        monthlyRevenue: 0,
        isActive: true,
        adminEmail,
        adminName,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    
    SAAS_TENANTS.push(newTenant);
    
    bootstrap.Modal.getInstance(document.getElementById('universalModal')).hide();
    showToast(`Клиент "${companyName}" успешно создан!`, 'success');
    renderSaaSAdminPage();
}

function suspendTenant(tenantId) {
    const tenant = SAAS_TENANTS.find(t => t.id === tenantId);
    if (!tenant) return;
    
    if (!confirm(`Приостановить клиента "${tenant.companyName}"?`)) return;
    
    tenant.isActive = false;
    tenant.status = 'Suspended';
    tenant.suspensionReason = 'Приостановлено администратором';
    
    showToast(`Клиент "${tenant.companyName}" приостановлен`, 'warning');
    renderSaaSAdminPage();
}

function activateTenant(tenantId) {
    const tenant = SAAS_TENANTS.find(t => t.id === tenantId);
    if (!tenant) return;
    
    tenant.isActive = true;
    tenant.status = tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date() ? 'Trial' : 'Active';
    tenant.suspensionReason = null;
    
    showToast(`Клиент "${tenant.companyName}" активирован`, 'success');
    renderSaaSAdminPage();
}

function backupTenantDatabase(tenantId) {
    const tenant = SAAS_TENANTS.find(t => t.id === tenantId);
    if (!tenant) return;
    
    showToast(`Бэкап базы данных "${tenant.companyName}" запущен...`, 'info');
    // В реальном приложении здесь был бы запуск бэкапа
}

function resetTenantPassword(tenantId) {
    const tenant = SAAS_TENANTS.find(t => t.id === tenantId);
    if (!tenant) return;
    
    if (!confirm(`Сбросить пароль администратора для "${tenant.companyName}"?`)) return;
    
    showToast(`Пароль администратора сброшен. Новый пароль отправлен на ${tenant.adminEmail}`, 'info');
    // В реальном приложении здесь была бы отправка email
}

function deleteTenant(tenantId) {
    const tenant = SAAS_TENANTS.find(t => t.id === tenantId);
    if (!tenant) return;
    
    if (!confirm(`Удалить клиента "${tenant.companyName}"? Это удалит все данные клиента!`)) return;
    
    const index = SAAS_TENANTS.findIndex(t => t.id === tenantId);
    SAAS_TENANTS.splice(index, 1);
    
    showToast(`Клиент "${tenant.companyName}" удален`, 'warning');
    renderSaaSAdminPage();
}
