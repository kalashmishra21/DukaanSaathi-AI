const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
const themeLabel = document.querySelector('.theme-label');
const sequenceToggle = document.querySelector('.sequence-toggle');
const core = document.querySelector('.core-display');
const coreObject = document.querySelector('.core-object');
const stateTitle = document.querySelector('#state-title');
const stateDetail = document.querySelector('#state-detail');
const storyProgress = document.querySelector('#story-progress');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
const allowEffects = !motion.matches && !new URLSearchParams(location.search).has('fallback');
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(context);
  } catch { return false; }
}
const webglReady = allowEffects && !lowPower && matchMedia('(min-width: 651px)').matches && hasWebGL();
if (webglReady) {
  import('./core-three.bundle.js').catch(() => { core.dataset.renderer = 'fallback'; });
}
if (webglReady && matchMedia('(min-width: 901px)').matches) {
  const loadGlass = () => import('./liquid-preview.bundle.js').catch(() => {});
  setTimeout(() => { if (!document.hidden) loadGlass(); }, 4200);
}
const states = {
  idle: ['Ready for a request', 'An illustrative command is queued. Your microphone is off.', 'Faceted Saathi Core, simulated rest state'],
  listening: ['Voice, illustrated', 'The waveform is simulated; no microphone is recording.', 'Faceted Saathi Core, simulated listening state'],
  thinking: ['Meaning identified', 'Product: Maggi · quantity: 20 packets.', 'Faceted Saathi Core, simulated reasoning state'],
  action: ['Validated action preview', 'Proposed stock adjustment: +20 Maggi packets. Nothing has been saved.', 'Faceted Saathi Core, simulated validation state'],
  result: ['Simulated stock result', 'Illustrative outcome: +20 packets. No store record changed.', 'Faceted Saathi Core, simulated result state']
};

function syncTheme() {
  const dark = root.dataset.theme === 'dark';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', `${dark ? 'Night Bazaar' : 'Ivory Market'} theme — switch to ${dark ? 'Ivory Market' : 'Night Bazaar'}`);
  themeLabel.textContent = dark ? 'Night Bazaar' : 'Ivory Market';
}
themeButton.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('ds-stage12-theme', root.dataset.theme); } catch { /* Preview remains usable. */ }
  syncTheme();
});
syncTheme();
const floating = document.querySelector('.glass-floating');
if (floating && 'IntersectionObserver' in window) {
  const heroVisibility = new IntersectionObserver(([entry]) => {
    floating.dataset.out = String(!entry.isIntersecting);
  }, { threshold: .2 });
  heroVisibility.observe(document.querySelector('.hero'));
}

function setState(mode) {
  if (!states[mode]) return;
  core.dataset.state = mode;
  stateTitle.textContent = states[mode][0];
  stateDetail.textContent = states[mode][1];
  coreObject.setAttribute('aria-label', states[mode][2]);
  core.dispatchEvent(new CustomEvent('core-state-change', { detail: mode }));
}
const sequence = ['idle', 'listening', 'thinking', 'action', 'result'];
const durations = [650, 1500, 1800, 1650, 1400];
let sequenceIndex = 0;
let sequenceTimer = 0;
let paused = false;
function scheduleSequence() {
  clearTimeout(sequenceTimer);
  if (motion.matches || document.hidden || paused) return;
  sequenceTimer = setTimeout(() => {
    sequenceIndex = (sequenceIndex + 1) % sequence.length;
    setState(sequence[sequenceIndex]);
    scheduleSequence();
  }, durations[sequenceIndex]);
}
sequenceToggle.addEventListener('click', () => {
  paused = !paused;
  sequenceToggle.setAttribute('aria-pressed', String(paused));
  sequenceToggle.setAttribute('aria-label', paused ? 'Resume visual sequence' : 'Pause visual sequence');
  sequenceToggle.textContent = paused ? 'Resume motion' : 'Pause motion';
  scheduleSequence();
});
motion.addEventListener('change', () => { if (motion.matches) { clearTimeout(sequenceTimer); sequenceIndex = 0; setState('idle'); } else scheduleSequence(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(sequenceTimer); else scheduleSequence(); });
scheduleSequence();

let frame = 0;
const orbit = document.querySelector('#core-orbit');
orbit.addEventListener('pointermove', event => {
  if (core.dataset.renderer === 'webgl' || motion.matches || event.pointerType !== 'mouse') return;
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const bounds = orbit.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    coreObject.style.transform = `translate(-50%, -50%) rotateY(${x * 13}deg) rotateX(${-y * 13}deg)`;
  });
});
orbit.addEventListener('pointerleave', () => { if (frame) cancelAnimationFrame(frame); coreObject.style.transform = ''; });

const steps = [...document.querySelectorAll('.story-step')];
const story = document.querySelector('#story');
let storyFrame = 0;
function updateStory() {
  storyFrame = 0;
  const rect = story.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, (innerHeight - rect.top) / (rect.height + innerHeight)));
  storyProgress.style.transform = `scaleX(${progress})`;
  const current = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  steps.forEach((step, index) => step.classList.toggle('is-current', index === current));
}
function queueStory() {
  if (!storyFrame) storyFrame = requestAnimationFrame(updateStory);
}
window.addEventListener('scroll', queueStory, { passive: true });
window.addEventListener('resize', queueStory);
updateStory();
