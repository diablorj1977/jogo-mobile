// File: public/js/missao_p2p.js
const p2pContainer = document.getElementById('p2p-container');
const p2pError = document.getElementById('p2p-error');
const baseHelpersP2p = window.EcobotsBase || {};
const p2pParams = new URLSearchParams(window.location.search);
const p2pMissionId = parseInt(p2pParams.get('mission_id') || '', 10);
const p2pRunId = parseInt(p2pParams.get('run_id') || '', 10);
let p2pDetail = null;
let mapRef = null;
let playerMarkerP2p = null;
let watchIdP2p = null;
let travelledMeters = 0;
let startTimestamp = null;
let previousPosition = null;
let currentPointIndex = 0;
let checkpointsLog = [];
let routeLayer = null;
let expectedRouteDistance = null;
let expectedRouteDuration = null;

function toHtml(path) {
  if (typeof baseHelpersP2p.toHtml === 'function') {
    return baseHelpersP2p.toHtml(path);
  }
  return path;
}

function renderP2pOutcome(container, data, fallbackMessage) {
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

function haversineDistance(aLat, aLng, bLat, bLng) {
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

function updateProgressList() {
  const list = document.getElementById('p2p-progress');
  if (!list) return;
  list.innerHTML = '';
  checkpointsLog.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'mission-progress-log-item';
    item.textContent = `Seq ${entry.seq} concluído às ${new Date(entry.at).toLocaleTimeString()}`;
    list.appendChild(item);
  });
}

function updateP2pMetrics(element) {
  if (!element) return;
  element.innerHTML = '';
  const pieces = [`Distância percorrida: ${(travelledMeters / 1000).toFixed(3)} km`];
  if (startTimestamp) {
    const elapsed = (Date.now() - startTimestamp) / 1000;
    pieces.push(`Tempo: ${elapsed.toFixed(0)} s`);
  }
  if (typeof expectedRouteDistance === 'number') {
    pieces.push(`Distância prevista: ${(expectedRouteDistance / 1000).toFixed(2)} km`);
  }
  if (typeof expectedRouteDuration === 'number') {
    const minutes = Math.max(1, Math.round(expectedRouteDuration / 60));
    pieces.push(`Tempo estimado: ${minutes} min`);
  }
  pieces.forEach((text) => {
    const span = document.createElement('span');
    span.textContent = text;
    element.appendChild(span);
  });
}

function clearP2pRoute() {
  if (routeLayer && mapRef) {
    mapRef.removeLayer(routeLayer);
  }
  routeLayer = null;
}

async function drawP2pRoute(points, infoElement, metricsElement) {
  if (!mapRef || !infoElement) {
    return;
  }
  if (!baseHelpersP2p.fetchRoute) {
    infoElement.textContent = 'Roteador indisponível.';
    infoElement.classList.add('has-text-danger');
    return;
  }
  infoElement.textContent = 'Calculando rota sugerida...';
  infoElement.classList.remove('has-text-danger');
  try {
    const routePoints = points.map((point) => ({ lat: point.lat, lng: point.lng }));
    const route = await baseHelpersP2p.fetchRoute(routePoints);
    const latLngs = baseHelpersP2p.routeToLatLngs
      ? baseHelpersP2p.routeToLatLngs(route)
      : route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    clearP2pRoute();
    routeLayer = L.polyline(latLngs, { color: '#0ea5e9', weight: 4, opacity: 0.7, dashArray: '6 8' }).addTo(mapRef);
    mapRef.fitBounds(routeLayer.getBounds(), { padding: [32, 32] });
    expectedRouteDistance = route.distance;
    expectedRouteDuration = route.duration;
    infoElement.textContent = `Rota sugerida carregada (${(route.distance / 1000).toFixed(2)} km)`;
    updateP2pMetrics(metricsElement);
  } catch (error) {
    expectedRouteDistance = null;
    expectedRouteDuration = null;
    infoElement.textContent = error.message || 'Não foi possível obter a rota sugerida.';
    infoElement.classList.add('has-text-danger');
    clearP2pRoute();
    updateP2pMetrics(metricsElement);
  }
}

