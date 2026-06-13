const form = document.getElementById('contact-form');
const statusMessage = document.getElementById('form-status');
const stockAlertMessage = document.getElementById('stock-alert-message');
const inventoryForm = document.getElementById('inventory-form');
const inventoryList = document.getElementById('inventory-list');
const clearInventoryButton = document.getElementById('clear-inventory');
const cancelEditButton = document.getElementById('cancel-edit');
const saveToCloudButton = document.getElementById('save-to-cloud');

const itemNameInput = document.getElementById('item-name');
const itemQuantityInput = document.getElementById('item-quantity');
const itemUnitInput = document.getElementById('item-unit');
const itemThresholdInput = document.getElementById('item-threshold');
const itemIdInput = document.getElementById('item-id');
const itemCategoryInput = document.getElementById('item-category');
const reorderSummary = document.getElementById('reorder-summary');
const markOrderedAllButton = document.getElementById('mark-ordered-all');
const exportReorderCsvButton = document.getElementById('export-reorder-csv');

const authOverlay = document.getElementById('auth-overlay');
const authForm = document.getElementById('auth-form');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authFeedback = document.getElementById('auth-feedback');
const logoutButton = document.getElementById('logout-button');
const userListBody = document.getElementById('user-list');
const userForm = document.getElementById('user-form');
const newUsernameInput = document.getElementById('new-username');
const newPasswordInput = document.getElementById('new-password');
const userFeedback = document.getElementById('user-feedback');

const AUTH_KEY = 'pietroInventoryAuth';
const CURRENT_USER_KEY = 'pietroInventoryCurrentUser';
const USER_STORAGE_KEY = 'pietroInventoryUsers';

const STORAGE_KEY = 'pietroInventoryItems';
let inventoryItems = null;

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQkPv5oacAdqVwzqluo2mnd531Jvz1azE",
  authDomain: "pietros-inventory.firebaseapp.com",
    storageBucket: "pietros-inventory.firebasestorage.app",
  messagingSenderId: "736356040857",
  appId: "1:736356040857:web:c1bb1d4af1a152f8ffb808",
  measurementId: "G-70LVPVL3BN"
};

let firebaseDb = null;
let firebaseInitialized = false;

function initializeFirebase() {
  try {
    if (firebaseConfig.projectId === 'YOUR_PROJECT_ID') {
      console.warn('Firebase not configured. Add your config to initializeFirebase()');
      return false;
    }
    const app = firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.database(app);
    firebaseInitialized = true;
    loadFromCloud();
    return true;
  } catch (error) {
    console.error('Firebase init error:', error);
    firebaseInitialized = false;
    return false;
  }
}

async function saveToCloud() {
  if (!firebaseInitialized || !firebaseDb) {
    if (stockAlertMessage) stockAlertMessage.textContent = 'Firebase not configured. Add your API key to enable cloud save.';
    return;
  }

  try {
    const items = inventoryItems ?? loadInventory();
    await firebaseDb.ref('inventory').set({
      items,
      lastUpdated: new Date().toISOString(),
    });
    if (stockAlertMessage) stockAlertMessage.textContent = 'Saved to cloud successfully!';
    setTimeout(() => {
      if (stockAlertMessage) stockAlertMessage.textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Cloud save error:', error);
    if (stockAlertMessage) stockAlertMessage.textContent = 'Error saving to cloud.';
  }
}

async function loadFromCloud() {
  if (!firebaseInitialized || !firebaseDb) {
    return;
  }

  try {
    const snapshot = await firebaseDb.ref('inventory/items').once('value');
    if (snapshot.exists()) {
      const items = snapshot.val();
      saveInventory(items);
      renderInventory();
    }
  } catch (error) {
    console.error('Cloud load error:', error);
  }
}
const DEFAULT_INVENTORY = [
  {
    id: 'demo-1',
    name: 'Tomatoes',
    category: 'Produce',
    quantity: 12,
    unit: 'lbs',
    threshold: 5,
  },
  {
    id: 'demo-2',
    name: 'Chicken Breast',
    category: 'Proteins',
    quantity: 8,
    unit: 'lbs',
    threshold: 4,
  },
  {
    id: 'demo-3',
    name: 'Spinach',
    category: 'Produce',
    quantity: 3,
    unit: 'bunches',
    threshold: 5,
  },
];

function loadInventory() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    inventoryItems = [...DEFAULT_INVENTORY];
    saveInventory(inventoryItems);
    return inventoryItems;
  }

  try {
    inventoryItems = JSON.parse(stored);
    return inventoryItems;
  } catch {
    inventoryItems = [...DEFAULT_INVENTORY];
    saveInventory(inventoryItems);
    return inventoryItems;
  }
}

