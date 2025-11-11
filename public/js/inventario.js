// File: public/js/inventario.js
const inventoryList = document.getElementById('inventory-list');
const slotsContainer = document.getElementById('slots');
const ecobotStatsContainer = document.getElementById('ecobot-stats');

const slots = ['carcass', 'wpn1', 'wpn2', 'mod1', 'mod2'];

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
  if (kind === 'CARCASS') return ['carcass'];
  if (kind === 'WEAPON') return ['wpn1', 'wpn2'];
  if (kind === 'MODULE') return ['mod1', 'mod2'];
  return slots;
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
}

function renderSlots(equipped, itemsMap) {
  slotsContainer.innerHTML = '';
  slots.forEach((slot) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'inventory-slot-card box';
    const equippedId = equipped[slot];
    const header = document.createElement('strong');
    header.textContent = slot.toUpperCase();
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
      btn.textContent = 'Remover';
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
      costSpan.textContent = `Custo ${item.weapon.energy_cost}`;
      stats.appendChild(costSpan);
    }
    if (item.module && item.module.module_kind) {
      const moduleSpan = document.createElement('span');
      const cooldownText = item.module.module_cooldown ? ` CD ${item.module.module_cooldown}` : '';
      moduleSpan.textContent = `${item.module.module_kind} ${item.module.module_value || ''}${cooldownText}`.trim();
      stats.appendChild(moduleSpan);
    }

    meta.appendChild(stats);
    li.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'inventory-item-actions';
    const slotName = equippedSlots[item.id];
    if (slotName) {
      const badge = document.createElement('span');
      badge.className = 'tag is-success';
      badge.textContent = `Equipado (${slotName.toUpperCase()})`;
      actions.appendChild(badge);
    }
    const equipBtn = document.createElement('button');
    equipBtn.className = 'button is-small is-link';
    equipBtn.textContent = 'Equipar';
    equipBtn.addEventListener('click', async () => {
      const allowedSlots = getSlotsForKind(item.kind);
      let chosenSlot = allowedSlots.length === 1 ? allowedSlots[0] : prompt(`Escolha o slot (${allowedSlots.join(', ')}):`, allowedSlots[0]);
      if (!chosenSlot) return;
      chosenSlot = chosenSlot.trim();
      if (!allowedSlots.includes(chosenSlot)) {
        alert('Slot inválido para este item.');
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
