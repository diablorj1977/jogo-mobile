// File: public/js/geolocalizacao.js
(function () {
  const BAR_ID = 'geo-status-bar';
  const BODY_READY_EVENT = 'DOMContentLoaded';

  if (window.__ecobotsGeoBarInitialised) {
    return;
  }

  function normaliseNumber(value) {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      return null;
    }
    return numberValue;
  }

  function formatCoordinate(value) {
    const normalised = normaliseNumber(value);
    if (normalised === null) {
      return '—';
    }
    return normalised.toFixed(5);
  }

  function formatAccuracy(value) {
    const normalised = normaliseNumber(value);
    if (normalised === null) {
      return '—';
    }
    if (normalised >= 1000) {
      return `${(normalised / 1000).toFixed(1)} km`;
    }
    return `${Math.round(normalised)} m`;
  }

  function ensureBar() {
    if (document.getElementById(BAR_ID)) {
      return document.getElementById(BAR_ID);
    }
    document.body.classList.add('has-geo-status');
    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.className = 'geo-status-bar';

    const label = document.createElement('span');
    label.className = 'geo-status-label';
    label.textContent = 'Geolocalização: aguardando autorização...';
    bar.appendChild(label);

    const accuracy = document.createElement('span');
    accuracy.className = 'geo-status-accuracy';
    bar.appendChild(accuracy);

    const timestamp = document.createElement('span');
    timestamp.className = 'geo-status-timestamp';
    bar.appendChild(timestamp);

    document.body.appendChild(bar);
    return bar;
  }

  function initialise() {
    const bar = ensureBar();
    const label = bar.querySelector('.geo-status-label');
    const accuracyLabel = bar.querySelector('.geo-status-accuracy');
    const timestampLabel = bar.querySelector('.geo-status-timestamp');

    if (!navigator.geolocation) {
      label.textContent = 'Geolocalização: não suportada neste dispositivo.';
      bar.classList.add('geo-status-bar--error');
      return;
    }

    const successHandler = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      label.textContent = `Lat ${formatCoordinate(latitude)} · Lng ${formatCoordinate(longitude)}`;
      accuracyLabel.textContent = `± ${formatAccuracy(accuracy)}`;
      timestampLabel.textContent = new Date(position.timestamp).toLocaleTimeString();
      bar.classList.remove('geo-status-bar--error');
    };

    const errorHandler = (error) => {
      const readable = error && error.message ? error.message : 'Falha ao obter posição.';
      label.textContent = `Geolocalização: ${readable}`;
      accuracyLabel.textContent = '';
      timestampLabel.textContent = '';
      bar.classList.add('geo-status-bar--error');
    };

    try {
      const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 20000,
      });
      window.addEventListener('beforeunload', () => {
        if (watchId !== undefined && watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
      });
    } catch (error) {
      errorHandler(error);
    }
  }

  function scheduleInitialisation() {
    if (document.readyState === 'loading') {
      document.addEventListener(BODY_READY_EVENT, initialise, { once: true });
    } else {
      initialise();
    }
  }

  window.__ecobotsGeoBarInitialised = true;
  scheduleInitialisation();
})();
