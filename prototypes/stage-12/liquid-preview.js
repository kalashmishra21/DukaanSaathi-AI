import liquidGL from 'liquid-gl';

const target = document.querySelector('.glass-floating');
const refractor = document.querySelector('.glass-refraction');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');
const narrow = matchMedia('(max-width: 900px)');
const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

if (target && refractor && !reducedMotion.matches && !reducedTransparency.matches && !narrow.matches && !lowPower && !new URLSearchParams(location.search).has('fallback')) {
  const start = () => {
    try {
      const lens = liquidGL({
        target: '.glass-refraction',
        snapshot: 'body',
        engine: 'webgl2',
        resolution: .65,
        refraction: .009,
        bevelWidth: .12,
        bevelDepth: .06,
        frost: .02,
        shadow: false,
        specular: true,
        tint: 'rgba(20, 40, 29, 0.11)',
        interaction: 'none',
        reveal: 'none',
        on: { init: () => { target.dataset.glass = 'ready'; } },
      });
      window.addEventListener('pagehide', () => lens?.destroy?.(), { once: true });
    } catch {
      target.dataset.glass = 'fallback';
    }
  };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1700 });
  else setTimeout(start, 650);
}
