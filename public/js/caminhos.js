const container = document.getElementById('paths-container');

async function loadPaths() {
  try {
    const [list, progress] = await Promise.all([
      window.apiFetch('/api/paths_list.php'),
      window.apiFetch('/api/paths_progress.php'),
    ]);
    container.innerHTML = '';
    const progressMap = {};
    progress.paths.forEach((path) => {
      progressMap[path.code] = path;
    });
    list.paths.forEach((path) => {
      const box = document.createElement('div');
      box.className = 'box';
      const stats = progressMap[path.code] || { completed: 0, total: 0 };
      box.innerHTML = `<strong>${path.name}</strong><br>Progresso: ${stats.completed}/${stats.total}`;
      container.appendChild(box);
    });
  } catch (error) {
    container.textContent = error.message;
  }
}

loadPaths();