function saveInventory(items) {
  inventoryItems = items;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function getLowStockItems(items) {
  return items.filter((item) => item.quantity < item.threshold);
}

function getReorderList(items) {
  return items
    .map((item) => ({
      name: item.name,
      beforeQty: item.quantity,
      reorder: Math.max(0, (item.threshold ?? 0) - item.quantity),
      unit: item.unit,
    }))
    .filter((entry) => entry.reorder > 0);
}

function renderStockAlerts(items) {
  const lowStockItems = getLowStockItems(items);

  if (lowStockItems.length === 0) {
    stockAlertMessage.textContent = items.length === 0
      ? 'No inventory items yet. Add products to track stock and par levels.'
      : 'All products are above par.';
    stockAlertMessage.classList.remove('stock-alert');
    reorderSummary.textContent = '';
    return;
  }

  const sortedLow = lowStockItems.slice().sort((a, b) => (a.quantity - a.threshold) - (b.quantity - b.threshold));
  const alertList = sortedLow.map((item) => `${item.name} (${item.quantity} ${item.unit})`).slice(0, 6);
  stockAlertMessage.textContent = `Stock needed: ${alertList.join(', ')}`;
  stockAlertMessage.classList.add('stock-alert');

  const totalReorder = lowStockItems.reduce((sum, item) => sum + Math.max(0, (item.threshold ?? 0) - item.quantity), 0);
  reorderSummary.textContent = totalReorder > 0 ? `Total suggested reorder: ${totalReorder}` : '';
}

function renderInventory() {
  if (inventoryItems === null) inventoryItems = loadInventory();
  const items = inventoryItems.slice();
  inventoryList.innerHTML = '';

  if (items.length === 0) {
    inventoryList.innerHTML = '<tr><td colspan="8">No inventory items yet. Add one or more products to get started.</td></tr>';
    renderStockAlerts(items);
    return;
  }

  const grouped = items.reduce((groups, item) => {
    const category = item.category?.trim() || 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
    return groups;
  }, {});

  const categoryOrder = Object.keys(grouped).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  const itemSorter = (a, b) => {
    const aDiff = (a.quantity - (a.threshold ?? 0));
    const bDiff = (b.quantity - (b.threshold ?? 0));
    if (aDiff !== bDiff) return aDiff - bDiff;
    return a.name.localeCompare(b.name);
  };

  categoryOrder.forEach((category) => {
    const headerRow = document.createElement('tr');
    headerRow.classList.add('category-row');
    headerRow.innerHTML = `<td colspan="8" class="category-label">${category}</td>`;
    inventoryList.appendChild(headerRow);

    grouped[category].sort(itemSorter).forEach((item) => {
      const lowStock = item.quantity < item.threshold;
      const urgent = lowStock && item.quantity <= Math.floor((item.threshold ?? 0) / 2);
      const reorderQty = Math.max(0, (item.threshold ?? 0) - item.quantity);
      const row = document.createElement('tr');

      if (lowStock) row.classList.add('low-stock');
      if (urgent) row.classList.add('urgent');

      row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.category ?? ''}</td>
        <td>${item.quantity}</td>
        <td>${item.threshold}</td>
        <td>${item.unit}</td>
        <td>${reorderQty > 0 ? '<span class="reorder-badge">' + reorderQty + '</span>' : ''}</td>
        <td><span class="status-badge ${urgent ? 'status-urgent' : (lowStock ? 'status-low' : 'status-ok')}">${urgent ? 'URGENT' : (lowStock ? 'Stock needed' : 'OK')}</span></td>
        <td>
          <button class="mark-ordered-button" type="button" data-id="${item.id}">Mark ordered</button>
          <button class="edit-button" type="button" data-id="${item.id}">Edit</button>
          <button class="delete-button" type="button" data-id="${item.id}">Delete</button>
        </td>
      `;

      inventoryList.appendChild(row);
    });
  });

  renderStockAlerts(items);
}

function resetInventoryForm() {
  inventoryForm.reset();
  itemIdInput.value = '';
  itemQuantityInput.value = 0;
  itemThresholdInput.value = 5;
  if (itemCategoryInput) itemCategoryInput.value = '';
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function loadUsers() {
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  if (!stored) {
    const defaultUsers = [{ username: 'Stefan', password: '282rocky', role: 'master' }];
    saveUsers(defaultUsers);
    return defaultUsers;
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('Invalid user list');

    const normalized = parsed
      .filter((user) => user && typeof user.username === 'string' && typeof user.password === 'string')
      .map((user) => ({
        username: user.username.trim(),
        password: user.password,
        role: user.role === 'master' ? 'master' : (user.username.trim() === 'Stefan' ? 'master' : 'user'),
      }));

    if (!normalized.some((user) => user.username === 'Stefan' && user.role === 'master')) {
      normalized.unshift({ username: 'Stefan', password: '282rocky', role: 'master' });
      saveUsers(normalized);
    }

    return normalized;
  } catch {
    const defaultUsers = [{ username: 'Stefan', password: '282rocky', role: 'master' }];
    saveUsers(defaultUsers);
    return defaultUsers;
  }
}

function saveUsers(users) {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
}

function authenticateUser(username, password) {
  return loadUsers().some((user) => user.username === username && user.password === password);
}

function currentUsername() {
  return localStorage.getItem(CURRENT_USER_KEY) || '';
}

function currentUser() {
  const username = currentUsername();
  return loadUsers().find((user) => user.username === username) || null;
}

function isMaster() {
  return currentUser()?.role === 'master';
}

function renderUserList() {
  if (!userListBody) return;
  const users = loadUsers();
  const currentUserName = currentUsername();
  const currentIsMaster = isMaster();

  userListBody.innerHTML = users.map((user) => {
    const isCurrent = user.username === currentUserName;
    const isUserMaster = user.role === 'master';
    const canDelete = currentIsMaster && !isUserMaster;
    return `
      <tr>
        <td>${user.username}${isCurrent ? ' <strong>(active)</strong>' : ''}</td>
        <td>${isUserMaster ? 'Master' : 'User'}</td>
        <td>
          <button type="button" class="button secondary delete-user-button" data-username="${user.username}" ${!canDelete ? 'disabled' : ''}>Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function addUser(username, password) {
  if (!isMaster()) {
    return 'Only the master account can manage users.';
  }

  const trimmedName = username.trim();
  if (!trimmedName || !password) {
    return 'Username and password are required.';
  }

  const existing = loadUsers().some((user) => user.username.toLowerCase() === trimmedName.toLowerCase());
  if (existing) {
    return 'This username is already in use.';
  }

  const users = loadUsers();
  users.push({ username: trimmedName, password, role: 'user' });
  saveUsers(users);
  renderUserList();
  return '';
}

function removeUser(username) {
  if (!isMaster()) {
    return 'Only the master account can manage users.';
  }

  const users = loadUsers();
  const targetUser = users.find((user) => user.username === username);
  if (!targetUser) {
    return 'User not found.';
  }
  if (targetUser.role === 'master') {
    return 'Master account cannot be removed.';
  }

  const filtered = users.filter((user) => user.username !== username);
  if (filtered.length === 0) return 'Cannot remove the last user.';

  saveUsers(filtered);
  const currentUserName = currentUsername();
  if (currentUserName === username) {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
    updateAuthState();
  }

  renderUserList();
  return '';
}

function exportReorderCSV(items) {
  const list = getReorderList(items);
  if (list.length === 0) {
    stockAlertMessage.textContent = 'No reorder suggestions to export.';
    return;
  }

  const exportedAt = new Date();
  const rows = [['Product', 'BeforeQty', 'Reorder', 'AfterQty', 'Unit', 'ExportedAt']];

  list.forEach((entry) => {
    rows.push([
      entry.name,
      String(entry.beforeQty),
      String(entry.reorder),
      String(entry.beforeQty + entry.reorder),
      entry.unit,
      exportedAt.toISOString(),
    ]);
  });

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const pad = (value) => String(value).padStart(2, '0');
  const ts = `${exportedAt.getFullYear()}${pad(exportedAt.getMonth() + 1)}${pad(exportedAt.getDate())}-${pad(exportedAt.getHours())}${pad(exportedAt.getMinutes())}${pad(exportedAt.getSeconds())}`;
  link.download = `reorder-${ts}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function markOrderedAll(items) {
  const reorderList = getReorderList(items);
  if (reorderList.length === 0) {
    stockAlertMessage.textContent = 'No items need reordering.';
    return;
  }

  const updatedItems = items.map((item) => {
    const reorderQty = Math.max(0, (item.threshold ?? 0) - item.quantity);
    return reorderQty > 0 ? { ...item, quantity: item.quantity + reorderQty } : item;
  });

  saveInventory(updatedItems);
  const totalReorder = reorderList.reduce((sum, entry) => sum + entry.reorder, 0);
  stockAlertMessage.textContent = `Marked ordered ${totalReorder} total units.`;
  setTimeout(() => renderInventory(), 200);
}

inventoryForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = itemNameInput.value.trim();
  const quantity = Number(itemQuantityInput.value);
  const unit = itemUnitInput.value.trim();
  const category = itemCategoryInput?.value.trim() || '';
  const threshold = Number(itemThresholdInput.value);
  const id = itemIdInput.value;

  if (!name || !unit || Number.isNaN(quantity) || quantity < 0 || Number.isNaN(threshold) || threshold < 0) {
    stockAlertMessage.textContent = 'Please fill in all fields with valid values.';
    return;
  }

  const items = inventoryItems ?? loadInventory();

  if (id) {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, name, category, quantity, unit, threshold } : item
    );
    saveInventory(updatedItems);
    stockAlertMessage.textContent = `Updated ${name}.`;
  } else {
    const nextItem = {
      id: createId(),
      name,
      category,
      quantity,
      unit,
      threshold,
    };
    items.push(nextItem);
    saveInventory(items);
    stockAlertMessage.textContent = `Added ${name}.`;
  }

  resetInventoryForm();
  renderInventory();
});

inventoryList.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const id = button.dataset.id;
  const items = inventoryItems ?? loadInventory();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  if (button.classList.contains('edit-button')) {
    itemIdInput.value = item.id;
    itemNameInput.value = item.name;
    itemCategoryInput.value = item.category ?? '';
    itemQuantityInput.value = item.quantity;
    itemUnitInput.value = item.unit;
    itemThresholdInput.value = item.threshold;
    itemNameInput.focus();
  }

  if (button.classList.contains('mark-ordered-button')) {
    const reorderQty = Math.max(0, (item.threshold ?? 0) - item.quantity);
    if (reorderQty <= 0) {
      stockAlertMessage.textContent = `${item.name} is already at or above par.`;
      setTimeout(renderInventory, 800);
      return;
    }

    const updatedItems = items.map((entry) =>
      entry.id === id ? { ...entry, quantity: entry.quantity + reorderQty } : entry
    );
    saveInventory(updatedItems);
    stockAlertMessage.textContent = `Marked ordered ${reorderQty} ${item.unit} for ${item.name}.`;
    setTimeout(renderInventory, 200);
    return;
  }

  if (button.classList.contains('delete-button')) {
    const updatedItems = items.filter((entry) => entry.id !== id);
    saveInventory(updatedItems);
    renderInventory();
  }
});

cancelEditButton.addEventListener('click', () => {
  resetInventoryForm();
});

clearInventoryButton.addEventListener('click', () => {
  if (confirm('Clear all inventory items?')) {
    saveInventory([]);
    resetInventoryForm();
    renderInventory();
  }
});

exportReorderCsvButton.addEventListener('click', () => {
  exportReorderCSV(inventoryItems ?? loadInventory());
});

markOrderedAllButton.addEventListener('click', () => {
  if (confirm('Mark ordered suggested quantities for all low-stock products?')) {
    markOrderedAll(inventoryItems ?? loadInventory());
  }
});

if (saveToCloudButton) {
  saveToCloudButton.addEventListener('click', saveToCloud);
}

function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

function setInventoryAccess(enabled) {
  if (inventoryForm) {
    inventoryForm.querySelectorAll('input, select, button').forEach((control) => {
      if (control.type !== 'hidden') control.disabled = !enabled;
    });
  }

  [clearInventoryButton, exportReorderCsvButton, markOrderedAllButton].forEach((button) => {
    if (button) button.disabled = !enabled;
  });

  if (inventoryList) {
    inventoryList.querySelectorAll('button').forEach((button) => {
      button.disabled = !enabled;
    });
  }

  const userAdminEnabled = enabled && isMaster();
  if (userForm) {
    userForm.querySelectorAll('input, button').forEach((control) => {
      control.disabled = !userAdminEnabled;
    });
  }

  if (userListBody) {
    userListBody.querySelectorAll('button').forEach((button) => {
      button.disabled = !userAdminEnabled;
    });
  }
}

function updateAuthState() {
  const authed = isAuthenticated();

  if (authOverlay) {
    authOverlay.style.display = authed ? 'none' : 'flex';
  }

  if (logoutButton) {
    logoutButton.style.display = authed ? 'inline-flex' : 'none';
  }

  document.documentElement.classList.toggle('locked', !authed);
  setInventoryAccess(authed);
  renderUserList();
  renderInventory();
}

if (authForm) {
  authForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const username = authUsernameInput?.value.trim() || '';
    const password = authPasswordInput?.value || '';

    if (authenticateUser(username, password)) {
      localStorage.setItem(AUTH_KEY, 'true');
      localStorage.setItem(CURRENT_USER_KEY, username);
      updateAuthState();
      if (authFeedback) authFeedback.textContent = 'Login successful.';
      renderInventory();
      return;
    }

    if (authFeedback) authFeedback.textContent = 'Invalid username or password.';
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
    updateAuthState();
    renderInventory();
  });
}

if (userForm) {
  userForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = newUsernameInput?.value.trim() || '';
    const password = newPasswordInput?.value || '';

    const error = addUser(username, password);
    if (error) {
      if (userFeedback) userFeedback.textContent = error;
      return;
    }

    if (userFeedback) userFeedback.textContent = 'User added successfully.';
    if (newUsernameInput) newUsernameInput.value = '';
    if (newPasswordInput) newPasswordInput.value = '';
  });
}

if (userListBody) {
  userListBody.addEventListener('click', (event) => {
    const button = event.target.closest('.delete-user-button');
    if (!button) return;
    const username = button.dataset.username;
    if (!username) return;

    const message = removeUser(username);
    if (message && userFeedback) {
      userFeedback.textContent = message;
    }
  });
}

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = form.elements.message.value.trim();

    if (!message) {
      if (statusMessage) {
        statusMessage.textContent = 'Please enter a message.';
      }
      return;
    }

    if (statusMessage) {
      statusMessage.textContent = 'Thanks for your message! We will be in touch soon.';
    }
    form.reset();
  });
}

inventoryItems = loadInventory();
initializeFirebase();
updateAuthState();
