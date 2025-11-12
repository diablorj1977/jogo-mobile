// File: public/js/home.js
const mapElement = document.getElementById('map');
const refreshButton = document.getElementById('refresh-missions');
const encounterButton = document.getElementById('scan-encounter');
const encounterStatus = document.getElementById('encounter-status');
const radiusInfo = document.getElementById('radius-info');
const mapStatus = document.getElementById('map-status');
let map;
let userMarker;
let missionMarkers = [];
let activeRouteLayer = null;
let activeRouteMissionId = null;
const missionIconCache = {};
const baseHelpers = window.EcobotsBase || {};

function setMapStatus(message, variant = 'info') {
  if (!mapStatus) {
    return;
  }
  if (!message) {
    mapStatus.textContent = '';
    mapStatus.classList.add('is-hidden');
    mapStatus.classList.remove('is-error', 'is-info');
    return;
  }
  mapStatus.textContent = message;
  mapStatus.classList.remove('is-hidden');
  mapStatus.classList.toggle('is-error', variant === 'error');
  mapStatus.classList.toggle('is-info', variant !== 'error');
}

function buildMissionDetailUrl(missionId) {
  const path = `missao.html?mission_id=${encodeURIComponent(missionId)}`;
  if (typeof baseHelpers.toHtml === 'function') {
    return baseHelpers.toHtml(path);
  }
  return path;
}
let currentRadiusKm = null;
let radiusPromise = null;

function updateRadiusInfo(km, isError = false) {
  if (!radiusInfo) return;
  radiusInfo.textContent = isError ? km : `Raio atual: ${km} km`;
  radiusInfo.classList.toggle('is-danger', isError);
  radiusInfo.classList.toggle('is-warning', isError);
}

async function ensureRadius() {
  if (currentRadiusKm !== null) {
    return currentRadiusKm;
  }
  if (!radiusPromise) {
    radiusPromise = window
      .apiFetch('me.php')
      .then((profile) => {
        const km = parseInt(profile.geofence_km, 10);
        currentRadiusKm = Number.isNaN(km) ? 3 : km;
        updateRadiusInfo(currentRadiusKm);
        return currentRadiusKm;
      })
      .catch((error) => {
        currentRadiusKm = 3;
        updateRadiusInfo(error.message || 'Falha ao obter raio', true);
        throw error;
      });
  }
  return radiusPromise.catch(() => currentRadiusKm);
}

function getMissionIcon(url) {
  const fallback = (window.APP_CONFIG && window.APP_CONFIG.default_mission_icon) || null;
  const iconUrl = url || fallback;
  if (!iconUrl) {
    return null;
  }
  if (!missionIconCache[iconUrl]) {
    missionIconCache[iconUrl] = L.icon({
      iconUrl,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -28],
      className: 'mission-marker-icon',
    });
  }
  return missionIconCache[iconUrl];
}

function initMap(lat, lng) {
  map = L.map(mapElement).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(map);
  userMarker = L.marker([lat, lng]).addTo(map).bindPopup('Você');
}

function clearMarkers() {
  clearRouteLayer();
  missionMarkers.forEach((marker) => map.removeLayer(marker));
  missionMarkers = [];
}

function clearRouteLayer() {
  if (activeRouteLayer && map) {
    map.removeLayer(activeRouteLayer);
  }
  activeRouteLayer = null;
  activeRouteMissionId = null;
}

