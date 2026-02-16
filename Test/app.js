// ============================================================
// APP — Router, Toast, Auth, Init
// ============================================================

let isAuthenticated = false;

// --- Toast ---
function showToast(message, type = 'info') {
    const colorMap = {
        success: 'bg-success text-white',
        error: 'bg-danger text-white',
        info: 'bg-info text-dark',
        warning: 'bg-warning text-dark',
    };
    const iconMap = {
        success: 'bi-check-circle-fill',
        error: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill',
        warning: 'bi-exclamation-circle-fill',
    };

    const id = 'toast_' + Date.now();
    const html = `
    <div id="${id}" class="toast align-items-center ${colorMap[type] || colorMap.info} border-0" role="alert">
        <div class="d-flex">
            <div class="toast-body"><i class="bi ${iconMap[type] || iconMap.info} me-2"></i>${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    </div>`;

    document.getElementById('toastContainer').insertAdjacentHTML('beforeend', html);
    const toastEl = document.getElementById(id);
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// --- Auth ---
function doLogin() {
    isAuthenticated = true;
    document.getElementById('loginPage').classList.add('d-none');
    document.getElementById('mainApp').classList.remove('d-none');
    showToast('Добро пожаловать, Админ!', 'success');
    navigateTo('orders');
}

function doLogout() {
    isAuthenticated = false;
    document.getElementById('mainApp').classList.add('d-none');
    document.getElementById('loginPage').classList.remove('d-none');
    showLogin();
    showToast('Вы вышли из системы', 'info');
}

function showRegister() {
    document.getElementById('loginForm').classList.add('d-none');
    document.getElementById('registerForm').classList.remove('d-none');
}

function showLogin() {
    document.getElementById('registerForm').classList.add('d-none');
    document.getElementById('loginForm').classList.remove('d-none');
}

function doRegister() {
    showToast('Аккаунт создан! Теперь войдите.', 'success');
    showLogin();
}

// --- Sidebar ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('expanded');
}

// --- Router ---
const ROUTES = {
    'orders': { title: 'Заказы', render: renderOrdersPage },
    'order-detail': { title: 'Детали заказа', render: () => {} },
    'transactions': { title: 'Транзакции', render: renderTransactionsPage },
    'clients': { title: 'Клиенты', render: renderClientsPage },
    'suppliers': { title: 'Поставщики', render: renderSuppliersPage },
    'warehouses': { title: 'Склады', render: renderWarehousesPage },
    'archive': { title: 'Архив', render: renderArchivePage },
    'notifications': { title: 'Уведомления', render: renderNotificationsPage },
    'settings': { title: 'Компания', render: renderSettingsPage },
    'users': { title: 'Пользователи', render: renderUsersPage },
    'roles': { title: 'Роли', render: renderRolesPage },
    'settings-1c': { title: 'Интеграция 1С', render: renderSettings1CPage },
    'transaction-definitions': { title: 'Конструктор', render: renderTransactionDefinitionsPage },
    'status-transitions': { title: 'Граф переходов', render: renderStatusTransitionsPage },
    'status-mappings': { title: 'Маппинг статусов', render: renderStatusMappingsPage },
    'hangfire': { title: 'Hangfire', render: renderHangfirePage },
    'support': { title: 'Поддержка', render: renderSupportPage },
    'saas-admin': { title: 'SaaS Админ-панель', render: renderSaaSAdminPage }
};

function navigateTo(route) {
    window.location.hash = route;
}

function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'orders';

    // Order detail
    if (hash.startsWith('order/')) {
        const id = hash.split('/')[1];
        setActiveNav(null);
        document.getElementById('pageTitle').textContent = 'Заказ';
        renderOrderDetailPage(id);
        // Re-initialize tooltips after page render
        setTimeout(initTooltips, 100);
        return;
    }

    const route = ROUTES[hash];
    if (route) {
        document.getElementById('pageTitle').textContent = route.title;
        setActiveNav(hash);
        route.render();
        // Re-initialize tooltips after page render
        setTimeout(initTooltips, 100);
    } else {
        navigateTo('orders');
    }
}

function initTooltips() {
    // Dispose existing tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        const tooltip = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
        if (tooltip) {
            tooltip.dispose();
        }
    });
    
    // Initialize new tooltips
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

function setActiveNav(page) {
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
}

// --- Init ---
window.addEventListener('hashchange', () => {
    if (isAuthenticated) handleRoute();
});

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginPage').classList.remove('d-none');
    
    // Initialize tooltips on login page
    initTooltips();
});
