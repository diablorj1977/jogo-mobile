// File: public/js/base_config.js
(function () {
  function normalise(base) {
    if (!base) {
      return null;
    }
    return String(base).replace(/\/+$/, '');
  }

  function guessHtmlBase() {
    const { origin, pathname } = window.location;
    const segments = pathname.split('/');
    segments.pop();
    const joined = segments.join('/') || '';
    return normalise(`${origin}${joined}` || origin);
  }

  function guessApiBase(htmlBase) {
    if (!htmlBase) {
      return null;
    }
    const lower = htmlBase.toLowerCase();
    if (lower.endsWith('/public')) {
      return normalise(`${htmlBase.slice(0, -'/public'.length)}/api`);
    }
    return normalise(`${htmlBase}/api`);
  }

  function buildUrl(base, path, fallbackPrefix = '') {
    if (!path) {
      return base || fallbackPrefix || '';
    }
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    const cleaned = path.replace(/^\/+/, '');
    if (base) {
      return `${base}/${cleaned}`;
    }
    if (fallbackPrefix) {
      return `${fallbackPrefix.replace(/\/+$/, '')}/${cleaned}`;
    }
    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  }

  const config = window.APP_CONFIG || {};
  const htmlBase = normalise(config.base_html) || guessHtmlBase();
  const apiBase = normalise(config.base_api) || guessApiBase(htmlBase);
  const uploadUrl = normalise(config.upload_url) || (apiBase ? `${apiBase}/uploads` : null);
  const routingBase = normalise(config.osrm_url) || null;
  const routingProfile = (config.osrm_profile || 'foot').toLowerCase();

  window.EcobotsBase = {
    config,
    htmlBase,
    apiBase,
    uploadUrl,
    routingBase,
    routingProfile,
    toHtml(path) {
      return buildUrl(htmlBase, path, window.location.origin);
    },
    toApi(path) {
      const cleaned = path ? path.replace(/^\/?api\//i, '') : '';
      return buildUrl(apiBase, cleaned, `${window.location.origin}/api`);
    },
    async fetchRoute(points, profileOverride) {
      if (!routingBase) {
        throw new Error('Roteador não configurado.');
      }
      if (!Array.isArray(points) || points.length < 2) {
        throw new Error('Pontos insuficientes para montar a rota.');
      }
      const profile = (profileOverride || routingProfile || 'foot').toLowerCase();
      const coordinates = points
        .map((point) => {
          const lat = Number(point.lat);
          const lng = Number(point.lng);
          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error('Coordenadas inválidas para cálculo da rota.');
          }
          return `${lng},${lat}`;
        })
        .join(';');
      const search = new URLSearchParams({ overview: 'full', geometries: 'geojson' });
      const url = `${routingBase}/route/v1/${profile}/${coordinates}?${search.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Falha ao consultar o roteador.');
      }
      const data = await response.json();
      if (!data.routes || !data.routes.length) {
        throw new Error('Nenhuma rota encontrada.');
      }
      return data.routes[0];
    },
    routeToLatLngs(route) {
      const geometry = route && route.geometry;
      if (!geometry || !Array.isArray(geometry.coordinates)) {
        return [];
      }
      return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    },
  };
})();