async function handleRouteForMission(mission, button, statusElement) {
  if (!map || !userMarker) {
    statusElement.textContent = 'Localização atual indisponível.';
    statusElement.classList.add('has-text-danger');
    return;
  }
  if (!baseHelpers.fetchRoute) {
    statusElement.textContent = 'Roteador indisponível.';
    statusElement.classList.add('has-text-danger');
    return;
  }

  if (activeRouteMissionId === mission.id) {
    clearRouteLayer();
    statusElement.textContent = '';
    statusElement.classList.remove('has-text-danger');
    button.textContent = 'Mostrar caminho';
    return;
  }

  button.disabled = true;
  statusElement.textContent = 'Calculando rota...';
  statusElement.classList.remove('has-text-danger');

  try {
    const origin = userMarker.getLatLng();
    const route = await baseHelpers.fetchRoute([
      { lat: origin.lat, lng: origin.lng },
      { lat: mission.lat, lng: mission.lng },
    ]);
    const latLngs = baseHelpers.routeToLatLngs
      ? baseHelpers.routeToLatLngs(route)
      : route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    clearRouteLayer();
    activeRouteLayer = L.polyline(latLngs, { color: '#2563eb', weight: 5, opacity: 0.7 }).addTo(map);
    activeRouteMissionId = mission.id;
    map.fitBounds(activeRouteLayer.getBounds(), { padding: [32, 32] });
    const distanceKm = (route.distance / 1000).toFixed(2);
    const durationMinutes = Math.max(1, Math.round(route.duration / 60));
    statusElement.textContent = `Distância pela rota: ${distanceKm} km · cerca de ${durationMinutes} min`;
    button.textContent = 'Ocultar caminho';
  } catch (error) {
    statusElement.textContent = error.message || 'Não foi possível calcular a rota.';
    statusElement.classList.add('has-text-danger');
    clearRouteLayer();
    button.textContent = 'Mostrar caminho';
  } finally {
    button.disabled = false;
  }
}

async function loadMissions(lat, lng) {
  const km = await ensureRadius().catch(() => currentRadiusKm || 3);
  try {
    setMapStatus('Carregando missões...', 'info');
    const data = await window.apiFetch(`missions_list.php?lat=${lat}&lng=${lng}&km=${km}`);
    clearMarkers();
    data.missions.forEach((mission) => {
      const iconUrl = mission.icon_url || (window.APP_CONFIG && window.APP_CONFIG.default_mission_icon);
      const detailUrl = buildMissionDetailUrl(mission.id);
      const icon = getMissionIcon(mission.icon_url);
      const markerOptions = {};
      if (icon) {
        markerOptions.icon = icon;
      }
      const marker = L.marker([mission.lat, mission.lng], markerOptions).addTo(map);
      const popupContent = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = mission.name;
      popupContent.appendChild(title);
      const meta = document.createElement('div');
      meta.className = 'mission-entry-meta';
      meta.textContent = `${mission.tipo} · ${(mission.distance_m / 1000).toFixed(2)} km`;
      popupContent.appendChild(meta);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button mission-popup-button is-small';
      button.textContent = 'Mostrar missão';
      button.addEventListener('click', () => {
        window.location.href = detailUrl;
      });
      popupContent.appendChild(button);
      const routeInfo = document.createElement('div');
      routeInfo.className = 'mission-route-info mt-2';
      popupContent.appendChild(routeInfo);
      const routeButton = document.createElement('button');
      routeButton.type = 'button';
      routeButton.className = 'button mission-popup-button mission-popup-button-route is-small';
      routeButton.textContent = 'Mostrar caminho';
      routeButton.addEventListener('click', () => {
        handleRouteForMission(mission, routeButton, routeInfo);
      });
      popupContent.appendChild(routeButton);
      marker.bindPopup(popupContent);
      missionMarkers.push(marker);
    });
    setMapStatus(`${data.missions.length} missões carregadas no mapa.`, 'info');
  } catch (error) {
    setMapStatus(error.message || 'Não foi possível carregar missões.', 'error');
  }
}

function locateAndLoad() {
  ensureRadius().catch(() => {});
  if (!navigator.geolocation) {
    setMapStatus('Geolocalização indisponível.', 'error');
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
      clearRouteLayer();
      loadMissions(latitude, longitude);
    },
    () => {
      setMapStatus('Não foi possível obter a localização atual.', 'error');
    }
  );
}

if (refreshButton) {
  refreshButton.addEventListener('click', () => locateAndLoad());
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
