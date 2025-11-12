// File: public/js/missoes_qr.js
window.missionHandlers = window.missionHandlers || {};
const qrStates = {};

window.missionHandlers.SCAN = {
  render(mission, runId) {
    qrStates[runId] = qrStates[runId] || { code: '' };
    missionWorkspace.show(mission, runId, (container) => {
      const instructions = document.createElement('p');
      instructions.textContent = 'Digite o código exibido no QR Code e confirme para validar a missão.';
      container.appendChild(instructions);

      const field = document.createElement('div');
      field.className = 'field';
      const label = document.createElement('label');
      label.className = 'label';
      label.htmlFor = `qr-input-${runId}`;
      label.textContent = 'Código do QR';
      const control = document.createElement('div');
      control.className = 'control';
      const input = document.createElement('input');
      input.className = 'input';
      input.type = 'text';
      input.id = `qr-input-${runId}`;
      input.placeholder = 'Ex: ECOBOTS-TESTE';
      input.value = qrStates[runId].code || '';
      control.appendChild(input);
      field.appendChild(label);
      field.appendChild(control);
      container.appendChild(field);

      const submitBtn = document.createElement('button');
      submitBtn.className = 'button is-primary is-small';
      submitBtn.type = 'button';
      submitBtn.textContent = 'Validar código';
      submitBtn.addEventListener('click', () => {
        submitQrCode(runId, input.value.trim());
      });
      container.appendChild(submitBtn);
    });
  },
  async onFinish(mission, runId) {
    const state = qrStates[runId];
    if (!state || !state.code) {
      throw new Error('Valide o código QR antes de finalizar.');
    }
    return { code: state.code };
  },
};

async function submitQrCode(runId, code) {
  if (!code) {
    missionWorkspace.setStatus('Informe o código antes de enviar.', true);
    return;
  }
  try {
    missionWorkspace.setStatus('Validando código...');
    await window.apiFetch('mission_qr_submit.php', {
      method: 'POST',
      body: JSON.stringify({ run_id: runId, code }),
    });
    qrStates[runId] = qrStates[runId] || {};
    qrStates[runId].code = code;
    missionWorkspace.setStatus('Código validado com sucesso.');
  } catch (error) {
    missionWorkspace.setStatus(error.message, true);
  }
}
