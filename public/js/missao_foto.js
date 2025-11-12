// File: public/js/missao_foto.js
const photoContainer = document.getElementById('photo-container');
const photoError = document.getElementById('photo-error');
const baseHelpersPhoto = window.EcobotsBase || {};
const photoParams = new URLSearchParams(window.location.search);
const photoMissionId = parseInt(photoParams.get('mission_id') || '', 10);
const photoRunId = parseInt(photoParams.get('run_id') || '', 10);
let photoDetail = null;
let hasUploadedPhoto = false;

function toHtml(path) {
  if (typeof baseHelpersPhoto.toHtml === 'function') {
    return baseHelpersPhoto.toHtml(path);
  }
  return path;
}

function renderMural(mural) {
  const grid = document.createElement('div');
  grid.className = 'photo-mural';
  if (!mural.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Nenhuma foto enviada ainda. Seja o primeiro ecobot no local!';
    grid.appendChild(empty);
    return grid;
  }
  mural.forEach((photo) => {
    const figure = document.createElement('figure');
    figure.className = 'photo-mural-item';
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = 'Foto enviada na missão';
    figure.appendChild(img);
    grid.appendChild(figure);
  });
  return grid;
}

function renderPhotoDetail() {
  photoContainer.innerHTML = '';
  photoError.classList.add('is-hidden');

  const header = document.createElement('div');
  header.className = 'mission-detail-header';
  const title = document.createElement('h1');
  title.className = 'title is-3';
  title.textContent = photoDetail.mission.name;
  header.appendChild(title);
  if (photoDetail.mission.image_url) {
    const img = document.createElement('img');
    img.className = 'mission-detail-image';
    img.src = photoDetail.mission.image_url;
    img.alt = `Referência da missão ${photoDetail.mission.name}`;
    header.appendChild(img);
  }
  photoContainer.appendChild(header);

  if (photoDetail.mission.description) {
    const desc = document.createElement('div');
    desc.className = 'mission-section';
    const descTitle = document.createElement('h2');
    descTitle.className = 'title is-5';
    descTitle.textContent = 'Descrição';
    desc.appendChild(descTitle);
    const p = document.createElement('p');
    p.textContent = photoDetail.mission.description;
    desc.appendChild(p);
    photoContainer.appendChild(desc);
  }

  const muralSection = document.createElement('div');
  muralSection.className = 'mission-section';
  const muralTitle = document.createElement('h2');
  muralTitle.className = 'title is-5';
  muralTitle.textContent = 'Mural da missão';
  muralSection.appendChild(muralTitle);
  muralSection.appendChild(renderMural(photoDetail.type_data.photo_mural || []));
  photoContainer.appendChild(muralSection);

  const actionBar = document.createElement('div');
  actionBar.className = 'mission-start-actions';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.capture = 'environment';
  fileInput.classList.add('is-hidden');
  actionBar.appendChild(fileInput);

  const captureButton = document.createElement('button');
  captureButton.className = 'button is-link';
  captureButton.type = 'button';
  captureButton.textContent = 'Tirar foto';
  captureButton.addEventListener('click', () => {
    fileInput.click();
  });
  actionBar.appendChild(captureButton);

  const finishButton = document.createElement('button');
  finishButton.className = 'button is-success';
  finishButton.type = 'button';
  finishButton.textContent = 'Enviar e concluir missão';
  finishButton.disabled = !hasUploadedPhoto && !photoDetail.run?.proof_photo;
  finishButton.addEventListener('click', () => finalizePhotoMission(finishButton));
  actionBar.appendChild(finishButton);

  const abortButton = document.createElement('button');
  abortButton.className = 'button is-danger is-light';
  abortButton.type = 'button';
  abortButton.textContent = 'Abortar missão';
  abortButton.addEventListener('click', () => abortPhotoMission(abortButton, finishButton, captureButton, fileInput));
  actionBar.appendChild(abortButton);

  const backButton = document.createElement('a');
  backButton.className = 'button is-light';
  backButton.href = toHtml(`missao.html?mission_id=${encodeURIComponent(photoMissionId)}`);
  backButton.textContent = 'Voltar à missão';
  actionBar.appendChild(backButton);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }
    captureButton.classList.add('is-loading');
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',').pop();
      window
        .apiFetch('mission_photo_upload.php', {
          method: 'POST',
          body: JSON.stringify({
            run_id: photoRunId,
            photo_base64: base64,
          }),
        })
        .then((response) => {
          hasUploadedPhoto = true;
          finishButton.disabled = false;
          captureButton.classList.remove('is-loading');
          if (!photoDetail.type_data.photo_mural) {
            photoDetail.type_data.photo_mural = [];
          }
          photoDetail.type_data.photo_mural.unshift({ url: response.photo_url, finished_at: new Date().toISOString() });
          renderPhotoDetail();
        })
        .catch((error) => {
          photoError.textContent = error.message;
          photoError.classList.remove('is-hidden');
          captureButton.classList.remove('is-loading');
        });
    };
    reader.onerror = () => {
      photoError.textContent = 'Não foi possível processar a imagem selecionada.';
      photoError.classList.remove('is-hidden');
      captureButton.classList.remove('is-loading');
    };
    reader.readAsDataURL(file);
  });

  photoContainer.appendChild(actionBar);
}

