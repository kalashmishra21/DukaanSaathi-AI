/* eslint-disable @typescript-eslint/no-unused-expressions -- playwright-cli evaluates this callback expression. */
async page => {
  const errors = [];
  const warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  const base = 'C:/Users/kalas/OneDrive/Desktop/DukaanSaathi AI/prototypes/stage-12/evidence/after/';
  const results = [];
  for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ['dark', 'light']) {
      await page.goto('http://127.0.0.1:3101/');
      await page.evaluate(value => localStorage.setItem('ds-stage12-theme', value), theme);
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${base}${theme}-${viewport.name}-initial.png` });
      const initial = await page.locator('#state-title').textContent();
      await page.waitForTimeout(1150);
      const listening = await page.locator('#state-title').textContent();
      await page.screenshot({ path: `${base}${theme}-${viewport.name}-listening.png` });
      await page.screenshot({ path: `${base}${theme}-${viewport.name}-full.png`, fullPage: true });
      const metrics = await page.evaluate(() => ({
        renderer: document.querySelector('.core-display').dataset.renderer || 'svg',
        glass: document.querySelector('.glass-floating').dataset.glass || 'css',
        overflow: document.documentElement.scrollWidth - innerWidth,
        canvas: document.querySelectorAll('#core-orbit canvas').length,
        totalResourceTransfer: Math.round(performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024),
      }));
      results.push({ viewport: viewport.name, theme, initial, listening, ...metrics });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3101/?fallback');
  const forcedFallback = await page.evaluate(() => ({ renderer: document.querySelector('.core-display').dataset.renderer || 'svg', canvas: document.querySelectorAll('#core-orbit canvas').length, visibleFallback: getComputedStyle(document.querySelector('.core-object')).visibility }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3101/');
  await page.waitForTimeout(2700);
  const reduced = await page.evaluate(() => ({ state: document.querySelector('#state-title').textContent, renderer: document.querySelector('.core-display').dataset.renderer || 'svg', animation: getComputedStyle(document.querySelector('.orbit-outer')).animationName }));
  await page.emulateMedia({ reducedMotion: null });
  return { results, forcedFallback, reduced, errors, warnings };
}
