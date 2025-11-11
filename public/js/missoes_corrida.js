window.missionHandlers = window.missionHandlers || {};

window.missionHandlers.CORRIDA = {
  async onFinish(mission, runId) {
    const duration = prompt('Tempo em segundos da corrida:', '120');
    const distance = prompt('Distância percorrida (m):', '300');
    if (!duration || !distance) {
      throw new Error('Dados de corrida necessários');
    }
    return {
      duration_s: parseInt(duration, 10),
      dist_m: parseFloat(distance),
    };
  },
};
