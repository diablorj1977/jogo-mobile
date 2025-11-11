// File: public/js/missoes_foto.js
window.missionHandlers = window.missionHandlers || {};

window.missionHandlers.FOTO = {
  async onFinish(mission, runId) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    return new Promise((resolve, reject) => {
      fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) {
          reject(new Error('Selecione uma foto.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1];
          const upload = await window.apiFetch('mission_photo_upload.php', {
            method: 'POST',
            body: JSON.stringify({
              run_id: runId,
              photo_base64: base64,
            }),
          });
          resolve({ photo_path: upload.photo_url });
        };
        reader.readAsDataURL(file);
      };
      fileInput.click();
    });
  },
};
