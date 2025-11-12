// File: public/js/common_app.js
const base = window.EcobotsBase || {};

function getToken() {
  return localStorage.getItem('ecobots_token');
}

function resolveApiUrl(path) {
  if (base.toApi) {
    return base.toApi(path);
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const cleaned = path.replace(/^\/+/, '');
  return `/api/${cleaned}`;
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(resolveApiUrl(path || ''), Object.assign({}, options, { headers }));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || 'Erro inesperado';
    if (response.status === 401) {
      localStorage.removeItem('ecobots_token');
      const redirectUrl = base.toHtml ? base.toHtml('index.html') : 'index.html';
      window.location.href = redirectUrl;
    }
    throw new Error(message);
  }
  return data;
}

function requireAuth() {
  if (!getToken()) {
    const redirectUrl = base.toHtml ? base.toHtml('index.html') : 'index.html';
    window.location.href = redirectUrl;
  }
}

requireAuth();

const logoutLink = document.getElementById('logout-link');
if (logoutLink) {
  logoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('ecobots_token');
    const redirectUrl = base.toHtml ? base.toHtml('index.html') : 'index.html';
    window.location.href = redirectUrl;
  });
}

if ('serviceWorker' in navigator) {
  const swUrl = base.toHtml ? base.toHtml('sw.js') : '/sw.js';
  navigator.serviceWorker.register(swUrl).catch(() => {});
}

window.apiFetch = apiFetch;
