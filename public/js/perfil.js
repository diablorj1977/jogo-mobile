// File: public/js/perfil.js
const emailEl = document.getElementById('profile-email');
const nicknameEl = document.getElementById('profile-nickname');
const levelEl = document.getElementById('profile-level');
const xpEl = document.getElementById('profile-xp');
const ecobotEl = document.getElementById('profile-ecobot');
const nicknameInput = document.getElementById('nickname-input');
const geofenceSelect = document.getElementById('geofence-select');
const saveButton = document.getElementById('save-geofence');
const statusEl = document.getElementById('profile-status');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');

async function loadProfile() {
  try {
    const data = await window.apiFetch('me.php');
    emailEl.textContent = data.email;
    nicknameEl.textContent = data.nickname || '-';
    levelEl.textContent = data.level;
    xpEl.textContent = data.xp;
    ecobotEl.textContent = `${data.ecobot.status}${data.ecobot.down_until ? ` (até ${data.ecobot.down_until})` : ''}`;
    if (nicknameInput) {
      nicknameInput.value = data.nickname || '';
    }
    if (geofenceSelect) {
      geofenceSelect.value = String(data.geofence_km);
    }
    if (currentPasswordInput) currentPasswordInput.value = '';
    if (newPasswordInput) newPasswordInput.value = '';
    if (confirmPasswordInput) confirmPasswordInput.value = '';
    if (statusEl) {
      statusEl.textContent = '';
    }
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

if (saveButton) {
  saveButton.addEventListener('click', async () => {
    try {
      const payload = {
        geofence_km: parseInt(geofenceSelect.value, 10),
      };
      if (nicknameInput && nicknameInput.value.trim() !== '') {
        payload.nickname = nicknameInput.value.trim();
      }
      const newPassword = newPasswordInput ? newPasswordInput.value : '';
      const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
      const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
      if (newPassword || confirmPassword || currentPassword) {
        if (!newPassword) {
          statusEl.textContent = 'Informe a nova senha.';
          return;
        }
        if (newPassword !== confirmPassword) {
          statusEl.textContent = 'As senhas não coincidem.';
          return;
        }
        if (!currentPassword) {
          statusEl.textContent = 'Informe a senha atual para confirmar.';
          return;
        }
        payload.new_password = newPassword;
        payload.current_password = currentPassword;
      }
      await window.apiFetch('profile_update.php', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      statusEl.textContent = 'Atualizado com sucesso';
      loadProfile();
    } catch (error) {
      statusEl.textContent = error.message;
    }
  });
}

loadProfile();
