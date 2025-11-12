// File: public/js/missao_corrida.js
const raceContainer = document.getElementById('race-container');
const raceError = document.getElementById('race-error');
const baseHelpersRace = window.EcobotsBase || {};
const raceParams = new URLSearchParams(window.location.search);
const raceMissionId = parseInt(raceParams.get('mission_id') || '', 10);
const raceRunId = parseInt(raceParams.get('run_id') || '', 10);
let raceDetail = null;
let mapInstance = null;
let playerMarker = null;
let raceWatchId = null;
let trackingStart = null;
let travelledDistance = 0;
let lastPosition = null;
let finishReached = false;
let routeLayer = null;
let expectedRouteDistance = null;
let expectedRouteDuration = null;

function toHtml(path) {
  if (typeof baseHelpersRace.toHtml === 'function') {
    return baseHelpersRace.toHtml(path);
  }
  return path;
}

function renderRaceOutcome(container, data, fallbackMessage) {
  if (!container) {
    return;
  }
  const notice = document.createElement('div');
  notice.className = 'notification is-success mission-outcome-message';
  const parts = [fallbackMessage || 'Missão concluída!'];
  if (data && typeof data.reward_xp === 'number') {
    parts.push(`XP ${data.reward_xp}`);
  }
  const drop = data?.drop_reward?.awarded ? data.drop_reward.item : null;
  if (drop) {
    const quantity = drop.quantity ? ` x${drop.quantity}` : '';
    parts.push(`Item: ${drop.name}${quantity}`);
  }
  notice.textContent = parts.join(' · ');
  container.appendChild(notice);
}

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computePoints() {
  const mission = raceDetail.mission;
  const points = raceDetail.type_data.points || [];
  if (points.length >= 2) {
    return { start: points[0], end: points[points.length - 1] };
  }
  const start = { lat: mission.lat, lng: mission.lng, raio_m: mission.raio_m };
  const end = {
    lat: mission.dest_lat !== null ? mission.dest_lat : mission.lat,
    lng: mission.dest_lng !== null ? mission.dest_lng : mission.lng,
    raio_m: mission.dest_raio_m || mission.raio_m,
  };
  return { start, end };
}

function updateMetrics(element) {
  if (!element) return;
  element.innerHTML = '';
  const metrics = [
    `Distância percorrida: ${(travelledDistance / 1000).toFixed(3)} km`,
  ];
  if (trackingStart) {
    const elapsed = (Date.now() - trackingStart) / 1000;
    metrics.push(`Tempo: ${elapsed.toFixed(0)} s`);
    if (elapsed > 0) {
      const speed = (travelledDistance / elapsed) * 3.6;
      metrics.push(`Velocidade média: ${speed.toFixed(2)} km/h`);
    }
  }
  if (typeof expectedRouteDistance === 'number') {
    metrics.push(`Distância prevista: ${(expectedRouteDistance / 1000).toFixed(2)} km`);
  }
  if (typeof expectedRouteDuration === 'number') {
    const minutes = Math.max(1, Math.round(expectedRouteDuration / 60));
    metrics.push(`Tempo estimado: ${minutes} min`);
  }
  metrics.forEach((text) => {
    const span = document.createElement('span');
    span.textContent = text;
    element.appendChild(span);
  });
}

function clearRaceRoute() {
  if (routeLayer && mapInstance) {
    mapInstance.removeLayer(routeLayer);
  }
  routeLayer = null;
}

