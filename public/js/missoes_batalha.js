// File: public/js/missoes_batalha.js
const missionsListElement = document.getElementById('missions-list');
const missionTypeFilter = document.getElementById('mission-type-filter');
const workspaceRoot = document.getElementById('mission-workspace');
const workspaceTitle = document.getElementById('mission-workspace-title');
const workspaceContent = document.getElementById('mission-workspace-content');
const workspaceStatus = document.getElementById('mission-workspace-status');

const missionWorkspace = {
  show(mission, runId, builder) {
    if (!workspaceRoot) {
      return;
    }
    workspaceRoot.classList.remove('is-hidden');
    if (workspaceTitle) {
      workspaceTitle.textContent = `${mission.name} (#${runId})`;
    }
    if (workspaceContent) {
      workspaceContent.innerHTML = '';
      if (typeof builder === 'function') {
        builder(workspaceContent, runId);
      }
    }
    if (workspaceStatus) {
      workspaceStatus.textContent = '';
      workspaceStatus.classList.remove('has-text-danger');
    }
  },
  clear() {
    if (!workspaceRoot) {
      return;
    }
    workspaceRoot.classList.add('is-hidden');
    if (workspaceContent) {
      workspaceContent.innerHTML = '';
    }
    if (workspaceStatus) {
      workspaceStatus.textContent = '';
      workspaceStatus.classList.remove('has-text-danger');
    }
  },
  setStatus(message, isError = false) {
    if (!workspaceStatus) {
      return;
    }
    workspaceStatus.textContent = message;
    workspaceStatus.classList.toggle('has-text-danger', Boolean(isError));
  },
};

window.missionWorkspace = missionWorkspace;

window.missionHandlers = window.missionHandlers || {};
const battleStates = {};

window.missionHandlers.BATALHA = {
  render(mission, runId) {
    battleStates[runId] = battleStates[runId] || { log: [] };
    missionWorkspace.show(mission, runId, (container) => {
      const description = document.createElement('p');
      description.className = 'mb-3';
      description.textContent = 'Registre as ações do turno para acompanhar o progresso da batalha. Use o botão Finalizar quando a luta terminar.';
      container.appendChild(description);

      const quickActions = document.createElement('div');
      quickActions.className = 'workspace-actions';
      const quickButtons = [
        { label: 'Ataque', text: 'Ataque executado.' },
        { label: 'Defender', text: 'Defesa ativada.' },
        { label: 'Usar módulo', text: 'Módulo utilizado.' },
      ];
      quickButtons.forEach((action) => {
        const btn = document.createElement('button');
        btn.className = 'button is-small is-link';
        btn.type = 'button';
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
          appendLogEntry(runId, action.text);
        });
        quickActions.appendChild(btn);
      });
      container.appendChild(quickActions);

      const noteField = document.createElement('div');
      noteField.className = 'field';
      const noteControl = document.createElement('div');
      noteControl.className = 'control';
      const noteInput = document.createElement('textarea');
      noteInput.className = 'textarea';
      noteInput.rows = 3;
      noteInput.placeholder = 'Escreva um resumo do turno...';
      noteControl.appendChild(noteInput);
      noteField.appendChild(noteControl);
      container.appendChild(noteField);

      const noteActions = document.createElement('div');
      noteActions.className = 'workspace-actions';
      const addNoteBtn = document.createElement('button');
      addNoteBtn.className = 'button is-small is-primary';
      addNoteBtn.type = 'button';
      addNoteBtn.textContent = 'Adicionar ao log';
      addNoteBtn.addEventListener('click', () => {
        if (noteInput.value.trim() !== '') {
          appendLogEntry(runId, noteInput.value.trim());
          noteInput.value = '';
        }
      });
      const clearBtn = document.createElement('button');
      clearBtn.className = 'button is-small is-light';
      clearBtn.type = 'button';
      clearBtn.textContent = 'Limpar log';
      clearBtn.addEventListener('click', () => {
        battleStates[runId].log = [];
        renderBattleLog(runId);
      });
      noteActions.appendChild(addNoteBtn);
      noteActions.appendChild(clearBtn);
      container.appendChild(noteActions);

      const logTitle = document.createElement('h3');
      logTitle.className = 'title is-6';
      logTitle.textContent = 'Turnos registrados';
      container.appendChild(logTitle);

      const logList = document.createElement('ul');
      logList.id = `battle-log-${runId}`;
      logList.className = 'battle-log';
      container.appendChild(logList);
      renderBattleLog(runId);
    });
  },
  async onFinish(mission, runId) {
    const state = battleStates[runId];
    if (state && state.log && state.log.length) {
      return { battle_log: state.log };
    }
    return {};
  },
};

function appendLogEntry(runId, text) {
  battleStates[runId] = battleStates[runId] || { log: [] };
  battleStates[runId].log.push({
    text,
    at: new Date().toISOString(),
  });
  renderBattleLog(runId);
}

function renderBattleLog(runId) {
  const list = document.getElementById(`battle-log-${runId}`);
  if (!list) return;
  const state = battleStates[runId] || { log: [] };
  list.innerHTML = '';
  if (!state.log.length) {
    const empty = document.createElement('li');
    empty.className = 'battle-log-empty';
    empty.textContent = 'Nenhuma ação registrada ainda.';
    list.appendChild(empty);
    return;
  }
  state.log.forEach((entry, index) => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>Turno ${index + 1}:</strong> ${entry.text} <span class="battle-log-time">${new Date(entry.at).toLocaleTimeString()}</span>`;
    list.appendChild(item);
  });
}

function renderMission(mission) {
  const li = document.createElement('li');
  li.className = 'box mission-entry mission-entry--interactive';
  const iconUrl = mission.icon_url || (window.APP_CONFIG && window.APP_CONFIG.default_mission_icon);
  const icon = document.createElement('img');
  icon.className = 'mission-entry-icon';
  icon.src = iconUrl;
  icon.alt = mission.tipo;
  li.appendChild(icon);
  const info = document.createElement('div');
  info.className = 'mission-entry-body';
  info.innerHTML = `
    <strong>${mission.name}</strong>
    <span class="mission-entry-meta">${mission.tipo} · ${(mission.distance_m / 1000).toFixed(2)} km</span>
  `;
  const showBtn = document.createElement('a');
  showBtn.className = 'button is-info is-small';
  const missionUrl = (window.EcobotsBase && typeof window.EcobotsBase.toHtml === 'function')
    ? window.EcobotsBase.toHtml(`missao.html?mission_id=${encodeURIComponent(mission.id)}`)
    : `missao.html?mission_id=${encodeURIComponent(mission.id)}`;
  showBtn.href = missionUrl;
  showBtn.textContent = 'Mostrar missão';
  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  buttons.appendChild(showBtn);
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

if (missionTypeFilter) {
  missionTypeFilter.addEventListener('change', loadMissions);
}

loadMissions();
