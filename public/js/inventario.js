// File: public/js/inventario.js
const inventoryList = document.getElementById('inventory-list');
const slotsContainer = document.getElementById('slots');
const ecobotStatsContainer = document.getElementById('ecobot-stats');

const defaultSlotConfig = {
  available_slots: ['carcass', 'wpn1', 'wpn2', 'mod1', 'mod2'],
  weapon_slots: 2,
  module_slots: 2,
};
let slotConfig = Object.assign({}, defaultSlotConfig);

function formatSlotLabel(slot) {
  if (slot === 'carcass') {
    return 'Carcaça';
  }
  if (/^wpn\d+$/i.test(slot)) {
    return `Slot de arma ${slot.replace(/[^0-9]/g, '')}`;
  }
  if (/^mod\d+$/i.test(slot)) {
    return `Slot de módulo ${slot.replace(/[^0-9]/g, '')}`;
  }
  return slot.toUpperCase();
}

function formatStatLabel(key) {
  const labels = {
    hp: 'HP',
    atk: 'ATK',
    def: 'DEF',
    speed: 'VEL',
    focus: 'FOC',
    energy: 'ENE',
  };
  return labels[key] || key.toUpperCase();
}

function buildStatsBadges(stats) {
  const fragment = document.createDocumentFragment();
  Object.entries(stats).forEach(([key, value]) => {
    if (value === null || value === 0) {
      return;
    }
    const span = document.createElement('span');
    span.textContent = `${formatStatLabel(key)} +${value}`;
    fragment.appendChild(span);
  });
  return fragment;
}

function buildResistanceBadges(resistances) {
  const fragment = document.createDocumentFragment();
  Object.entries(resistances).forEach(([key, value]) => {
    if (!value || Math.abs(value - 1) < 0.001) {
      return;
    }
    const span = document.createElement('span');
    span.textContent = `${key.toUpperCase()} ×${value.toFixed(2)}`;
    fragment.appendChild(span);
  });
  return fragment;
}

function getSlotsForKind(kind) {
  const available = Array.isArray(slotConfig.available_slots)
    ? slotConfig.available_slots
    : defaultSlotConfig.available_slots;
  if (kind === 'CARCASS') {
    return available.includes('carcass') ? ['carcass'] : [];
  }
  if (kind === 'WEAPON') {
    return available.filter((slot) => slot.startsWith('wpn'));
  }
  if (kind === 'MODULE') {
    return available.filter((slot) => slot.startsWith('mod'));
  }
  return available;
}

function getAvailableSlotsForItem(item, equippedSlotsMap) {
  const baseSlots = getSlotsForKind(item.kind);
  if (!baseSlots.length) {
    return [];
  }
  const equippedMap = equippedSlotsMap || {};
  return baseSlots.filter((slot) => {
    const occupyingItemId = equippedMap[slot];
    return !occupyingItemId || occupyingItemId === item.id;
  });
}

