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
let battleState = {
  enemy: null,
  player: null,
  turn: 0,
  ended: false,
};
let battleActionButtons = [];
let enemyHpFill = null;
let enemyHpLabel = null;
let playerHpFill = null;
let playerHpLabel = null;

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

function numberOrFallback(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function appendBattleLog(entry) {
  const normalised = typeof entry === 'string' ? { message: entry } : Object.assign({}, entry);
  normalised.at = normalised.at || new Date().toISOString();
  if (typeof normalised.turn !== 'number') {
    normalised.turn = battleState.turn;
  }
  normalised.actor = normalised.actor || 'SISTEMA';
  normalised.detail = normalised.detail || '';
  battleLog.push(normalised);
  renderBattleLog();
}

function renderBattleLog() {
  const logList = document.getElementById('battle-log');
  if (!logList) {
    return;
  }
  logList.innerHTML = '';
  if (!battleLog.length) {
    const empty = document.createElement('li');
    empty.className = 'battle-log-empty';
    empty.textContent = 'Nenhum turno registrado ainda.';
    logList.appendChild(empty);
    return;
  }

  const reversed = battleLog.slice().reverse();
  reversed.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'battle-log-entry';
    const code = document.createElement('code');
    const turnLabel = String(entry.turn || 0).padStart(2, '0');
    code.innerHTML = `<span><strong>[T${turnLabel}] ${entry.actor}</strong> :: ${entry.message}</span><span>${new Date(entry.at).toLocaleTimeString()}</span>`;
    li.appendChild(code);
    if (entry.detail) {
      const detail = document.createElement('span');
      detail.className = 'battle-log-metadata';
      detail.textContent = entry.detail;
      li.appendChild(detail);
    }
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
  battleActionButtons.push(button);
  return card;
}

function initialiseBattleState() {
  const enemyData = battleDetail?.type_data?.battle?.enemy || {};
  const enemyMax = Math.max(numberOrFallback(enemyData.hp_max, numberOrFallback(enemyData.hp_current, 100)), 1);
  const enemyCurrent = Math.max(0, numberOrFallback(enemyData.hp_current, enemyMax));
  const rawMoves = Array.isArray(enemyData.moves) && enemyData.moves.length ? enemyData.moves : [];
  const moves = rawMoves.length
    ? rawMoves.map((move) => ({
        name: move.name || 'Ataque',
        dmg_min: numberOrFallback(move.dmg_min ?? move.min, 5),
        dmg_max: numberOrFallback(move.dmg_max ?? move.max, numberOrFallback(move.dmg_min ?? move.min, 8)),
        dmg_type: move.dmg_type || move.type || 'KINETIC',
        accuracy: numberOrFallback(move.accuracy ?? move.acc, 85),
        weight: numberOrFallback(move.weight ?? move.w, 1),
      }))
    : [
        {
          name: 'Investida',
          dmg_min: 5,
          dmg_max: 12,
          dmg_type: 'KINETIC',
          accuracy: 85,
          weight: 1,
        },
      ];

  const stats = battleInventory?.ecobot?.total_stats || {};
  const baseline = battleInventory?.ecobot?.baseline_stats || {};
  const playerMax = Math.max(numberOrFallback(stats.hp, numberOrFallback(baseline.hp, 120)), 1);

  battleState = {
    enemy: {
      name: enemyData.name || 'Inimigo desconhecido',
      level: enemyData.level || null,
      maxHp: enemyMax,
      hp: enemyCurrent,
      moves,
    },
    player: {
      name: battleInventory?.ecobot?.nickname || battleDetail?.player?.nickname || 'Ecobot',
      maxHp: playerMax,
      hp: playerMax,
    },
    turn: 0,
    ended: false,
  };

  battleLog = [];
  battleActionButtons = [];
}

function updateBattleHud() {
  if (battleState.enemy) {
    const percentEnemy = Math.max(0, Math.min(100, (battleState.enemy.hp / battleState.enemy.maxHp) * 100));
    if (enemyHpFill) {
      enemyHpFill.style.width = `${percentEnemy}%`;
    }
    if (enemyHpLabel) {
      enemyHpLabel.textContent = `HP ${battleState.enemy.hp}/${battleState.enemy.maxHp}`;
    }
  }
  if (battleState.player) {
    const percentPlayer = Math.max(0, Math.min(100, (battleState.player.hp / battleState.player.maxHp) * 100));
    if (playerHpFill) {
      playerHpFill.style.width = `${percentPlayer}%`;
    }
    if (playerHpLabel) {
      playerHpLabel.textContent = `HP ${battleState.player.hp}/${battleState.player.maxHp}`;
    }
  }
}

function disableBattleActions() {
  battleActionButtons.forEach((button) => {
    button.disabled = true;
    button.classList.add('is-static');
  });
}

function rollDamage(min, max) {
  const lower = Math.max(0, Math.floor(numberOrFallback(min, 0)));
  const upperCandidate = Math.max(0, Math.floor(numberOrFallback(max, lower)));
  const upper = upperCandidate >= lower ? upperCandidate : lower;
  const span = upper - lower + 1;
  return lower + Math.floor(Math.random() * span);
}

function selectEnemyMove(moves) {
  if (!Array.isArray(moves) || !moves.length) {
    return null;
  }
  const weights = moves.map((move) => Math.max(1, numberOrFallback(move.weight, 1)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = Math.random() * totalWeight;
  for (let index = 0; index < moves.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return moves[index];
    }
  }
  return moves[moves.length - 1];
}

function performEnemyTurn(turn) {
  if (battleState.ended) {
    return;
  }
  const move = selectEnemyMove(battleState.enemy?.moves);
  if (!move) {
    return;
  }
  const accuracy = numberOrFallback(move.accuracy, 85);
  const roll = rollDamage(move.dmg_min, move.dmg_max);
  const hit = Math.random() * 100 <= accuracy;
  if (hit) {
    battleState.player.hp = Math.max(0, battleState.player.hp - roll);
  }
  appendBattleLog({
    turn,
    actor: battleState.enemy?.name || 'Inimigo',
    message: `${move.name || 'Ataque'} ${hit ? 'acertou' : 'errou'}${hit ? ` :: ${roll} ${move.dmg_type || 'DMG'}` : ''}`,
    detail: `HP Ecobot ${battleState.player.hp}/${battleState.player.maxHp}`,
  });
  updateBattleHud();
  if (battleState.player.hp <= 0) {
    battleState.ended = true;
    disableBattleActions();
    appendBattleLog({
      turn,
      actor: 'SISTEMA',
      message: 'Ecobot ficou sem energia! Considere abortar ou finalizar a missão.',
    });
  }
}

function performPlayerAction(action) {
  if (battleState.ended) {
    return;
  }
  battleState.turn += 1;
  const turn = battleState.turn;
  const accuracy = numberOrFallback(action.accuracy, 100);
  const roll = rollDamage(action.min, action.max);
  const hit = Math.random() * 100 <= accuracy;
  if (hit) {
    battleState.enemy.hp = Math.max(0, battleState.enemy.hp - roll);
  }
  appendBattleLog({
    turn,
    actor: 'ECOBOT',
    message: `${action.label || 'Ação'} ${hit ? 'acertou' : 'errou'}${hit ? ` :: ${roll} ${action.type || 'DMG'}` : ''}`,
    detail: `HP inimigo ${battleState.enemy.hp}/${battleState.enemy.maxHp}`,
  });
  updateBattleHud();
  if (battleState.enemy.hp <= 0) {
    battleState.ended = true;
    disableBattleActions();
    appendBattleLog({
      turn,
      actor: 'SISTEMA',
      message: 'Inimigo neutralizado! Finalize para encerrar a batalha.',
    });
    return;
  }
  performEnemyTurn(turn);
}

function performModuleAction(action) {
  if (battleState.ended) {
    return;
  }
  battleState.turn += 1;
  const turn = battleState.turn;
  const kind = (action.moduleKind || '').toUpperCase();
  let detail = '';
  let message = `${action.label || 'Módulo'} ativado`;
  if (kind === 'HEAL') {
    const before = battleState.player.hp;
    battleState.player.hp = Math.min(battleState.player.maxHp, battleState.player.hp + numberOrFallback(action.value, 0));
    const healed = battleState.player.hp - before;
    detail = `HP Ecobot ${battleState.player.hp}/${battleState.player.maxHp} (+${healed})`;
  } else if (kind === 'SHIELD') {
    detail = 'Escudo temporário ativado.';
  } else if (kind === 'BUFF_ATK') {
    detail = 'Ataque amplificado para os próximos turnos.';
  } else if (kind === 'BUFF_DEF') {
    detail = 'Defesa reforçada contra próximos golpes.';
  } else if (kind === 'ENERGIZE') {
    detail = 'Baterias recarregadas.';
  } else if (kind === 'CLEANSE') {
    detail = 'Status negativos removidos.';
  }

  appendBattleLog({
    turn,
    actor: 'ECOBOT',
    message: `${message}${kind ? ` (${kind})` : ''}`,
    detail: detail || `HP Ecobot ${battleState.player.hp}/${battleState.player.maxHp}`,
  });
  updateBattleHud();
  if (battleState.enemy.hp > 0) {
    performEnemyTurn(turn);
  }
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
          const min = numberOrFallback(basic.dmg_min, 4);
          const max = numberOrFallback(basic.dmg_max, min > 0 ? min : 8);
          const accuracy = numberOrFallback(basic.accuracy, 90);
          performPlayerAction({
            label: basic.name || 'Ataque básico',
            min,
            max,
            accuracy,
            type: basic.dmg_type || 'KINETIC',
          });
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
            const weaponMin = numberOrFallback(item.weapon?.dmg_min, numberOrFallback(item.weapon?.min, 6));
            const weaponMax = numberOrFallback(item.weapon?.dmg_max, weaponMin > 0 ? weaponMin : 12);
            const weaponAccuracy = numberOrFallback(item.weapon?.accuracy, 85);
            performPlayerAction({
              label: `Ataque com ${item.name}`,
              min: weaponMin,
              max: weaponMax,
              accuracy: weaponAccuracy,
              type: item.weapon?.dmg_type || item.weapon?.type || 'KINETIC',
            });
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
        performModuleAction({
          label: item.name,
          moduleKind: item.module?.module_kind,
          value: item.module?.module_value,
        });
        if (config.usesLeft <= 0) {
          button.disabled = true;
          config.footerText = 'Esgotado';
        } else {
          config.footerText = `Usos restantes: ${config.usesLeft}`;
        }
        const usesElement = button.parentElement.querySelector('.mission-module-uses');
        if (usesElement) {
          usesElement.textContent = config.footerText;
        }
      };
      moduleCards.push(createActionCard(config));
    });
  moduleCards.forEach((card) => grid.appendChild(card));

  return grid;
}