async function drawRoute(points, infoElement, metricsElement) {
  if (!mapInstance || !infoElement) {
    return;
  }
  if (!baseHelpersRace.fetchRoute) {
    infoElement.textContent = 'Roteador indisponível.';
    infoElement.classList.add('has-text-danger');
    return;
  }
  infoElement.textContent = 'Calculando rota sugerida...';
  infoElement.classList.remove('has-text-danger');
  try {
    const route = await baseHelpersRace.fetchRoute([points.start, points.end]);
    const latLngs = baseHelpersRace.routeToLatLngs
      ? baseHelpersRace.routeToLatLngs(route)
      : route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    clearRaceRoute();
    routeLayer = L.polyline(latLngs, { color: '#f97316', weight: 4, opacity: 0.7, dashArray: '6 8' }).addTo(mapInstance);
    mapInstance.fitBounds(routeLayer.getBounds(), { padding: [32, 32] });
    expectedRouteDistance = route.distance;
    expectedRouteDuration = route.duration;
    infoElement.textContent = `Rota sugerida carregada (${(route.distance / 1000).toFixed(2)} km)`;
    updateMetrics(metricsElement);
  } catch (error) {
    expectedRouteDistance = null;
    expectedRouteDuration = null;
    infoElement.textContent = error.message || 'Não foi possível obter a rota sugerida.';
    infoElement.classList.add('has-text-danger');
    clearRaceRoute();
    updateMetrics(metricsElement);
  }
}

function renderRace() {
  raceContainer.innerHTML = '';
  raceError.classList.add('is-hidden');
  clearRaceRoute();
  expectedRouteDistance = null;
  expectedRouteDuration = null;

  const header = document.createElement('div');
  header.className = 'mission-detail-header';
  const title = document.createElement('h1');
  title.className = 'title is-3';
  title.textContent = raceDetail.mission.name;
  header.appendChild(title);
  raceContainer.appendChild(header);

  const points = computePoints();
  const mapElement = document.createElement('div');
  mapElement.className = 'mission-map';
  raceContainer.appendChild(mapElement);

  mapInstance = L.map(mapElement).setView([points.start.lat, points.start.lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);

  L.marker([points.start.lat, points.start.lng]).addTo(mapInstance).bindPopup('Ponto inicial');
  L.marker([points.end.lat, points.end.lng]).addTo(mapInstance).bindPopup('Ponto final');
  L.circle([points.end.lat, points.end.lng], { radius: points.end.raio_m || raceDetail.start_radius_m }).addTo(mapInstance);

  const routeInfo = document.createElement('div');
  routeInfo.className = 'mission-route-info';
  raceContainer.appendChild(routeInfo);

  const metrics = document.createElement('div');
  metrics.className = 'mission-run-metrics';
  raceContainer.appendChild(metrics);
  updateMetrics(metrics);

  const actions = document.createElement('div');
  actions.className = 'mission-start-actions';
  const abortButton = document.createElement('button');
  abortButton.className = 'button is-danger is-light';
  abortButton.type = 'button';
  abortButton.textContent = 'Abortar missão';
  abortButton.addEventListener('click', () => abortRaceMission(abortButton, points, metrics));
  actions.appendChild(abortButton);

  const backButton = document.createElement('a');
  backButton.className = 'button is-light';
  backButton.href = toHtml(`missao.html?mission_id=${encodeURIComponent(raceMissionId)}`);
  backButton.textContent = 'Voltar à missão';
  actions.appendChild(backButton);

  raceContainer.appendChild(actions);

  drawRoute(points, routeInfo, metrics);
  startTracking(points, metrics);
}

function startTracking(points, metricsElement) {
  if (!navigator.geolocation) {
    raceError.textContent = 'Geolocalização não suportada pelo dispositivo.';
    raceError.classList.remove('is-hidden');
    return;
  }
  const finishRadius = points.end.raio_m || raceDetail.start_radius_m;
  stopRaceTracking();
  trackingStart = null;
  travelledDistance = 0;
  lastPosition = null;
  finishReached = false;

  raceWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      if (!trackingStart) {
        trackingStart = Date.now();
      }
      if (playerMarker) {
        playerMarker.setLatLng([latitude, longitude]);
      } else if (mapInstance) {
        playerMarker = L.marker([latitude, longitude], { icon: L.icon({ iconUrl: window.APP_CONFIG?.mission_type_icons?.DEFAULT, iconSize: [32, 32] }) }).addTo(mapInstance);
      }
      if (lastPosition) {
        travelledDistance += haversine(lastPosition.lat, lastPosition.lng, latitude, longitude);
      }
      lastPosition = { lat: latitude, lng: longitude };
      updateMetrics(metricsElement);

      const distanceToEnd = haversine(latitude, longitude, points.end.lat, points.end.lng);
      if (!finishReached && distanceToEnd <= finishRadius) {
        finishReached = true;
        if (raceWatchId) {
          navigator.geolocation.clearWatch(raceWatchId);
          raceWatchId = null;
        }
        finalizeRace(latitude, longitude);
      }
    },
    (error) => {
      raceError.textContent = `Erro de geolocalização: ${error.message}`;
      raceError.classList.remove('is-hidden');
    },
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

function stopRaceTracking() {
  if (raceWatchId) {
    navigator.geolocation.clearWatch(raceWatchId);
    raceWatchId = null;
  }
}

function finalizeRace(endLat, endLng) {
  const durationSeconds = trackingStart ? Math.round((Date.now() - trackingStart) / 1000) : null;
  window
    .apiFetch('mission_finish.php', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: raceMissionId,
        run_id: raceRunId,
        end_lat: endLat,
        end_lng: endLng,
        duration_s: durationSeconds,
        dist_m: travelledDistance,
      }),
    })
    .then((data) => {
      renderRaceOutcome(raceContainer, data, 'Missão concluída! Continue avançando com seu Ecobot.');
    })
    .catch((error) => {
      raceError.textContent = error.message;
      raceError.classList.remove('is-hidden');
    });
}

