'use strict';

{
  const about = document.querySelector('#about');
  const installButton = document.querySelector('#install-button');
  let installPrompt;

  const render = (focus = false) => globalThis.StatFighter.journey.render(focus);

  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelector('#main-heading')?.focus();
  });
  document.querySelector('#about-button').addEventListener('click', () => about.showModal());
  window.addEventListener('hashchange', () => render(true));

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    await installPrompt?.prompt();
    installPrompt = undefined;
    installButton.hidden = true;
  });

  render();
  // First-run warning. Shared result links (run=1) open straight on the result, which carries the short notice.
  const warning = document.querySelector('#journey-warning'), ackKey = 'stat-fighter:ack:v1';
  let acknowledged = false;
  try { acknowledged = localStorage.getItem(ackKey) === '1'; } catch { /* storage blocked: show it every visit */ }
  if (!acknowledged && !/[?&]run=1(&|$)/.test(location.hash)) {
    warning.showModal();
    // Watch the open attribute, as the router does: the close event is not dispatched reliably.
    const observer = new MutationObserver(() => {
      if (warning.open) return;
      observer.disconnect();
      try { localStorage.setItem(ackKey, '1'); } catch { /* not remembered */ }
    });
    observer.observe(warning, { attributes: true, attributeFilter: ['open'] });
  }
  if (location.protocol === 'file:') {
    document.querySelector('#install-info').hidden = true;
  } else if ('serviceWorker' in navigator) {
    const status = document.querySelector('#app-status');
    status.setAttribute('role', 'status');
    const updateStatus = registration => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        status.textContent = 'UPDATE READY — CLOSE ALL APP TABS / WINDOWS, THEN REOPEN';
      } else if (registration.active) {
        status.innerHTML = '<i aria-hidden="true"></i> OFFLINE READY';
      }
    };
    // Register after load so the background precache of full-size art does not compete with the first screen.
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
      updateStatus(registration);
      registration.update().catch(() => {});
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') updateStatus(registration);
          if (worker.state === 'redundant') status.textContent = registration.active
            ? 'OFFLINE VERSION RETAINED — UPDATE COULD NOT FINISH'
            : 'OFFLINE SETUP INCOMPLETE — RETRY WHEN CONNECTED';
        });
      });
      navigator.serviceWorker.ready.then(updateStatus);
    }).catch(error => {
      status.textContent = 'OFFLINE SETUP UNAVAILABLE — CALCULATOR STILL WORKS';
      console.warn('Offline setup failed.', error);
    }));
  }
}
