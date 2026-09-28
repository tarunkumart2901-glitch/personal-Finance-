'use strict';

const STORAGE_KEY = 'ledger.transactions.v1';
const form = document.querySelector('#transactionForm');
const descriptionInput = document.querySelector('#description');
const amountInput = document.querySelector('#amount');
const typeInput = document.querySelector('#type');
const amountLabel = document.querySelector('#amountLabel');
const incomePeriodInput = document.querySelector('#incomePeriod');
const incomePeriodField = document.querySelector('#incomePeriodField');
const categoryInput = document.querySelector('#category');
const categoryInputField = document.querySelector('#categoryField');
const dateInput = document.querySelector('#date');
const searchInput = document.querySelector('#search');
const categoryFilter = document.querySelector('#filterCategory');
const typeFilter = document.querySelector('#filterType');
const list = document.querySelector('#transactionList');
const emptyMessage = document.querySelector('#emptyMessage');
const statusMessage = document.querySelector('#statusMessage');

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2
});
const categorySymbols = {
  Food: '◉', Transport: '↗', Shopping: '◇', Bills: '▤',
  Education: '▣', Entertainment: '♫', Health: '＋', Salary: '₹', Other: '•'
};
const today = new Date();
dateInput.value = toLocalISODate(today);
document.querySelector('#todayLabel').textContent = today.toLocaleDateString('en-IN', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
});
document.querySelector('#year').textContent = `© ${today.getFullYear()}`;

let transactions = loadTransactions();

function updateAmountLabel() {
  const isIncome = typeInput.value === 'income';
  amountLabel.textContent = `${isIncome ? 'Income' : 'Expense'} amount (₹)`;
  incomePeriodField.hidden = !isIncome;
  updateCategoryForIncome();
}

function updateCategoryForIncome(){
  const isIncome = typeInput.value === 'income';
  if(isIncome){
    categoryInput.value = 'Salary';
  }else{
     categoryInput.value = 'Other';
  }
  categoryInputField.style.display = isIncome ? "none": "flex";
}

typeInput.addEventListener('change', updateAmountLabel);
updateAmountLabel();

function toLocalISODate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function loadTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(item =>
      item && typeof item.id === 'string' &&
      typeof item.description === 'string' &&
      Number.isFinite(item.amount) && item.amount > 0 &&
      ['income', 'expense'].includes(item.type) &&
      typeof item.category === 'string' && typeof item.date === 'string'
    );
  } catch (error) {
    console.warn('Could not read saved transactions:', error);
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.error('Could not save transactions:', error);
    statusMessage.textContent = 'Could not save. Your browser storage may be full or disabled.';
    return false;
  }
}

function formatDate(value) {
  // Parse date-only values as local calendar dates to avoid timezone shifts.
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function updateSummary() {
  const income = transactions.reduce((sum, item) => sum + (item.type === 'income' ? item.amount : 0), 0);
  const expense = transactions.reduce((sum, item) => sum + (item.type === 'expense' ? item.amount : 0), 0);
  const balance = income - expense;
  document.querySelector('#income').textContent = money.format(income);
  document.querySelector('#expense').textContent = money.format(expense);
  const balanceEl = document.querySelector('#balance');
  balanceEl.textContent = money.format(balance);
  balanceEl.style.color = balance < 0 ? '#ffe0df' : '#fff';
}

function renderTransactions() {
  const query = searchInput.value.trim().toLocaleLowerCase('en-IN');
  const selectedCategory = categoryFilter.value;
  const selectedType = typeFilter.value;

  const filtered = transactions
    .filter(item => {
      const matchesQuery = `${item.description} ${item.category}`.toLocaleLowerCase('en-IN').includes(query);
      return matchesQuery &&
        (selectedCategory === 'All' || item.category === selectedCategory) &&
        (selectedType === 'All' || item.type === selectedType);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  list.replaceChildren();
  document.querySelector('#transactionCount').textContent = String(filtered.length);
  emptyMessage.hidden = filtered.length !== 0;

  for (const item of filtered) {
    const row = document.createElement('article');
    row.className = 'transaction';

    const left = document.createElement('div');
    left.className = 'transaction-left';
    const icon = document.createElement('span');
    icon.className = 'category-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = categorySymbols[item.category] || '•';

    const info = document.createElement('div');
    info.className = 'transaction-info';
    const title = document.createElement('h3');
    title.textContent = item.description;
    const meta = document.createElement('p');
    meta.textContent = `${item.category} · ${formatDate(item.date)}${item.type === 'income' && item.incomePeriod ? ` · ${item.incomePeriod === 'yearly' ? 'Per year' : 'Per month'}` : ''}`;
    info.append(title, meta);
    left.append(icon, info);

    const right = document.createElement('div');
    right.className = 'transaction-right';
    const amount = document.createElement('span');
    amount.className = `amount ${item.type}`;
    amount.textContent = `${item.type === 'income' ? '+' : '−'}${money.format(item.amount)}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-btn';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${item.description}`);
    remove.addEventListener('click', () => deleteTransaction(item.id));
    right.append(amount, remove);

    row.append(left, right);
    list.append(row);
  }
}

function deleteTransaction(id) {
  const item = transactions.find(entry => entry.id === id);
  if (!item || !window.confirm(`Delete “${item.description}”?`)) return;
  transactions = transactions.filter(entry => entry.id !== id);
  if (saveTransactions()) {
    renderTransactions();
    updateSummary();
    statusMessage.textContent = 'Transaction deleted.';
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  const date = dateInput.value;
  if (!description || !Number.isFinite(amount) || amount <= 0 || !date) {
    statusMessage.textContent = 'Enter a description, a positive amount, and a date.';
    return;
  }

  transactions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    description,
    amount: Math.round((amount + Number.EPSILON) * 100) / 100,
    type: typeInput.value,
    incomePeriod: typeInput.value === 'income' ? incomePeriodInput.value : '',
    category: categoryInput.value,
    date
  });

  if (saveTransactions()) {
    form.reset();
    updateAmountLabel();
    dateInput.value = toLocalISODate(new Date());
    renderTransactions();
    updateSummary();
    descriptionInput.focus();
    statusMessage.textContent = 'Transaction added.';
  }
});

searchInput.addEventListener('input', renderTransactions);
categoryFilter.addEventListener('change', renderTransactions);
typeFilter.addEventListener('change', renderTransactions);

document.querySelector('#exportBtn').addEventListener('click', () => {
  if (!transactions.length) {
    statusMessage.textContent = 'There are no transactions to export yet.';
    return;
  }
  const columns = ['Date', 'Description', 'Type', 'Income period', 'Category', 'Amount (INR)'];
  const rows = transactions.map(item => [
    item.date, item.description, item.type, item.incomePeriod || '', item.category, item.amount.toFixed(2)
  ]);
  const csv = [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ledger-transactions-${toLocalISODate(new Date())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  statusMessage.textContent = 'CSV export started.';
});

function csvCell(value) {
  // Quote every field and escape embedded quotes to keep commas/newlines safe.
  return `"${String(value).replace(/"/g, '""')}"`;
}

renderTransactions();
updateSummary();