function abortRaceMission(button, points, metricsElement) {
  if (!window.confirm('Tem certeza que deseja abortar esta missão de corrida?')) {
    return;
  }
  const resumeTracking = raceWatchId !== null;
  stopRaceTracking();
  button.disabled = true;
  button.classList.add('is-loading');
  const payload = {
    mission_id: raceMissionId,
    run_id: raceRunId,
  };
  if (lastPosition) {
    payload.end_lat = lastPosition.lat;
    payload.end_lng = lastPosition.lng;
  }
  if (trackingStart) {
    payload.duration_s = Math.max(0, Math.round((Date.now() - trackingStart) / 1000));
  }
  if (travelledDistance) {
    payload.dist_m = travelledDistance;
  }
  window
    .apiFetch('mission_abort.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    .then(() => {
      button.classList.remove('is-loading');
      button.textContent = 'Missão abortada';
      button.classList.add('is-static');
      const notice = document.createElement('div');
      notice.className = 'notification is-warning mission-outcome-message';
      notice.textContent = 'Missão abortada. Você pode tentar novamente quando quiser.';
      raceContainer.appendChild(notice);
      clearRaceRoute();
      expectedRouteDistance = null;
      expectedRouteDuration = null;
      updateMetrics(metricsElement);
    })
    .catch((error) => {
      raceError.textContent = error.message;
      raceError.classList.remove('is-hidden');
      button.disabled = false;
      button.classList.remove('is-loading');
      if (resumeTracking) {
        startTracking(points, metricsElement);
      }
    });
}

function loadRaceMission() {
  if (!raceMissionId || !raceRunId) {
    raceContainer.innerHTML = '';
    raceError.textContent = 'Parâmetros da missão ausentes.';
    raceError.classList.remove('is-hidden');
    return;
  }
  const query = new URLSearchParams({ mission_id: raceMissionId, run_id: raceRunId });
  window
    .apiFetch(`mission_detail.php?${query.toString()}`)
    .then((detail) => {
      if ((detail.mission.tipo || '').toUpperCase() !== 'CORRIDA') {
        throw new Error('Esta missão não é do tipo corrida.');
      }
      raceDetail = detail;
      renderRace();
    })
    .catch((error) => {
      raceContainer.innerHTML = '';
      raceError.textContent = error.message;
      raceError.classList.remove('is-hidden');
    });
}

loadRaceMission();