function finalizePhotoMission(button) {
  button.disabled = true;
  button.classList.add('is-loading');
  window
    .apiFetch('mission_finish.php', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: photoMissionId,
        run_id: photoRunId,
      }),
    })
    .then(() => {
      button.classList.remove('is-loading');
      button.textContent = 'Missão concluída!';
      button.classList.add('is-static');
    })
    .catch((error) => {
      photoError.textContent = error.message;
      photoError.classList.remove('is-hidden');
      button.disabled = false;
      button.classList.remove('is-loading');
    });
}

function abortPhotoMission(button, finishButton, captureButton, fileInput) {
  if (!window.confirm('Deseja realmente abortar esta missão de foto?')) {
    return;
  }
  button.disabled = true;
  button.classList.add('is-loading');
  window
    .apiFetch('mission_abort.php', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: photoMissionId,
        run_id: photoRunId,
      }),
    })
    .then(() => {
      button.classList.remove('is-loading');
      button.textContent = 'Missão abortada';
      button.classList.add('is-static');
      if (finishButton) {
        finishButton.disabled = true;
        finishButton.classList.add('is-static');
        finishButton.textContent = 'Finalização indisponível';
      }
      if (captureButton) {
        captureButton.disabled = true;
      }
      if (fileInput) {
        fileInput.disabled = true;
      }
      const notice = document.createElement('div');
      notice.className = 'notification is-warning mission-outcome-message';
      notice.textContent = 'Missão abortada. Retorne quando puder capturar uma nova imagem.';
      photoContainer.appendChild(notice);
    })
    .catch((error) => {
      photoError.textContent = error.message;
      photoError.classList.remove('is-hidden');
      button.disabled = false;
      button.classList.remove('is-loading');
    });
}

function loadPhotoMission() {
  if (!photoMissionId || !photoRunId) {
    photoContainer.innerHTML = '';
    photoError.textContent = 'Parâmetros da missão ausentes.';
    photoError.classList.remove('is-hidden');
    return;
  }

  const query = new URLSearchParams({ mission_id: photoMissionId, run_id: photoRunId });
  window
    .apiFetch(`mission_detail.php?${query.toString()}`)
    .then((detail) => {
      if ((detail.mission.tipo || '').toUpperCase() !== 'FOTO') {
        throw new Error('Esta missão não é do tipo foto.');
      }
      photoDetail = detail;
      if (detail.run && detail.run.proof_photo) {
        hasUploadedPhoto = true;
      }
      renderPhotoDetail();
    })
    .catch((error) => {
      photoContainer.innerHTML = '';
      photoError.textContent = error.message;
      photoError.classList.remove('is-hidden');
    });
}

loadPhotoMission();
