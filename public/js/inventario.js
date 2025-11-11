// File: public/js/inventario.js
const inventoryList = document.getElementById('inventory-list');
const slotsContainer = document.getElementById('slots');

const slots = ['carcass', 'wpn1', 'wpn2', 'mod1', 'mod2'];

function renderSlots(equipped) {
  slotsContainer.innerHTML = '';
  slots.forEach((slot) => {
    const div = document.createElement('div');
    div.className = 'box';
    const equippedId = equipped[slot];
    div.innerHTML = `<strong>${slot.toUpperCase()}</strong><br>${equippedId ? `Item #${equippedId}` : 'Vazio'}<br>`;
    if (equippedId) {
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
      div.appendChild(btn);
    }
    slotsContainer.appendChild(div);
  });
}

async function loadInventory() {
  try {
    const data = await window.apiFetch('inventory_list.php');
    inventoryList.innerHTML = '';
    data.items.forEach((item) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${item.item_code} (#${item.id})`;
      const btn = document.createElement('button');
      btn.className = 'button is-small is-link';
      btn.textContent = 'Equipar';
      btn.addEventListener('click', async () => {
        const slot = prompt('Informe o slot (carcass, wpn1, wpn2, mod1, mod2):', 'carcass');
        if (!slot) return;
        await window.apiFetch('inventory_equip.php', {
          method: 'POST',
          body: JSON.stringify({ slot, inventory_id: item.id }),
        });
        loadInventory();
      });
      li.appendChild(label);
      li.appendChild(btn);
      inventoryList.appendChild(li);
    });
    renderSlots(data.equipped || {});
  } catch (error) {
    inventoryList.innerHTML = `<li>${error.message}</li>`;
  }
}

loadInventory();
