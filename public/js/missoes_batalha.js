// File: public/js/missoes_batalha.js
const missionsListElement = document.getElementById('missions-list');
const missionTypeFilter = document.getElementById('mission-type-filter');
const missionState = {};

window.missionHandlers = window.missionHandlers || {};

function renderMission(mission) {
  const li = document.createElement('li');
  li.className = 'box';
  const info = document.createElement('div');
  info.innerHTML = `<strong>${mission.name}</strong><br>Tipo: ${mission.tipo} — ${(mission.distance_m / 1000).toFixed(2)} km`;
  const startBtn = document.createElement('button');
  startBtn.className = 'button is-link is-small mr-2';
  startBtn.textContent = 'Iniciar';
  startBtn.addEventListener('click', () => startMission(mission, li));
  const finishBtn = document.createElement('button');
  finishBtn.className = 'button is-primary is-small';
  finishBtn.textContent = 'Finalizar';
  finishBtn.addEventListener('click', () => finishMission(mission, li));
  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  buttons.appendChild(startBtn);
  buttons.appendChild(finishBtn);
  li.appendChild(info);
  li.appendChild(buttons);
  return li;
}

function getFilter() {
  return missionTypeFilter ? missionTypeFilter.value : '';
}

async function loadMissions() {
  if (!navigator.geolocation) {
    missionsListElement.innerHTML = '<li>Geolocalização não disponível.</li>';
    return;
  }
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    try {
      const data = await window.apiFetch(`missions_list.php?lat=${latitude}&lng=${longitude}&km=10`);
      missionsListElement.innerHTML = '';
      const filter = getFilter();
      data.missions
        .filter((mission) => !filter || mission.tipo === filter)
        .forEach((mission) => {
          missionsListElement.appendChild(renderMission(mission));
        });
    } catch (error) {
      missionsListElement.innerHTML = `<li>${error.message}</li>`;
    }
  });
}

function startMission(mission, element) {
  if (!navigator.geolocation) {
    element.append(' Precisa de localização.');
    return;
  }
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const payload = {
        mission_id: mission.id,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const data = await window.apiFetch('mission_start.php', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      missionState[mission.id] = data.run_id;
      element.dataset.runId = data.run_id;
      element.append(` \u2714️ Missão iniciada (run #${data.run_id})`);
      if (window.missionHandlers[mission.tipo] && window.missionHandlers[mission.tipo].onStart) {
        window.missionHandlers[mission.tipo].onStart(mission, data.run_id);
      }
    } catch (error) {
      element.append(` \u274c ${error.message}`);
    }
  });
}

async function finishMission(mission, element) {
  const runId = missionState[mission.id] || element.dataset.runId;
  if (!runId) {
    element.append(' Inicie a missão primeiro.');
    return;
  }
  const handler = window.missionHandlers[mission.tipo];
  let payload = { mission_id: mission.id, run_id: runId };
  if (handler && handler.onFinish) {
    try {
      payload = Object.assign(payload, await handler.onFinish(mission, runId));
    } catch (error) {
      element.append(` ${error.message}`);
      return;
    }
  }
  try {
    const data = await window.apiFetch('mission_finish.php', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    element.append(` Finalizada! (+ run ${data.run_id})`);
  } catch (error) {
    element.append(` ${error.message}`);
  }
}

if (missionTypeFilter) {
  missionTypeFilter.addEventListener('change', loadMissions);
}

loadMissions();
