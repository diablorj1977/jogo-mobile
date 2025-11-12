// File: public/js/missoes_p2p.js
window.missionHandlers = window.missionHandlers || {};
const p2pStates = {};

window.missionHandlers.P2P = {
  render(mission, runId) {
    p2pStates[runId] = p2pStates[runId] || {
      nextSeq: 1,
      touches: [],
      duration_s: '',
      dist_m: '',
    };
    missionWorkspace.show(mission, runId, (container) => {
      const description = document.createElement('p');
      description.textContent = 'Registre cada checkpoint alcançado utilizando o botão abaixo. Informe também tempo e distância totais antes de finalizar.';
      container.appendChild(description);

      const seqField = document.createElement('div');
      seqField.className = 'field';
      const seqLabel = document.createElement('label');
      seqLabel.className = 'label';
      seqLabel.htmlFor = `p2p-seq-${runId}`;
      seqLabel.textContent = 'Próximo checkpoint (sequência)';
      const seqControl = document.createElement('div');
      seqControl.className = 'control';
      const seqInput = document.createElement('input');
      seqInput.className = 'input';
      seqInput.type = 'number';
      seqInput.min = '1';
      seqInput.step = '1';
      seqInput.id = `p2p-seq-${runId}`;
      seqInput.value = p2pStates[runId].nextSeq;
      seqControl.appendChild(seqInput);
      seqField.appendChild(seqLabel);
      seqField.appendChild(seqControl);
      container.appendChild(seqField);

      const registerBtn = document.createElement('button');
      registerBtn.className = 'button is-link is-small';
      registerBtn.type = 'button';
      registerBtn.textContent = 'Registrar checkpoint';
      registerBtn.addEventListener('click', () => {
        const seq = parseInt(seqInput.value, 10);
        if (!seq) {
          missionWorkspace.setStatus('Informe uma sequência válida.', true);
          return;
        }
        registerCheckpoint(runId, seq, seqInput);
      });
      container.appendChild(registerBtn);

      const touchesTitle = document.createElement('h3');
      touchesTitle.className = 'title is-6 mt-3';
      touchesTitle.textContent = 'Checkpoints registrados';
      container.appendChild(touchesTitle);

      const touchesList = document.createElement('ul');
      touchesList.id = `p2p-touch-list-${runId}`;
      touchesList.className = 'p2p-touch-list';
      container.appendChild(touchesList);
      renderTouchList(runId);

      const durationField = createP2PNumberField('Tempo total (segundos)', `p2p-duration-${runId}`, p2pStates[runId].duration_s, (value) => {
        p2pStates[runId].duration_s = value;
      });
      container.appendChild(durationField);

      const distanceField = createP2PNumberField('Distância total (metros)', `p2p-distance-${runId}`, p2pStates[runId].dist_m, (value) => {
        p2pStates[runId].dist_m = value;
      });
      container.appendChild(distanceField);
    });
  },
  async onFinish(mission, runId) {
    const state = p2pStates[runId] || {};
    if (!state.touches || !state.touches.length) {
      throw new Error('Registre ao menos um checkpoint antes de finalizar.');
    }
    const duration = parseInt(state.duration_s, 10);
    const distance = parseFloat(state.dist_m);
    if (!duration || !distance) {
      throw new Error('Informe tempo e distância totais para finalizar.');
    }
    return {
      duration_s: duration,
      dist_m: distance,
    };
  },
};

function registerCheckpoint(runId, seq, seqInput) {
  if (!navigator.geolocation) {
    missionWorkspace.setStatus('Geolocalização indisponível neste dispositivo.', true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        missionWorkspace.setStatus(`Enviando checkpoint ${seq}...`);
        await window.apiFetch('mission_p2p_touch.php', {
          method: 'POST',
          body: JSON.stringify({
            run_id: runId,
            seq,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        });
        const state = p2pStates[runId];
        state.touches.push({
          seq,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          at: new Date().toISOString(),
        });
        state.nextSeq = seq + 1;
        seqInput.value = state.nextSeq;
        renderTouchList(runId);
        missionWorkspace.setStatus(`Checkpoint ${seq} registrado!`);
      } catch (error) {
        missionWorkspace.setStatus(error.message, true);
      }
    },
    () => {
      missionWorkspace.setStatus('Não foi possível obter a localização atual.', true);
    }
  );
}

function renderTouchList(runId) {
  const list = document.getElementById(`p2p-touch-list-${runId}`);
  if (!list) return;
  const state = p2pStates[runId] || { touches: [] };
  list.innerHTML = '';
  if (!state.touches.length) {
    const empty = document.createElement('li');
    empty.className = 'has-text-grey';
    empty.textContent = 'Nenhum checkpoint registrado ainda.';
    list.appendChild(empty);
    return;
  }
  state.touches.slice().reverse().forEach((touch) => {
    const item = document.createElement('li');
    item.className = 'p2p-touch-item';
    const timestamp = new Date(touch.at).toLocaleTimeString();
    item.innerHTML = `<strong>#${touch.seq}</strong> — ${touch.lat.toFixed(6)}, ${touch.lng.toFixed(6)} <span class="p2p-touch-time">${timestamp}</span>`;
    list.appendChild(item);
  });
}

function createP2PNumberField(labelText, id, initialValue, onChange) {
  const field = document.createElement('div');
  field.className = 'field mt-3';
  const label = document.createElement('label');
  label.className = 'label';
  label.htmlFor = id;
  label.textContent = labelText;
  const control = document.createElement('div');
  control.className = 'control';
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'number';
  input.min = '0';
  input.step = 'any';
  input.id = id;
  if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
    input.value = initialValue;
  }
  input.addEventListener('input', () => onChange(input.value));
  control.appendChild(input);
  field.appendChild(label);
  field.appendChild(control);
  return field;
}