function renderP2p() {
  p2pContainer.innerHTML = '';
  p2pError.classList.add('is-hidden');
  clearP2pRoute();
  expectedRouteDistance = null;
  expectedRouteDuration = null;

  const header = document.createElement('div');
  header.className = 'mission-detail-header';
  const title = document.createElement('h1');
  title.className = 'title is-3';
  title.textContent = p2pDetail.mission.name;
  header.appendChild(title);
  p2pContainer.appendChild(header);

  const mapElement = document.createElement('div');
  mapElement.className = 'mission-map';
  p2pContainer.appendChild(mapElement);

  const points = p2pDetail.type_data.points || [];
  if (!points.length) {
    p2pError.textContent = 'A missão não possui pontos configurados.';
    p2pError.classList.remove('is-hidden');
    return;
  }

  mapRef = L.map(mapElement).setView([points[0].lat, points[0].lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapRef);

  points.forEach((point, index) => {
    L.marker([point.lat, point.lng]).addTo(mapRef).bindPopup(`Ponto ${point.seq}`);
    L.circle([point.lat, point.lng], { radius: point.raio_m || p2pDetail.start_radius_m }).addTo(mapRef);
    if (index > 0) {
      const prev = points[index - 1];
      L.polyline(
        [
          [prev.lat, prev.lng],
          [point.lat, point.lng],
        ],
        { color: '#2563eb', weight: 3, opacity: 0.6 }
      ).addTo(mapRef);
    }
  });

  const routeInfo = document.createElement('div');
  routeInfo.className = 'mission-route-info';
  p2pContainer.appendChild(routeInfo);

  const metrics = document.createElement('div');
  metrics.className = 'mission-run-metrics';
  p2pContainer.appendChild(metrics);
  updateP2pMetrics(metrics);

  const progressList = document.createElement('ul');
  progressList.id = 'p2p-progress';
  progressList.className = 'mission-progress-log';
  p2pContainer.appendChild(progressList);

  const actions = document.createElement('div');
  actions.className = 'mission-start-actions';
  const abortButton = document.createElement('button');
  abortButton.className = 'button is-danger is-light';
  abortButton.type = 'button';
  abortButton.textContent = 'Abortar missão';
  abortButton.addEventListener('click', () => abortP2pMission(abortButton, points, metrics));
  actions.appendChild(abortButton);

  const backButton = document.createElement('a');
  backButton.className = 'button is-light';
  backButton.href = toHtml(`missao.html?mission_id=${encodeURIComponent(p2pMissionId)}`);
  backButton.textContent = 'Voltar à missão';
  actions.appendChild(backButton);

  p2pContainer.appendChild(actions);

  drawP2pRoute(points, routeInfo, metrics);
  startP2pTracking(points, metrics);
}

function startP2pTracking(points, metricsElement) {
  if (!navigator.geolocation) {
    p2pError.textContent = 'Geolocalização não suportada pelo dispositivo.';
    p2pError.classList.remove('is-hidden');
    return;
  }
  stopP2pTracking();
  currentPointIndex = 0;
  travelledMeters = 0;
  previousPosition = null;
  startTimestamp = null;
  checkpointsLog = [];
  updateProgressList();

  watchIdP2p = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      if (!startTimestamp) {
        startTimestamp = Date.now();
      }
      if (playerMarkerP2p) {
        playerMarkerP2p.setLatLng([latitude, longitude]);
      } else if (mapRef) {
        playerMarkerP2p = L.marker([latitude, longitude], { icon: L.icon({ iconUrl: window.APP_CONFIG?.mission_type_icons?.P2P || window.APP_CONFIG?.default_mission_icon, iconSize: [32, 32] }) }).addTo(mapRef);
      }
      if (previousPosition) {
        travelledMeters += haversineDistance(previousPosition.lat, previousPosition.lng, latitude, longitude);
      }
      previousPosition = { lat: latitude, lng: longitude };
      updateP2pMetrics(metricsElement);

      const target = points[currentPointIndex];
      const distance = haversineDistance(latitude, longitude, target.lat, target.lng);
      if (distance <= (target.raio_m || p2pDetail.start_radius_m)) {
        confirmCheckpoint(target, latitude, longitude, points, metricsElement);
      }
    },
    (error) => {
      p2pError.textContent = `Erro de geolocalização: ${error.message}`;
      p2pError.classList.remove('is-hidden');
    },
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

function confirmCheckpoint(point, latitude, longitude, points, metricsElement) {
  navigator.geolocation.clearWatch(watchIdP2p);
  watchIdP2p = null;
  window
    .apiFetch('mission_p2p_touch.php', {
      method: 'POST',
      body: JSON.stringify({
        run_id: p2pRunId,
        seq: point.seq,
        lat: latitude,
        lng: longitude,
      }),
    })
    .then(() => {
      checkpointsLog.push({ seq: point.seq, at: new Date().toISOString() });
      updateProgressList();
      currentPointIndex += 1;
      if (currentPointIndex >= points.length) {
        finalizeP2p(latitude, longitude);
      } else {
        resumeTracking(points, metricsElement);
      }
    })
    .catch((error) => {
      p2pError.textContent = error.message;
      p2pError.classList.remove('is-hidden');
      resumeTracking(points, metricsElement);
    });
}

function resumeTracking(points, metricsElement) {
  watchIdP2p = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      if (playerMarkerP2p) {
        playerMarkerP2p.setLatLng([latitude, longitude]);
      }
      if (previousPosition) {
        travelledMeters += haversineDistance(previousPosition.lat, previousPosition.lng, latitude, longitude);
      }
      previousPosition = { lat: latitude, lng: longitude };
      updateP2pMetrics(metricsElement);
      const target = points[currentPointIndex];
      const distance = haversineDistance(latitude, longitude, target.lat, target.lng);
      if (distance <= (target.raio_m || p2pDetail.start_radius_m)) {
        navigator.geolocation.clearWatch(watchIdP2p);
        watchIdP2p = null;
        confirmCheckpoint(target, latitude, longitude, points, metricsElement);
      }
    },
    (error) => {
      p2pError.textContent = `Erro de geolocalização: ${error.message}`;
      p2pError.classList.remove('is-hidden');
    },
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

function stopP2pTracking() {
  if (watchIdP2p) {
    navigator.geolocation.clearWatch(watchIdP2p);
    watchIdP2p = null;
  }
}

function finalizeP2p(endLat, endLng) {
  const durationSeconds = startTimestamp ? Math.round((Date.now() - startTimestamp) / 1000) : null;
  window
    .apiFetch('mission_finish.php', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: p2pMissionId,
        run_id: p2pRunId,
        end_lat: endLat,
        end_lng: endLng,
        duration_s: durationSeconds,
        dist_m: travelledMeters,
      }),
    })
    .then((data) => {
      renderP2pOutcome(p2pContainer, data, 'Todos os pontos concluídos! Missão finalizada com sucesso.');
    })
    .catch((error) => {
      p2pError.textContent = error.message;
      p2pError.classList.remove('is-hidden');
    });
}