function renderBattle() {
  battleContainer.innerHTML = '';
  battleError.classList.add('is-hidden');
  battleActionButtons = [];
  enemyHpFill = null;
  enemyHpLabel = null;
  playerHpFill = null;
  playerHpLabel = null;

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

  const hud = document.createElement('div');
  hud.className = 'battle-hud';

  const enemyCard = document.createElement('div');
  enemyCard.className = 'battle-hud-card battle-hud-card--enemy';
  const enemyTitle = document.createElement('div');
  enemyTitle.className = 'battle-hud-title';
  enemyTitle.textContent = 'Inimigo';
  enemyCard.appendChild(enemyTitle);
  const enemyName = document.createElement('div');
  enemyName.className = 'battle-hud-value';
  enemyName.textContent = battleState.enemy?.name || 'Alvo desconhecido';
  enemyCard.appendChild(enemyName);
  const enemyLevel = document.createElement('div');
  enemyLevel.className = 'battle-hp-label';
  enemyLevel.textContent = battleState.enemy?.level ? `Nível ${battleState.enemy.level}` : 'Nível não informado';
  enemyCard.appendChild(enemyLevel);
  const enemyBar = document.createElement('div');
  enemyBar.className = 'battle-hp-bar';
  const enemyFill = document.createElement('span');
  enemyBar.appendChild(enemyFill);
  enemyHpFill = enemyFill;
  enemyCard.appendChild(enemyBar);
  const enemyHp = document.createElement('div');
  enemyHp.className = 'battle-hp-label';
  enemyHpLabel = enemyHp;
  enemyCard.appendChild(enemyHp);
  hud.appendChild(enemyCard);

  const playerCard = document.createElement('div');
  playerCard.className = 'battle-hud-card battle-hud-card--player';
  const playerTitle = document.createElement('div');
  playerTitle.className = 'battle-hud-title';
  playerTitle.textContent = 'Ecobot';
  playerCard.appendChild(playerTitle);
  const playerName = document.createElement('div');
  playerName.className = 'battle-hud-value';
  playerName.textContent = battleState.player?.name || 'Ecobot';
  playerCard.appendChild(playerName);
  const playerBar = document.createElement('div');
  playerBar.className = 'battle-hp-bar';
  const playerFill = document.createElement('span');
  playerBar.appendChild(playerFill);
  playerHpFill = playerFill;
  playerCard.appendChild(playerBar);
  const playerHp = document.createElement('div');
  playerHp.className = 'battle-hp-label';
  playerHpLabel = playerHp;
  playerCard.appendChild(playerHp);
  hud.appendChild(playerCard);

  battleContainer.appendChild(hud);

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
  logList.className = 'battle-log';
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
  updateBattleHud();
  renderBattleLog();
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
      initialiseBattleState();
      renderBattle();
      appendBattleLog({
        turn: 0,
        actor: 'SISTEMA',
        message: `Inimigo detectado: ${battleState.enemy?.name || 'Alvo desconhecido'}`,
        detail: `HP inimigo ${battleState.enemy?.hp}/${battleState.enemy?.maxHp}`,
      });
    })
    .catch((error) => {
      battleContainer.innerHTML = '';
      battleError.textContent = error.message;
      battleError.classList.remove('is-hidden');
    });
}

loadBattle();
