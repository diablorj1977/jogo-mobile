// File: public/js/missao_batalha.js
const battleContainer = document.getElementById('battle-container');
const battleError = document.getElementById('battle-error');
const baseHelpersBattle = window.EcobotsBase || {};
const battleParams = new URLSearchParams(window.location.search);
const battleMissionId = parseInt(battleParams.get('mission_id') || '', 10);
const battleRunId = parseInt(battleParams.get('run_id') || '', 10);
let battleDetail = null;
let battleInventory = null;
let battleLog = [];

function toHtml(path) {
  if (typeof baseHelpersBattle.toHtml === 'function') {
    return baseHelpersBattle.toHtml(path);
  }
  return path;
}

function describeDamageRange(item) {
  const min = item?.weapon?.dmg_min;
  const max = item?.weapon?.dmg_max;
  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    return `${min}–${max}`;
  }
  return '—';
}

function describeModuleEffect(item) {
  const mod = item?.module || {};
  const { module_kind: kind, module_value: value, module_duration: duration } = mod;
  if (!kind) {
    return 'Efeito instantâneo';
  }
  const durationLabel = duration ? `${duration} uso(s)` : '1 uso';
  switch (kind) {
    case 'HEAL':
      return `Recupera ${value} HP (${durationLabel})`;
    case 'SHIELD':
      return `Escudo de ${value} (${durationLabel})`;
    case 'BUFF_ATK':
      return `Aumenta ATK em ${value}% (${durationLabel})`;
    case 'BUFF_DEF':
      return `Aumenta DEF em ${value}% (${durationLabel})`;
    case 'CLEANSE':
      return `Remove efeitos negativos (${durationLabel})`;
    case 'ENERGIZE':
      return `Recupera ${value} energia (${durationLabel})`;
    default:
      return `Módulo ${kind} (${durationLabel})`;
  }
}

