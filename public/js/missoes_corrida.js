// File: public/js/missoes_corrida.js
window.missionHandlers = window.missionHandlers || {};
const raceStates = {};

window.missionHandlers.CORRIDA = {
  render(mission, runId) {
    raceStates[runId] = raceStates[runId] || { duration_s: '', dist_m: '' };
    missionWorkspace.show(mission, runId, (container) => {
      const description = document.createElement('p');
      description.textContent = 'Informe o tempo total da corrida e a distância percorrida antes de finalizar a missão.';
      container.appendChild(description);

      const durationField = createNumberField('Tempo (segundos)', `race-duration-${runId}`, raceStates[runId].duration_s, (value) => {
        raceStates[runId].duration_s = value;
      });
      container.appendChild(durationField);

      const distanceField = createNumberField('Distância (metros)', `race-distance-${runId}`, raceStates[runId].dist_m, (value) => {
        raceStates[runId].dist_m = value;
      });
      container.appendChild(distanceField);

      const hint = document.createElement('p');
      hint.className = 'help';
      hint.textContent = 'Dica: use um app de corrida ou GPS para coletar esses dados com precisão.';
      container.appendChild(hint);
    });
  },
  async onFinish(mission, runId) {
    const state = raceStates[runId] || {};
    const duration = parseInt(state.duration_s, 10);
    const distance = parseFloat(state.dist_m);
    if (!duration || !distance) {
      throw new Error('Informe tempo e distância para finalizar a corrida.');
    }
    return { duration_s: duration, dist_m: distance };
  },
};

function createNumberField(labelText, id, initialValue, onChange) {
  const field = document.createElement('div');
  field.className = 'field';
  const label = document.createElement('label');
  label.className = 'label';
  label.htmlFor = id;
  label.textContent = labelText;
  const control = document.createElement('div');
  control.className = 'control';
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'number';
  input.id = id;
  input.min = '0';
  input.step = 'any';
  if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
    input.value = initialValue;
  }
  input.addEventListener('input', () => {
    onChange(input.value);
  });
  control.appendChild(input);
  field.appendChild(label);
  field.appendChild(control);
  return field;
}
