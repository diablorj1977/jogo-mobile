window.missionHandlers = window.missionHandlers || {};

window.missionHandlers.SCAN = {
  async onFinish(mission, runId) {
    const code = prompt('Informe o código do QR:', '');
    if (!code) {
      throw new Error('Código obrigatório');
    }
    await window.apiFetch('mission_qr_submit.php', {
      method: 'POST',
      body: JSON.stringify({ run_id: runId, code }),
    });
    return { code };
  },
};