function appendBattleLog(entry) {
  battleLog.push({ text: entry, at: new Date().toISOString() });
  const logList = document.getElementById('battle-log');
  if (!logList) return;
  logList.innerHTML = '';
  battleLog.slice().reverse().forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>Turno ${battleLog.length - index}:</strong> ${item.text}<br><small>${new Date(item.at).toLocaleTimeString()}</small>`;
    logList.appendChild(li);
  });
}

function buildStatsSection() {
  const statsSection = document.createElement('div');
  statsSection.className = 'mission-section';
  const title = document.createElement('h2');
  title.className = 'title is-5';
  title.textContent = 'Estatísticas do Ecobot';
  statsSection.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'mission-stats-grid';
  const stats = battleInventory.ecobot.total_stats;
  Object.keys(stats).forEach((key) => {
    const card = document.createElement('div');
    card.className = 'mission-stat-card';
    card.innerHTML = `<strong>${key.toUpperCase()}</strong><span>${stats[key]}</span>`;
    grid.appendChild(card);
  });
  statsSection.appendChild(grid);

  const resistances = document.createElement('div');
  resistances.className = 'mission-resistances';
  Object.entries(battleInventory.ecobot.resistances).forEach(([type, value]) => {
    const span = document.createElement('span');
    span.textContent = `${type.toUpperCase()}: ${value.toFixed(2)}x`;
    resistances.appendChild(span);
  });
  statsSection.appendChild(resistances);

  return statsSection;
}

function createActionCard(config) {
  const card = document.createElement('div');
  card.className = 'mission-action-card';
  const title = document.createElement('h3');
  title.textContent = config.title;
  card.appendChild(title);
  if (config.subtitle) {
    const subtitle = document.createElement('p');
    subtitle.textContent = config.subtitle;
    card.appendChild(subtitle);
  }
  if (config.meta) {
    const meta = document.createElement('p');
    meta.textContent = config.meta;
    card.appendChild(meta);
  }
  const footer = document.createElement('footer');
  const button = document.createElement('button');
  button.className = 'button is-link is-small';
  button.type = 'button';
  button.textContent = config.buttonLabel || 'Executar';
  if (config.disabled) {
    button.disabled = true;
  }
  button.addEventListener('click', () => {
    if (config.onExecute) {
      config.onExecute(button);
    }
  });
  footer.appendChild(button);
  if (config.footerText) {
    const span = document.createElement('span');
    span.className = 'mission-module-uses';
    span.textContent = config.footerText;
    footer.appendChild(span);
  }
  card.appendChild(footer);
  return card;
}

function equipActions() {
  const grid = document.createElement('div');
  grid.className = 'mission-action-grid';

  const basic = battleInventory.ecobot.basic_attack || window.APP_CONFIG?.ecobot_basic_attack;
  if (basic) {
    grid.appendChild(
      createActionCard({
        title: basic.name || 'Ataque básico',
        subtitle: basic.description || 'Golpe padrão do Ecobot',
        meta: `Dano ${basic.dmg_min || '?'}–${basic.dmg_max || '?'} (${basic.dmg_type || 'KINETIC'})`,
        onExecute: () => {
          appendBattleLog(`Ataque básico aplicado (${basic.dmg_min || '?'}–${basic.dmg_max || '?'})`);
        },
      })
    );
  }

  const equipped = battleInventory.equipped;
  Object.entries(equipped)
    .filter(([slot]) => slot.startsWith('wpn'))
    .forEach(([, inventoryId]) => {
      const item = battleInventory.items.find((it) => it.id === inventoryId);
      if (!item) return;
      grid.appendChild(
        createActionCard({
          title: item.name,
          subtitle: `${item.weapon?.dmg_type || 'KINETIC'} · Precisão ${item.weapon?.accuracy || 0}%`,
          meta: `Dano ${describeDamageRange(item)} · Custo ${item.weapon?.energy_cost ?? 0}`,
          onExecute: () => {
            appendBattleLog(`Ataque com ${item.name} (${describeDamageRange(item)})`);
          },
        })
      );
    });

  const moduleCards = [];
  Object.entries(equipped)
    .filter(([slot]) => slot.startsWith('mod'))
    .forEach(([, inventoryId]) => {
      const item = battleInventory.items.find((it) => it.id === inventoryId);
      if (!item) return;
      const totalUses = item.module?.module_duration && item.module.module_duration > 0 ? item.module.module_duration : 1;
      const config = {
        title: item.name,
        subtitle: describeModuleEffect(item),
        meta: `Tipo ${item.module?.module_kind || 'SUPORTE'}`,
        buttonLabel: 'Usar módulo',
        footerText: `Usos restantes: ${totalUses}`,
        usesLeft: totalUses,
      };
      config.onExecute = (button) => {
        if (config.usesLeft <= 0) {
          button.disabled = true;
          return;
        }
        config.usesLeft -= 1;
        appendBattleLog(`Módulo ${item.name} ativado (${describeModuleEffect(item)})`);
        if (config.usesLeft <= 0) {
          button.disabled = true;
          config.footerText = 'Esgotado';
        } else {
          config.footerText = `Usos restantes: ${config.usesLeft}`;
        }
        button.parentElement.querySelector('.mission-module-uses').textContent = config.footerText;
      };
      moduleCards.push(createActionCard(config));
    });
  moduleCards.forEach((card) => grid.appendChild(card));

  return grid;
}

function renderBattle() {
  battleContainer.innerHTML = '';
  battleError.classList.add('is-hidden');

  const header = document.createElement('div');
  header.className = 'mission-detail-header';
  const title = document.createElement('h1');
  title.className = 'title is-3';
  title.textContent = battleDetail.mission.name;
  header.appendChild(title);
  if (battleDetail.mission.image_url) {
    const img = document.createElement('img');
    img.className = 'mission-detail-image';
    img.src = battleDetail.mission.image_url;
    img.alt = `Inimigo da missão ${battleDetail.mission.name}`;
    header.appendChild(img);
  }
  battleContainer.appendChild(header);

  battleContainer.appendChild(buildStatsSection());

  const actionsSection = document.createElement('div');
  actionsSection.className = 'mission-section';
  const actionsTitle = document.createElement('h2');
  actionsTitle.className = 'title is-5';
  actionsTitle.textContent = 'Ações disponíveis';
  actionsSection.appendChild(actionsTitle);
  actionsSection.appendChild(equipActions());
  battleContainer.appendChild(actionsSection);

  const logSection = document.createElement('div');
  logSection.className = 'mission-section';
  const logTitle = document.createElement('h2');
  logTitle.className = 'title is-5';
  logTitle.textContent = 'Registro de turnos';
  logSection.appendChild(logTitle);
  const logList = document.createElement('ul');
  logList.id = 'battle-log';
  logList.className = 'mission-log';
  logSection.appendChild(logList);
  battleContainer.appendChild(logSection);

  const actionBar = document.createElement('div');
  actionBar.className = 'mission-start-actions';
  const finishButton = document.createElement('button');
  finishButton.className = 'button is-success';
  finishButton.textContent = 'Encerrar batalha (vitória)';
  finishButton.addEventListener('click', () => finalizeBattle(finishButton));
  actionBar.appendChild(finishButton);

  const abortButton = document.createElement('button');
  abortButton.className = 'button is-danger is-light';
  abortButton.type = 'button';
  abortButton.textContent = 'Abortar missão';
  abortButton.addEventListener('click', () => abortBattle(abortButton, finishButton));
  actionBar.appendChild(abortButton);

  const cancelButton = document.createElement('a');
  cancelButton.className = 'button is-light';
  cancelButton.href = toHtml(`missao.html?mission_id=${encodeURIComponent(battleMissionId)}`);
  cancelButton.textContent = 'Voltar à missão';
  actionBar.appendChild(cancelButton);

  battleContainer.appendChild(actionBar);
}

function finalizeBattle(button) {
  button.disabled = true;
  button.classList.add('is-loading');
  window
    .apiFetch('mission_finish.php', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: battleMissionId,
        run_id: battleRunId,
      }),
    })
    .then(() => {
      button.classList.remove('is-loading');
      button.textContent = 'Missão concluída!';
      button.classList.add('is-static');
      appendBattleLog('Batalha concluída com sucesso.');
    })
    .catch((error) => {
      battleError.textContent = error.message;
      battleError.classList.remove('is-hidden');
      button.disabled = false;
      button.classList.remove('is-loading');
    });
}

function abortBattle(button, finishButton) {
  if (!window.confirm('Deseja realmente abortar esta missão de batalha?')) {
    return;
  }
  button.disabled = true;
  button.classList.add('is-loading');
  window
    .apiFetch('mission_abort.php', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: battleMissionId,
        run_id: battleRunId,
      }),
    })
    .then(() => {
      button.classList.remove('is-loading');
      button.textContent = 'Missão abortada';
      button.classList.add('is-static');
      if (finishButton) {
        finishButton.disabled = true;
        finishButton.classList.add('is-static');
        finishButton.textContent = 'Finalização indisponível';
      }
      appendBattleLog('Missão abortada pelo jogador.');
    })
    .catch((error) => {
      battleError.textContent = error.message;
      battleError.classList.remove('is-hidden');
      button.disabled = false;
      button.classList.remove('is-loading');
    });
}

function loadBattle() {
  if (!battleMissionId || !battleRunId) {
    battleContainer.innerHTML = '';
    battleError.textContent = 'Parâmetros da missão ausentes.';
    battleError.classList.remove('is-hidden');
    return;
  }

  const query = new URLSearchParams({ mission_id: battleMissionId, run_id: battleRunId });
  window
    .apiFetch(`mission_detail.php?${query.toString()}`)
    .then((detail) => {
      if ((detail.mission.tipo || '').toUpperCase().indexOf('BATALHA') !== 0) {
        throw new Error('Esta missão não é de batalha.');
      }
      battleDetail = detail;
      return window.apiFetch('inventory_list.php');
    })
    .then((inventory) => {
      battleInventory = inventory;
      renderBattle();
    })
    .catch((error) => {
      battleContainer.innerHTML = '';
      battleError.textContent = error.message;
      battleError.classList.remove('is-hidden');
    });
}

loadBattle();
