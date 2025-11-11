// File: public/js/missoes_p2p.js
window.missionHandlers = window.missionHandlers || {};

window.missionHandlers.P2P = {
  async onStart(mission, runId) {
    alert(`Missão P2P iniciada. Use o botão "Finalizar" após registrar toques.`);
  },
  async onFinish(mission, runId) {
    const seq = prompt('Último checkpoint alcançado (seq numérica):', '1');
    if (!seq) {
      throw new Error('Informe o checkpoint');
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        await window.apiFetch('mission_p2p_touch.php', {
          method: 'POST',
          body: JSON.stringify({
            run_id: runId,
            seq: parseInt(seq, 10),
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        });
      });
    }
    return {
      duration_s: parseInt(prompt('Tempo em segundos:', '60') || '0', 10),
      dist_m: parseFloat(prompt('Distância percorrida (m):', '150') || '0'),
    };
  },
};
