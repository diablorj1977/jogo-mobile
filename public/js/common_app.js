function getToken() {
  return localStorage.getItem('ecobots_token');
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, Object.assign({}, options, { headers }));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || 'Erro inesperado';
    if (response.status === 401) {
      localStorage.removeItem('ecobots_token');
      window.location.href = 'index.html';
    }
    throw new Error(message);
  }
  return data;
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'index.html';
  }
}

requireAuth();

const logoutLink = document.getElementById('logout-link');
if (logoutLink) {
  logoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('ecobots_token');
    window.location.href = 'index.html';
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

window.apiFetch = apiFetch;
