// File: public/js/missao.js
const missionContainer = document.getElementById('mission-container');
const missionError = document.getElementById('mission-error');
const baseHelpers = window.EcobotsBase || {};
const params = new URLSearchParams(window.location.search);
const missionId = parseInt(params.get('mission_id') || '', 10);
let latestDetail = null;
let currentPosition = null;

function toHtml(path) {
  if (typeof baseHelpers.toHtml === 'function') {
    return baseHelpers.toHtml(path);
  }
  return path;
}

function formatDistanceMeters(value) {
  if (value === null || value === undefined) {
    return 'localização pendente';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }
  return `${value.toFixed(1)} m`;
}

function renderPrerequisites(detail) {
  const { requirements } = detail;
  const list = document.createElement('ul');
  list.className = 'mission-prereq-list';

  const levelItem = document.createElement('li');
  levelItem.className = `mission-prereq-item ${requirements.level.met ? 'is-success' : 'is-danger'}`;
  const levelDesc = requirements.level.required
    ? `Nível mínimo ${requirements.level.required}`
    : 'Nível livre';
  levelItem.textContent = `${levelDesc} — seu nível atual: ${detail.player.level}`;
  list.appendChild(levelItem);

  if (requirements.carcass.required_codes.length) {
    const carcassItem = document.createElement('li');
    carcassItem.className = `mission-prereq-item ${requirements.carcass.met ? 'is-success' : 'is-danger'}`;
    const codes = requirements.carcass.required_codes.join(', ');
    const equipped = requirements.carcass.equipped || 'nenhuma';
    carcassItem.textContent = `Carcaça necessária: ${codes}. Equipada: ${equipped}`;
    list.appendChild(carcassItem);
  }

  const windowItem = document.createElement('li');
  windowItem.className = `mission-prereq-item ${requirements.window.active ? 'is-success' : 'is-danger'}`;
  if (requirements.window.start && requirements.window.end) {
    windowItem.textContent = `Disponível entre ${requirements.window.start} e ${requirements.window.end}`;
  } else {
    windowItem.textContent = 'Disponível a qualquer momento';
  }
  list.appendChild(windowItem);

  const distanceItem = document.createElement('li');
  distanceItem.className = `mission-prereq-item ${requirements.distance.met ? 'is-success' : 'is-danger'}`;
  const distanceText = formatDistanceMeters(requirements.distance.value_m);
  distanceItem.textContent = `Dentro do raio de início (${requirements.distance.limit_m} m): ${distanceText}`;
  list.appendChild(distanceItem);

  if (!requirements.ecobot.met) {
    const ecobotItem = document.createElement('li');
    ecobotItem.className = 'mission-prereq-item is-danger';
    ecobotItem.textContent = `Ecobot indisponível até ${requirements.ecobot.down_until}`;
    list.appendChild(ecobotItem);
  }

  return list;
}

function buildSummary(detail) {
  const { mission } = detail;
  const summary = document.createElement('div');
  summary.className = 'mission-summary-meta';
  const entries = [
    `${mission.tipo}`,
    `${mission.reward_xp} XP`,
    `Raio geográfico ${mission.raio_m} m`,
  ];
  if (mission.time_limit_s) {
    entries.push(`Tempo limite ${Math.round(mission.time_limit_s / 60)} min`);
  }
  entries.forEach((text) => {
    const span = document.createElement('span');
    span.textContent = text;
    summary.appendChild(span);
  });
  return summary;
}

function missionTypePage(tipo) {
  const map = {
    BATALHA: 'missao_batalha.html',
    BATALHA_GRUPO: 'missao_batalha.html',
    FOTO: 'missao_foto.html',
    SCAN: 'missao_qr.html',
    CORRIDA: 'missao_corrida.html',
    P2P: 'missao_p2p.html',
    P2P_GRUPO: 'missao_p2p.html',
  };
  const key = (tipo || '').toUpperCase();
  return map[key] || 'missoes.html';
}

function renderTypeSections(detail) {
  const sections = [];
  const { mission, type_data: typeData } = detail;

  if (mission.description) {
    const descSection = document.createElement('div');
    descSection.className = 'mission-section';
    const title = document.createElement('h2');
    title.className = 'title is-5';
    title.textContent = 'Descrição';
    descSection.appendChild(title);
    const p = document.createElement('p');
    p.textContent = mission.description;
    descSection.appendChild(p);
    sections.push(descSection);
  }

  if (mission.tipo && mission.tipo.toUpperCase() === 'FOTO' && typeData.photo_mural && typeData.photo_mural.length) {
    const muralSection = document.createElement('div');
    muralSection.className = 'mission-section';
    const title = document.createElement('h2');
    title.className = 'title is-5';
    title.textContent = 'Mural da missão';
    muralSection.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'photo-mural';
    typeData.photo_mural.slice(0, 6).forEach((photo) => {
      const figure = document.createElement('figure');
      figure.className = 'photo-mural-item';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = 'Registro da missão';
      figure.appendChild(img);
      grid.appendChild(figure);
    });
    muralSection.appendChild(grid);
    sections.push(muralSection);
  }

  if (['CORRIDA', 'P2P', 'P2P_GRUPO'].includes((mission.tipo || '').toUpperCase()) && typeData.points) {
    const pointsSection = document.createElement('div');
    pointsSection.className = 'mission-section';
    const title = document.createElement('h2');
    title.className = 'title is-5';
    title.textContent = 'Pontos da missão';
    pointsSection.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'mission-points-list';
    typeData.points.forEach((point) => {
      const item = document.createElement('li');
      item.textContent = `Seq ${point.seq}: (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}) · raio ${point.raio_m} m`;
      list.appendChild(item);
    });
    pointsSection.appendChild(list);
    sections.push(pointsSection);
  }

  if ((mission.tipo || '').toUpperCase() === 'SCAN' && typeData.qr_hint) {
    const qrSection = document.createElement('div');
    qrSection.className = 'mission-section';
    const title = document.createElement('h2');
    title.className = 'title is-5';
    title.textContent = 'Dica do código';
    qrSection.appendChild(title);
    const p = document.createElement('p');
    p.textContent = typeData.qr_hint;
    qrSection.appendChild(p);
    sections.push(qrSection);
  }

  return sections;
}

