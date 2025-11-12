// File: public/js/missao_qr.js
const qrContainer = document.getElementById('qr-container');
const qrError = document.getElementById('qr-error');
const baseHelpersQr = window.EcobotsBase || {};
const qrParams = new URLSearchParams(window.location.search);
const qrMissionId = parseInt(qrParams.get('mission_id') || '', 10);
const qrRunId = parseInt(qrParams.get('run_id') || '', 10);
let qrDetail = null;
let codeValidated = false;

function toHtml(path) {
  if (typeof baseHelpersQr.toHtml === 'function') {
    return baseHelpersQr.toHtml(path);
  }
  return path;
}

function renderQrMission() {
  qrContainer.innerHTML = '';
  qrError.classList.add('is-hidden');

  const header = document.createElement('div');
  header.className = 'mission-detail-header';
  const title = document.createElement('h1');
  title.className = 'title is-3';
  title.textContent = qrDetail.mission.name;
  header.appendChild(title);
  if (qrDetail.mission.image_url) {
    const img = document.createElement('img');
    img.className = 'mission-detail-image';
    img.src = qrDetail.mission.image_url;
    img.alt = `Referência visual da missão ${qrDetail.mission.name}`;
    header.appendChild(img);
  }
  qrContainer.appendChild(header);

  const hintSection = document.createElement('div');
  hintSection.className = 'mission-section';
  const hintTitle = document.createElement('h2');
  hintTitle.className = 'title is-5';
  hintTitle.textContent = 'Dica';
  hintSection.appendChild(hintTitle);
  const hintText = document.createElement('p');
  hintText.textContent = qrDetail.type_data.qr_hint || 'Aproxime-se do local e escaneie o código indicado.';
  hintSection.appendChild(hintText);
  qrContainer.appendChild(hintSection);

  const formSection = document.createElement('div');
  formSection.className = 'mission-section';
  const formTitle = document.createElement('h2');
  formTitle.className = 'title is-5';
  formTitle.textContent = 'Enviar código';
  formSection.appendChild(formTitle);

  const manualField = document.createElement('div');
  manualField.className = 'field';
  const manualControl = document.createElement('div');
  manualControl.className = 'control';
  const manualInput = document.createElement('input');
  manualInput.className = 'input';
  manualInput.type = 'text';
  manualInput.placeholder = 'Digite o código QR ou de barras';
  manualControl.appendChild(manualInput);
  manualField.appendChild(manualControl);
  formSection.appendChild(manualField);

  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  const sendButton = document.createElement('button');
  sendButton.className = 'button is-primary';
  sendButton.type = 'button';
  sendButton.textContent = 'Validar código';
  sendButton.addEventListener('click', () => {
    const code = manualInput.value.trim();
    if (!code) {
      qrError.textContent = 'Informe o código para validar.';
      qrError.classList.remove('is-hidden');
      return;
    }
    submitQrCode(code, sendButton, manualInput);
  });
  buttons.appendChild(sendButton);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.capture = 'environment';
  fileInput.classList.add('is-hidden');
  formSection.appendChild(fileInput);

  const scanButton = document.createElement('button');
  scanButton.className = 'button is-link';
  scanButton.type = 'button';
  scanButton.textContent = 'Ler código com a câmera';
  scanButton.addEventListener('click', () => fileInput.click());
  buttons.appendChild(scanButton);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      return;
    }
    if (!('BarcodeDetector' in window)) {
      qrError.textContent = 'Leitor de QR code não suportado neste navegador. Use a digitação manual.';
      qrError.classList.remove('is-hidden');
      return;
    }
    scanButton.classList.add('is-loading');
    createImageBitmap(file)
      .then((bitmap) => {
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] });
        return detector.detect(bitmap);
      })
      .then((results) => {
        scanButton.classList.remove('is-loading');
        if (results && results.length) {
          manualInput.value = results[0].rawValue;
          submitQrCode(results[0].rawValue, sendButton, manualInput);
        } else {
          qrError.textContent = 'Não foi possível identificar um código na imagem. Tente novamente.';
          qrError.classList.remove('is-hidden');
        }
      })
      .catch(() => {
        scanButton.classList.remove('is-loading');
        qrError.textContent = 'Falha ao processar o código. Utilize a digitação manual se necessário.';
        qrError.classList.remove('is-hidden');
      });
  });

  formSection.appendChild(buttons);
  qrContainer.appendChild(formSection);

  const actions = document.createElement('div');
  actions.className = 'mission-start-actions';
  const abortButton = document.createElement('button');
  abortButton.className = 'button is-danger is-light';
  abortButton.type = 'button';
  abortButton.textContent = 'Abortar missão';
  abortButton.addEventListener('click', () => abortQrMission(abortButton, manualInput, sendButton, scanButton, fileInput));
  actions.appendChild(abortButton);

  const backButton = document.createElement('a');
  backButton.className = 'button is-light';
  backButton.href = toHtml(`missao.html?mission_id=${encodeURIComponent(qrMissionId)}`);
  backButton.textContent = 'Voltar à missão';
  actions.appendChild(backButton);

  qrContainer.appendChild(actions);
}

