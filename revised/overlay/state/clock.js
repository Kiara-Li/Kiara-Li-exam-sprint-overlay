// Sprint clock. Wall time by default; the debug panel can jump it forward
// or speed it up without the rest of the overlay knowing the difference.

const listeners = new Set();

let speed = 1;
let anchorReal = Date.now();
let anchorVirtual = Date.now();
let timer = null;

function virtualNow() {
  return anchorVirtual + (Date.now() - anchorReal) * speed;
}

function rebase() {
  const current = virtualNow();
  anchorReal = Date.now();
  anchorVirtual = current;
}

function notify() {
  listeners.forEach((fn) => fn(virtualNow()));
}

export const clock = {
  now() {
    return virtualNow();
  },
  get speed() {
    return speed;
  },
  setSpeed(next) {
    rebase();
    speed = next;
    notify();
  },
  advance(minutes) {
    rebase();
    anchorVirtual += minutes * 60000;
    notify();
  },
  reset() {
    speed = 1;
    anchorReal = Date.now();
    anchorVirtual = Date.now();
    notify();
  },
  subscribe(fn) {
    listeners.add(fn);
    if (!timer) timer = window.setInterval(notify, 250);
    return () => {
      listeners.delete(fn);
      if (!listeners.size && timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };
  },
};

/**
 * Always shows seconds, so the island visibly moves while the user studies.
 * Over an hour it reads h:mm:ss, under an hour m:ss.
 */
export function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

export function formatDuration(minutes) {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** Tight form for the middle of the donut, where space is scarce. */
export function formatCompact(minutes) {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole}m`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatClockTime(ms) {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
