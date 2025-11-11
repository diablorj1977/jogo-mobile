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

  window.EcobotsBase = {
    config,
    htmlBase,
    apiBase,
    uploadUrl,
    toHtml(path) {
      return buildUrl(htmlBase, path, window.location.origin);
    },
    toApi(path) {
      const cleaned = path ? path.replace(/^\/?api\//i, '') : '';
      return buildUrl(apiBase, cleaned, `${window.location.origin}/api`);
    },
  };
})();
