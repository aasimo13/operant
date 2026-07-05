import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** Messages the client has sent to the (mock) host so far. */
async function sent(page: Page): Promise<Array<{ type: string; [k: string]: unknown }>> {
  return page.evaluate(
    () => (window as unknown as { __operantSent: unknown[] }).__operantSent as never,
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: path.join(dir, 'mockHost.js') });
  await page.goto('/');
});

/** Enter the live view from the landing page. */
async function enter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.getByText(/Substrate online/i)).toBeVisible();
}

test('landing → Enter reveals the live Substrate view with the cycle count', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Enter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();
  await enter(page);
  await expect(page.getByText(/cycle/i)).toBeVisible();
  await expect(page.getByText(/watching/i)).toBeVisible();
});

test('camera viewpoints switch and expose ARIA state', async ({ page }) => {
  await enter(page);
  const third = page.getByRole('button', { name: 'Third person' });
  const god = page.getByRole('button', { name: 'God view' });
  await expect(third).toHaveAttribute('aria-pressed', 'true'); // default

  await god.click();
  await expect(god).toHaveAttribute('aria-pressed', 'true');
  await expect(third).toHaveAttribute('aria-pressed', 'false');
  // God view hides the FOV slider; first/third show it.
  await expect(page.getByLabel('Field of view')).toHaveCount(0);
  await page.getByRole('button', { name: 'First person' }).click();
  await expect(page.getByLabel('Field of view')).toBeVisible();
});

test('Providence sends reward and punish to the host', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: /reward/i }).click();
  await page.getByRole('button', { name: /punish/i }).click();
  await expect
    .poll(async () => await sent(page))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'providence', kind: 'reward' }),
        expect.objectContaining({ type: 'providence', kind: 'punish' }),
      ]),
    );
});

test('authoring a world submits it to the host', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: /author a world/i }).click();
  const dialog = page.getByRole('dialog', { name: /author a world/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('World name').fill('The Long Way Down');
  await dialog.getByRole('button', { name: /condemn the sim/i }).click();

  await expect
    .poll(async () => await sent(page))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'submitConstruct',
          design: expect.objectContaining({ name: 'The Long Way Down' }),
        }),
      ]),
    );
});

test('the Chronicle opens and shows the lived life', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: /the chronicle/i }).click();
  const dialog = page.getByRole('dialog', { name: /the chronicle/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Cycles lived')).toBeVisible();
  await expect(dialog.getByText('4,242')).toBeVisible(); // formatted age from the mock
  await expect(dialog.getByText('The Circuit')).toBeVisible(); // a world it endured
});

test('sound and reduced-motion toggles flip their ARIA state', async ({ page }) => {
  await enter(page);
  const sound = page.getByRole('button', { name: /silent|sound/i }).first();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');

  const motion = page.getByRole('button', { name: /motion|still/i }).first();
  const before = await motion.getAttribute('aria-pressed');
  await motion.click();
  await expect(motion).not.toHaveAttribute('aria-pressed', before ?? 'false');
});

test('recovers on reconnect — the host runs whether or not the tab is open', async ({ page }) => {
  await enter(page);
  // Sever the connection as if the socket dropped.
  await page.evaluate(() => {
    const sockets = (window as unknown as { __operantSockets: Array<{ close: () => void }> })
      .__operantSockets;
    sockets[sockets.length - 1]?.close();
  });
  await expect(page.getByText(/connecting to the substrate/i)).toBeVisible();
  // The client auto-reconnects (~1s) and a fresh welcome brings it back.
  await expect(page.getByText(/Substrate online/i)).toBeVisible({ timeout: 5000 });
});
