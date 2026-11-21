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

  // Logout confirmation modal
  const logoutModal = document.getElementById('modal-logout');
  const logoutOverlay = document.getElementById('modal-logout-overlay');
  const logoutContent = document.getElementById('modal-logout-content');
  const btnOpenLogout = document.getElementById('btn-open-logout');
  const btnCloseLogout = document.getElementById('btn-close-logout');
  const btnCancelLogout = document.getElementById('btn-cancel-logout');
  const btnConfirmLogout = document.getElementById('btn-confirm-logout');

  function openLogoutModal() {
    if (!logoutModal || !logoutContent) return;
    logoutModal.classList.remove('hidden');
    void logoutContent.offsetWidth;
    logoutContent.classList.remove('scale-95', 'opacity-0', 'translate-y-4');
    logoutContent.classList.add('scale-100', 'opacity-100', 'translate-y-0');
    document.body.style.overflow = 'hidden';
  }

  function closeLogoutModal() {
    if (!logoutModal || !logoutContent) return;
    logoutContent.classList.remove('scale-100', 'opacity-100', 'translate-y-0');
    logoutContent.classList.add('scale-95', 'opacity-0', 'translate-y-4');
    setTimeout(() => {
      logoutModal.classList.add('hidden');
      document.body.style.overflow = '';
    }, 300);
  }

  if (btnOpenLogout) btnOpenLogout.addEventListener('click', openLogoutModal);
  if (btnCloseLogout) btnCloseLogout.addEventListener('click', closeLogoutModal);
  if (btnCancelLogout) btnCancelLogout.addEventListener('click', closeLogoutModal);
  if (logoutOverlay) logoutOverlay.addEventListener('click', closeLogoutModal);
  if (btnConfirmLogout) btnConfirmLogout.addEventListener('click', () => {
    btnConfirmLogout.disabled = true;
    btnConfirmLogout.classList.add('opacity-80', 'cursor-wait');
    window.location.href = '/logout';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && logoutModal && !logoutModal.classList.contains('hidden')) {
      closeLogoutModal();
    }
  });
});