function submitQrCode(code, button, input) {
  button.disabled = true;
  button.classList.add('is-loading');
  window
    .apiFetch('mission_qr_submit.php', {
      method: 'POST',
      body: JSON.stringify({
        run_id: qrRunId,
        code,
      }),
    })
    .then(() => {
      codeValidated = true;
      qrError.classList.add('is-hidden');
      input.disabled = true;
      button.textContent = 'Código validado';
      button.classList.remove('is-loading');
      finalizeQrMission();
    })
    .catch((error) => {
      qrError.textContent = error.message;
      qrError.classList.remove('is-hidden');
      button.disabled = false;
      button.classList.remove('is-loading');
    });
}

function finalizeQrMission() {
  window
    .apiFetch('mission_finish.php', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: qrMissionId,
        run_id: qrRunId,
      }),
    })
    .then(() => {
      const success = document.createElement('div');
      success.className = 'notification is-success mission-outcome-message';
      success.textContent = 'Código confirmado! Missão concluída com sucesso.';
      qrContainer.appendChild(success);
    })
    .catch((error) => {
      qrError.textContent = error.message;
      qrError.classList.remove('is-hidden');
    });
}

function abortQrMission(button, manualInput, sendButton, scanButton, fileInput) {
  if (!window.confirm('Deseja realmente abortar esta missão de QR code?')) {
    return;
  }
  button.disabled = true;
  button.classList.add('is-loading');
  window
    .apiFetch('mission_abort.php', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: qrMissionId,
        run_id: qrRunId,
      }),
    })
    .then(() => {
      button.classList.remove('is-loading');
      button.textContent = 'Missão abortada';
      button.classList.add('is-static');
      if (manualInput) {
        manualInput.disabled = true;
      }
      if (sendButton) {
        sendButton.disabled = true;
      }
      if (scanButton) {
        scanButton.disabled = true;
      }
      if (fileInput) {
        fileInput.disabled = true;
      }
      const notice = document.createElement('div');
      notice.className = 'notification is-warning mission-outcome-message';
      notice.textContent = 'Missão abortada. Você pode tentar novamente quando estiver pronto para validar o código.';
      qrContainer.appendChild(notice);
    })
    .catch((error) => {
      qrError.textContent = error.message;
      qrError.classList.remove('is-hidden');
      button.disabled = false;
      button.classList.remove('is-loading');
    });
}

function loadQrMission() {
  if (!qrMissionId || !qrRunId) {
    qrContainer.innerHTML = '';
    qrError.textContent = 'Parâmetros da missão ausentes.';
    qrError.classList.remove('is-hidden');
    return;
  }
  const query = new URLSearchParams({ mission_id: qrMissionId, run_id: qrRunId });
  window
    .apiFetch(`mission_detail.php?${query.toString()}`)
    .then((detail) => {
      if ((detail.mission.tipo || '').toUpperCase() !== 'SCAN') {
        throw new Error('Esta missão não é do tipo QR.');
      }
      qrDetail = detail;
      renderQrMission();
    })
    .catch((error) => {
      qrContainer.innerHTML = '';
      qrError.textContent = error.message;
      qrError.classList.remove('is-hidden');
    });
}

loadQrMission();
