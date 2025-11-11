// File: public/js/home.js
const mapElement = document.getElementById('map');
const missionsContainer = document.getElementById('missions-container');
const radiusSelect = document.getElementById('radius-select');
const refreshButton = document.getElementById('refresh-missions');
const encounterButton = document.getElementById('scan-encounter');
const encounterStatus = document.getElementById('encounter-status');
let map;
let userMarker;
let missionMarkers = [];

function initMap(lat, lng) {
  map = L.map(mapElement).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(map);
  userMarker = L.marker([lat, lng]).addTo(map).bindPopup('Você');
}

function clearMarkers() {
  missionMarkers.forEach((marker) => map.removeLayer(marker));
  missionMarkers = [];
}

async function loadMissions(lat, lng) {
  const km = radiusSelect.value || '3';
  try {
    const data = await window.apiFetch(`missions_list.php?lat=${lat}&lng=${lng}&km=${km}`);
    missionsContainer.innerHTML = '';
    clearMarkers();
    data.missions.forEach((mission) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${mission.name}</strong> — ${mission.tipo} — ${(mission.distance_m / 1000).toFixed(2)} km`;
      missionsContainer.appendChild(li);
      const marker = L.marker([mission.lat, mission.lng]).addTo(map).bindPopup(mission.name);
      missionMarkers.push(marker);
    });
  } catch (error) {
    missionsContainer.innerHTML = `<li>${error.message}</li>`;
  }
}

function locateAndLoad() {
  if (!navigator.geolocation) {
    missionsContainer.innerHTML = '<li>Geolocalização indisponível</li>';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      if (!map) {
        initMap(latitude, longitude);
      } else {
        userMarker.setLatLng([latitude, longitude]);
        map.setView([latitude, longitude]);
      }
      loadMissions(latitude, longitude);
    },
    () => {
      missionsContainer.innerHTML = '<li>Não foi possível obter localização</li>';
    }
  );
}

if (refreshButton) {
  refreshButton.addEventListener('click', () => locateAndLoad());
}

if (radiusSelect) {
  radiusSelect.addEventListener('change', () => locateAndLoad());
}

if (encounterButton) {
  encounterButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      encounterStatus.textContent = 'Sem acesso à localização';
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      encounterStatus.textContent = 'Escaneando...';
      try {
        const payload = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const data = await window.apiFetch('encounter_scan.php', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (data.spawned && data.encounter) {
          encounterStatus.textContent = `Inimigo detectado! ID ${data.encounter.encounter_id}`;
        } else if (data.cooldown) {
          encounterStatus.textContent = `Aguarde ${data.cooldown}s para nova varredura.`;
        } else {
          encounterStatus.textContent = 'Nenhum encontro encontrado desta vez.';
        }
      } catch (error) {
        encounterStatus.textContent = error.message;
      }
    });
  });
}

locateAndLoad();