function renderEcobotStats(ecobot) {
  if (!ecobotStatsContainer) return;
  ecobotStatsContainer.innerHTML = '';
  if (!ecobot) {
    ecobotStatsContainer.innerHTML = '<p>Ecobot não encontrado.</p>';
    return;
  }
  const title = document.createElement('h2');
  title.textContent = `Ecobot ${ecobot.nickname || ''}`.trim() || 'Ecobot';
  ecobotStatsContainer.appendChild(title);

  const statsGrid = document.createElement('div');
  statsGrid.className = 'ecobot-stats-grid';
  const statKeys = [
    { key: 'hp', label: 'HP' },
    { key: 'atk', label: 'ATK' },
    { key: 'def', label: 'DEF' },
    { key: 'speed', label: 'Velocidade' },
    { key: 'focus', label: 'Foco' },
    { key: 'energy', label: 'Energia' },
  ];
  statKeys.forEach(({ key, label }) => {
    const baseValue = ecobot.base_stats?.[key] ?? 0;
    const bonusValue = ecobot.equipment_bonus?.[key] ?? 0;
    const totalValue = ecobot.total_stats?.[key] ?? baseValue + bonusValue;
    const statEl = document.createElement('div');
    statEl.className = 'ecobot-stat';
    statEl.innerHTML = `
      <strong>${label}</strong>
      <div>Total: ${totalValue}</div>
      <div class="is-size-7 has-text-grey">Base ${baseValue}${bonusValue ? ` · +${bonusValue}` : ''}</div>
    `;
    statsGrid.appendChild(statEl);
  });
  ecobotStatsContainer.appendChild(statsGrid);

  const resistances = ecobot.resistances || {};
  const resFragment = buildResistanceBadges(resistances);
  if (resFragment.childNodes.length) {
    const resContainer = document.createElement('div');
    resContainer.className = 'ecobot-resistances';
    resContainer.appendChild(resFragment);
    ecobotStatsContainer.appendChild(resContainer);
  }

  if (ecobot.bonuses) {
    const bonusBox = document.createElement('div');
    bonusBox.className = 'ecobot-bonuses';
    const baseDropPercent = ((ecobot.bonuses.drop_chance_base || 0) * 100).toFixed(1);
    const bonusDropPercent = (ecobot.bonuses.drop_chance_bonus_percent || 0).toFixed(1);
    const totalDropPercent = ((ecobot.bonuses.drop_chance_base || 0) * 100 + (ecobot.bonuses.drop_chance_bonus_percent || 0)).toFixed(1);
    const xpBonusPercent = (ecobot.bonuses.xp_bonus_percent || 0).toFixed(1);
    bonusBox.innerHTML = `
      <p><strong>Chance de drop:</strong> base ${baseDropPercent}% · bônus ${bonusDropPercent}% · total ${totalDropPercent}%</p>
      <p><strong>Bônus de XP:</strong> ${xpBonusPercent}%</p>
    `;
    if (Array.isArray(ecobot.bonuses.module_breakdown) && ecobot.bonuses.module_breakdown.length) {
      const list = document.createElement('ul');
      list.className = 'ecobot-bonuses-list';
      ecobot.bonuses.module_breakdown.forEach((entry) => {
        const item = document.createElement('li');
        item.textContent = `${entry.name || 'Módulo'}: ${entry.type === 'drop' ? 'Drop' : 'XP'} +${(entry.value_percent || 0).toFixed(1)}%`;
        list.appendChild(item);
      });
      bonusBox.appendChild(list);
    }
    ecobotStatsContainer.appendChild(bonusBox);
  }
}

function renderSlots(equipped, itemsMap) {
  slotsContainer.innerHTML = '';
  const available = Array.isArray(slotConfig.available_slots)
    ? slotConfig.available_slots
    : defaultSlotConfig.available_slots;
  available.forEach((slot) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'inventory-slot-card box';
    const equippedId = equipped[slot];
    const header = document.createElement('strong');
    header.textContent = formatSlotLabel(slot);
    wrapper.appendChild(header);

    if (equippedId && itemsMap[equippedId]) {
      const item = itemsMap[equippedId];
      const body = document.createElement('div');
      body.className = 'inventory-slot-body';
      const img = document.createElement('img');
      img.className = 'inventory-item-image';
      img.src = item.image_url;
      img.alt = item.name;
      body.appendChild(img);
      const meta = document.createElement('div');
      meta.className = 'inventory-item-meta';
      meta.innerHTML = `<strong>${item.name}</strong><span class="inventory-item-description">${item.kind} · ${item.rarity}</span>`;
      const stats = document.createElement('div');
      stats.className = 'inventory-item-stats';
      stats.appendChild(buildStatsBadges(item.stats));
      stats.appendChild(buildResistanceBadges(item.resistances));
      meta.appendChild(stats);
      body.appendChild(meta);
      wrapper.appendChild(body);
      const btn = document.createElement('button');
      btn.className = 'button is-small is-text';
      btn.textContent = 'Desequipar';
      btn.addEventListener('click', async () => {
        await window.apiFetch('inventory_unequip.php', {
          method: 'POST',
          body: JSON.stringify({ slot }),
        });
        loadInventory();
      });
      wrapper.appendChild(btn);
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'Vazio';
      wrapper.appendChild(empty);
    }
    slotsContainer.appendChild(wrapper);
  });
}

