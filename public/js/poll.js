// Keeps an installed repository's board fresh (S1b, AC-11): reload every 30 seconds
// while the page is visible, stop while it is hidden, reload at once when it comes back.
// Polls Chain's own API (/api/state), never GitHub. Everything is injected for tests.

export const POLL_MS = 30 * 1000;

export function startPolling({ load, onData, onError = () => {}, doc = document, timers = globalThis, intervalMs = POLL_MS }) {
  let timer = null;
  let stopped = false;

  async function tick() {
    if (stopped || doc.visibilityState !== 'visible') return;
    try {
      onData(await load());
    } catch (err) {
      onError(err);
    }
  }

  function schedule() {
    if (timer === null && doc.visibilityState === 'visible') timer = timers.setInterval(tick, intervalMs);
  }

  function onVisibility() {
    if (doc.visibilityState === 'visible') {
      schedule();
      tick();
    } else if (timer !== null) {
      timers.clearInterval(timer);
      timer = null;
    }
  }

  doc.addEventListener('visibilitychange', onVisibility);
  schedule();

  return function stop() {
    stopped = true;
    if (timer !== null) timers.clearInterval(timer);
    timer = null;
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}

// "14:05" in the viewer's time zone, from an ISO time; '' if invalid.
export function clock(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