function renderMission(detail) {
  latestDetail = detail;
  missionContainer.innerHTML = '';
  missionError.classList.add('is-hidden');

  const header = document.createElement('div');
  header.className = 'mission-detail-header';

  const icon = document.createElement('img');
  icon.className = 'mission-detail-icon';
  icon.src = detail.mission.icon_url || (window.APP_CONFIG && window.APP_CONFIG.default_mission_icon) || '';
  icon.alt = detail.mission.tipo || 'Missão';
  header.appendChild(icon);

  const titleBlock = document.createElement('div');
  const title = document.createElement('h1');
  title.className = 'title is-3';
  title.textContent = detail.mission.name;
  titleBlock.appendChild(title);
  titleBlock.appendChild(buildSummary(detail));
  header.appendChild(titleBlock);

  if (detail.mission.image_url) {
    const image = document.createElement('img');
    image.className = 'mission-detail-image';
    image.src = detail.mission.image_url;
    image.alt = `Imagem da missão ${detail.mission.name}`;
    header.appendChild(image);
  }

  missionContainer.appendChild(header);

  const prereqCard = document.createElement('div');
  prereqCard.className = 'mission-section';
  const prereqTitle = document.createElement('h2');
  prereqTitle.className = 'title is-5';
  prereqTitle.textContent = 'Pré-requisitos';
  prereqCard.appendChild(prereqTitle);
  prereqCard.appendChild(renderPrerequisites(detail));
  missionContainer.appendChild(prereqCard);

  renderTypeSections(detail).forEach((section) => {
    missionContainer.appendChild(section);
  });

  const actionBar = document.createElement('div');
  actionBar.className = 'mission-start-actions';
  const startButton = document.createElement('button');
  startButton.className = 'button is-primary';
  startButton.textContent = 'Iniciar missão';
  startButton.disabled = !detail.can_start;
  actionBar.appendChild(startButton);

  const refreshButton = document.createElement('button');
  refreshButton.className = 'button is-link is-light';
  refreshButton.type = 'button';
  refreshButton.textContent = 'Atualizar localização';
  refreshButton.addEventListener('click', requestLocationRefresh);
  actionBar.appendChild(refreshButton);

  const cancelLink = document.createElement('a');
  cancelLink.className = 'button is-light';
  cancelLink.href = toHtml('home.html');
  cancelLink.textContent = 'Voltar';
  actionBar.appendChild(cancelLink);

  missionContainer.appendChild(actionBar);

  startButton.addEventListener('click', () => {
    startButton.disabled = true;
    startButton.classList.add('is-loading');
    requestStart(detail.mission.id, startButton);
  });
}

function requestStart(missionIdValue, startButton) {
  if (!navigator.geolocation) {
    missionError.textContent = 'Geolocalização indisponível no dispositivo.';
    missionError.classList.remove('is-hidden');
    startButton.classList.remove('is-loading');
    startButton.disabled = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const payload = {
        mission_id: missionIdValue,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      window
        .apiFetch('mission_start.php', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        .then((response) => {
          const targetPage = missionTypePage(latestDetail?.mission?.tipo);
          const url = `${targetPage}?mission_id=${encodeURIComponent(missionIdValue)}&run_id=${encodeURIComponent(response.run_id)}`;
          window.location.href = toHtml(url);
        })
        .catch((error) => {
          missionError.textContent = error.message;
          missionError.classList.remove('is-hidden');
          startButton.classList.remove('is-loading');
          startButton.disabled = false;
        });
    },
    () => {
      missionError.textContent = 'Não foi possível obter a localização atual.';
      missionError.classList.remove('is-hidden');
      startButton.classList.remove('is-loading');
      startButton.disabled = false;
    }
  );
}

function requestLocationRefresh() {
  if (!navigator.geolocation) {
    missionError.textContent = 'Geolocalização indisponível no dispositivo.';
    missionError.classList.remove('is-hidden');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentPosition = position;
      loadMission();
    },
    () => {
      missionError.textContent = 'Não foi possível obter a localização atual.';
      missionError.classList.remove('is-hidden');
    }
  );
}

function loadMission() {
  if (!missionId) {
    missionContainer.innerHTML = '';
    missionError.textContent = 'Missão não informada.';
    missionError.classList.remove('is-hidden');
    return;
  }

  const query = new URLSearchParams({ mission_id: missionId });
  if (currentPosition) {
    query.set('lat', currentPosition.coords.latitude);
    query.set('lng', currentPosition.coords.longitude);
  }
  window
    .apiFetch(`mission_detail.php?${query.toString()}`)
    .then((detail) => {
      renderMission(detail);
    })
    .catch((error) => {
      missionContainer.innerHTML = '';
      missionError.textContent = error.message;
      missionError.classList.remove('is-hidden');
    });
}

if (missionId) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        currentPosition = position;
        loadMission();
      },
      () => {
        loadMission();
      }
    );
  } else {
    loadMission();
  }
} else {
  missionContainer.innerHTML = '';
  missionError.textContent = 'Identificador da missão ausente.';
  missionError.classList.remove('is-hidden');
}
