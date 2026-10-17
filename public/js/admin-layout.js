document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menu-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (!sidebar || !toggle || !backdrop) return;

  const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;

  function setSidebar(open, save = true) {
    sidebar.classList.toggle('collapsed', !open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    backdrop.classList.toggle('show', open && isMobile());

    if (save && !isMobile()) {
      try {
        localStorage.setItem('sipat-sidebar', open ? 'open' : 'closed');
      } catch (error) {}
    }
  }

  let initial = true;

  if (isMobile()) {
    initial = false;
  } else {
    try {
      initial = localStorage.getItem('sipat-sidebar') !== 'closed';
    } catch (error) {}
  }

  setSidebar(initial, false);

  toggle.addEventListener('click', () => {
    setSidebar(sidebar.classList.contains('collapsed'));
  });

  backdrop.addEventListener('click', () => setSidebar(false));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isMobile()) {
      setSidebar(false);
    }
  });

  window.matchMedia('(max-width: 1023px)').addEventListener('change', event => {
    setSidebar(!event.matches, false);
  });
});