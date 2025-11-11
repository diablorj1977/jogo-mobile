const statusMessage = document.getElementById('status-message');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const hqLink = document.getElementById('hq-link');

fetch('/api/init_config.php')
  .then((res) => res.json())
  .then((config) => {
    if (config && config.hq_url && hqLink) {
      hqLink.href = config.hq_url;
    }
  })
  .catch(() => {});

function setStatus(message, type = 'info') {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = type;
}

function saveToken(token) {
  localStorage.setItem('ecobots_token', token);
}

function redirectHome() {
  window.location.href = 'home.html';
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch('/api/login.php', {
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
      const response = await fetch('/api/register.php', {
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
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