function abortP2pMission(button, points, metricsElement) {
  if (!window.confirm('Tem certeza que deseja abortar esta missão ponto a ponto?')) {
    return;
  }
  const resumeAfterFailure = watchIdP2p !== null;
  stopP2pTracking();
  button.disabled = true;
  button.classList.add('is-loading');
  const payload = {
    mission_id: p2pMissionId,
    run_id: p2pRunId,
  };
  if (previousPosition) {
    payload.end_lat = previousPosition.lat;
    payload.end_lng = previousPosition.lng;
  }
  if (startTimestamp) {
    payload.duration_s = Math.max(0, Math.round((Date.now() - startTimestamp) / 1000));
  }
  if (travelledMeters) {
    payload.dist_m = travelledMeters;
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
      notice.textContent = 'Missão abortada. Você pode tentar novamente quando estiver pronto.';
      p2pContainer.appendChild(notice);
      clearP2pRoute();
      expectedRouteDistance = null;
      expectedRouteDuration = null;
      updateP2pMetrics(metricsElement);
    })
    .catch((error) => {
      p2pError.textContent = error.message;
      p2pError.classList.remove('is-hidden');
      button.disabled = false;
      button.classList.remove('is-loading');
      if (resumeAfterFailure) {
        resumeTracking(points, metricsElement);
      }
    });
}

function loadP2pMission() {
  if (!p2pMissionId || !p2pRunId) {
    p2pContainer.innerHTML = '';
    p2pError.textContent = 'Parâmetros da missão ausentes.';
    p2pError.classList.remove('is-hidden');
    return;
  }
  const query = new URLSearchParams({ mission_id: p2pMissionId, run_id: p2pRunId });
  window
    .apiFetch(`mission_detail.php?${query.toString()}`)
    .then((detail) => {
      const tipo = (detail.mission.tipo || '').toUpperCase();
      if (!['P2P', 'P2P_GRUPO'].includes(tipo)) {
        throw new Error('Esta missão não é do tipo ponto a ponto.');
      }
      p2pDetail = detail;
      renderP2p();
    })
    .catch((error) => {
      p2pContainer.innerHTML = '';
      p2pError.textContent = error.message;
      p2pError.classList.remove('is-hidden');
    });
}

loadP2pMission();
