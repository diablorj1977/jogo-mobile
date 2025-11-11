// File: public/js/missoes_foto.js
window.missionHandlers = window.missionHandlers || {};
const photoStates = {};

window.missionHandlers.FOTO = {
  render(mission, runId) {
    photoStates[runId] = photoStates[runId] || { photos: [], lastUrl: null };
    missionWorkspace.show(mission, runId, (container) => {
      const intro = document.createElement('p');
      intro.textContent = 'Faça o upload da foto da missão. As imagens enviadas aparecerão na galeria abaixo.';
      container.appendChild(intro);

      const uploadField = document.createElement('div');
      uploadField.className = 'field';
      const control = document.createElement('div');
      control.className = 'file is-small is-boxed';
      const label = document.createElement('label');
      label.className = 'file-label';
      const input = document.createElement('input');
      input.className = 'file-input';
      input.type = 'file';
      input.accept = 'image/*';
      const fileCta = document.createElement('span');
      fileCta.className = 'file-cta';
      fileCta.innerHTML = '<span class="file-icon">📷</span><span class="file-label">Selecionar foto</span>';
      label.appendChild(input);
      label.appendChild(fileCta);
      control.appendChild(label);
      uploadField.appendChild(control);
      container.appendChild(uploadField);

      const uploadBtn = document.createElement('button');
      uploadBtn.className = 'button is-primary is-small';
      uploadBtn.type = 'button';
      uploadBtn.textContent = 'Enviar foto';
      uploadBtn.addEventListener('click', () => {
        if (!input.files || !input.files[0]) {
          missionWorkspace.setStatus('Selecione um arquivo para enviar.', true);
          return;
        }
        uploadPhoto(runId, input.files[0]);
        input.value = '';
      });
      container.appendChild(uploadBtn);

      const muralTitle = document.createElement('h3');
      muralTitle.className = 'title is-6 mt-3';
      muralTitle.textContent = 'Mural de fotos enviadas';
      container.appendChild(muralTitle);

      const mural = document.createElement('div');
      mural.id = `photo-mural-${runId}`;
      mural.className = 'photo-mural';
      container.appendChild(mural);
      renderPhotoMural(runId);
    });
  },
  async onFinish(mission, runId) {
    const state = photoStates[runId];
    if (!state || !state.photos.length) {
      throw new Error('Envie ao menos uma foto antes de finalizar.');
    }
    return { photo_path: state.lastUrl };
  },
};

async function uploadPhoto(runId, file) {
  try {
    missionWorkspace.setStatus('Enviando foto...');
    const base64 = await readFileAsBase64(file);
    const upload = await window.apiFetch('mission_photo_upload.php', {
      method: 'POST',
      body: JSON.stringify({
        run_id: runId,
        photo_base64: base64,
      }),
    });
    const state = photoStates[runId];
    state.photos.push(upload.photo_url);
    state.lastUrl = upload.photo_url;
    renderPhotoMural(runId);
    missionWorkspace.setStatus('Foto enviada com sucesso.');
  } catch (error) {
    missionWorkspace.setStatus(error.message, true);
  }
}

function renderPhotoMural(runId) {
  const mural = document.getElementById(`photo-mural-${runId}`);
  if (!mural) return;
  const state = photoStates[runId] || { photos: [] };
  mural.innerHTML = '';
  if (!state.photos.length) {
    const empty = document.createElement('p');
    empty.className = 'has-text-grey';
    empty.textContent = 'Nenhuma foto enviada ainda.';
    mural.appendChild(empty);
    return;
  }
  state.photos.slice().reverse().forEach((url) => {
    const wrapper = document.createElement('figure');
    wrapper.className = 'photo-mural-item';
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Registro da missão';
    wrapper.appendChild(img);
    mural.appendChild(wrapper);
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.onload = () => {
      const result = reader.result || '';
      const base64 = typeof result === 'string' ? result.split(',')[1] : '';
      if (!base64) {
        reject(new Error('Imagem inválida.'));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}
