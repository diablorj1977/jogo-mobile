const emailEl = document.getElementById('profile-email');
const nicknameEl = document.getElementById('profile-nickname');
const levelEl = document.getElementById('profile-level');
const xpEl = document.getElementById('profile-xp');
const ecobotEl = document.getElementById('profile-ecobot');
const nicknameInput = document.getElementById('nickname-input');
const geofenceSelect = document.getElementById('geofence-select');
const saveButton = document.getElementById('save-geofence');
const statusEl = document.getElementById('profile-status');

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