function renderInventory(items, equipped) {
  inventoryList.innerHTML = '';
  const itemsMap = {};
  const equippedSlots = Object.entries(equipped || {}).reduce((acc, [slot, id]) => {
    if (id > 0) {
      acc[id] = slot;
    }
    return acc;
  }, {});

  items.forEach((item) => {
    itemsMap[item.id] = item;
    const li = document.createElement('li');
    li.className = 'inventory-item-card';

    const img = document.createElement('img');
    img.className = 'inventory-item-image';
    img.src = item.image_url;
    img.alt = item.name;
    li.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'inventory-item-meta';
    const title = document.createElement('strong');
    title.textContent = item.name;
    meta.appendChild(title);
    const subtitle = document.createElement('span');
    subtitle.className = 'inventory-item-description';
    subtitle.textContent = `${item.kind} · ${item.rarity}${item.min_level ? ` · Nível ${item.min_level}` : ''}`;
    meta.appendChild(subtitle);
    if (item.description) {
      const desc = document.createElement('span');
      desc.className = 'inventory-item-description';
      desc.textContent = item.description;
      meta.appendChild(desc);
    }
    const stats = document.createElement('div');
    stats.className = 'inventory-item-stats';
    stats.appendChild(buildStatsBadges(item.stats));
    stats.appendChild(buildResistanceBadges(item.resistances));

    if (item.weapon && item.weapon.dmg_min !== null && item.weapon.dmg_max !== null) {
      const weaponSpan = document.createElement('span');
      weaponSpan.textContent = `DMG ${item.weapon.dmg_min}-${item.weapon.dmg_max}${item.weapon.dmg_type ? ` ${item.weapon.dmg_type}` : ''}`;
      stats.appendChild(weaponSpan);
    }
    if (item.weapon && item.weapon.energy_cost) {
      const costSpan = document.createElement('span');
      costSpan.textContent = `Energia ${item.weapon.energy_cost}`;
      stats.appendChild(costSpan);
    }
    if (item.module && item.module.module_kind) {
      const moduleSpan = document.createElement('span');
      const parts = [item.module.module_kind];
      if (item.module.module_value) {
        parts.push(item.module.module_value);
      }
      if (item.module.module_energy_cost) {
        parts.push(`EN ${item.module.module_energy_cost}`);
      }
      if (item.module.module_cooldown) {
        parts.push(`CD ${item.module.module_cooldown}`);
      }
      moduleSpan.textContent = parts.join(' ');
      stats.appendChild(moduleSpan);
      if (Array.isArray(item.module.effects) && item.module.effects.length) {
        item.module.effects.forEach((effect) => {
          const effectSpan = document.createElement('span');
          const label = effect.label || effect.type;
          effectSpan.textContent = `${label}: +${(effect.effective_percent || effect.value_percent || 0).toFixed(1)}%`;
          stats.appendChild(effectSpan);
        });
      }
    }

    meta.appendChild(stats);
    li.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'inventory-item-actions';
    const slotName = equippedSlots[item.id];
    if (slotName) {
      const badge = document.createElement('span');
      badge.className = 'tag is-success';
      badge.textContent = `Equipado (${formatSlotLabel(slotName)})`;
      actions.appendChild(badge);
    }

    const slotOptions = getAvailableSlotsForItem(item, equipped || {});
    let slotSelector = null;

    if (slotOptions.length) {
      const selectWrapper = document.createElement('div');
      selectWrapper.className = 'select is-small';
      const selectEl = document.createElement('select');
      slotOptions.forEach((slot) => {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = formatSlotLabel(slot);
        if (slotName === slot) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      });
      if (slotName && slotOptions.includes(slotName)) {
        selectEl.value = slotName;
      }
      selectWrapper.appendChild(selectEl);
      actions.appendChild(selectWrapper);
      slotSelector = selectEl;
    }

    const equipBtn = document.createElement('button');
    equipBtn.className = 'button is-small is-link';
    equipBtn.textContent = 'Equipar';
    if (!slotOptions.length) {
      equipBtn.disabled = true;
      equipBtn.textContent = 'Sem slot disponível';
    }
    equipBtn.addEventListener('click', async () => {
      if (!slotOptions.length) {
        return;
      }
      const chosenSlot = slotSelector ? slotSelector.value : slotOptions[0];
      if (!chosenSlot || !slotOptions.includes(chosenSlot)) {
        alert('Selecione um slot válido.');
        return;
      }
      await window.apiFetch('inventory_equip.php', {
        method: 'POST',
        body: JSON.stringify({ slot: chosenSlot, inventory_id: item.id }),
      });
      loadInventory();
    });
    actions.appendChild(equipBtn);
    li.appendChild(actions);
    inventoryList.appendChild(li);
  });

  renderSlots(equipped || {}, itemsMap);
}

async function loadInventory() {
  try {
    const data = await window.apiFetch('inventory_list.php');
    const incomingConfig = data.slot_config || {};
    slotConfig = Object.assign({}, defaultSlotConfig, incomingConfig);
    if (!Array.isArray(slotConfig.available_slots) || !slotConfig.available_slots.length) {
      slotConfig.available_slots = defaultSlotConfig.available_slots.slice();
    }
    renderEcobotStats(data.ecobot);
    renderInventory(data.items || [], data.equipped || {});
  } catch (error) {
    inventoryList.innerHTML = `<li>${error.message}</li>`;
    if (ecobotStatsContainer) {
      ecobotStatsContainer.innerHTML = `<p>${error.message}</p>`;
    }
  }
}

loadInventory();
