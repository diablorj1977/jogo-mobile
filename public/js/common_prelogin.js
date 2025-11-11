const base = window.EcobotsBase || {};
const statusMessage = document.getElementById('status-message');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const hqLink = document.getElementById('hq-link');

function applyConfig(config) {
  if (!config) {
    return;
  }
  if (base.config) {
    Object.assign(base.config, config);
  }
  if (typeof window.APP_CONFIG !== 'object' || window.APP_CONFIG === null) {
    window.APP_CONFIG = config;
  }
  if (config.hq_url && hqLink) {
    hqLink.href = config.hq_url;
  }
}

if (base.config && Object.keys(base.config).length > 0) {
  applyConfig(base.config);
} else {
  fetch(base.toApi ? base.toApi('init_config.php') : '/api/init_config.php')
    .then((res) => res.json())
    .then((config) => {
      applyConfig(config);
    })
    .catch(() => {});
}

function setStatus(message, type = 'info') {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = type;
}

function saveToken(token) {
  localStorage.setItem('ecobots_token', token);
}

function redirectHome() {
  const target = base.toHtml ? base.toHtml('home.html') : 'home.html';
  window.location.href = target;
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch(base.toApi ? base.toApi('login.php') : '/api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao entrar');
      }
      saveToken(data.token);
      redirectHome();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch(base.toApi ? base.toApi('register.php') : '/api/register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro no registro');
      }
      saveToken(data.token);
      redirectHome();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });
}

if ('serviceWorker' in navigator) {
  const swUrl = base.toHtml ? base.toHtml('sw.js') : '/sw.js';
  navigator.serviceWorker.register(swUrl).catch(() => {});
}
