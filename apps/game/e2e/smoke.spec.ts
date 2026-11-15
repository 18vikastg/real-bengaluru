import { expect, test } from '@playwright/test';

test('boots to the title screen, streams the city, flies, pauses and shows credits with no console errors', async ({
  page,
}) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(String(error)));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Created & developed by Vikas T G')).toBeVisible();
  await expect(page).toHaveTitle(/^(?!.*GTA)/i);
  await expect(page.locator('meta[name="author"]')).toHaveAttribute('content', 'Vikas T G');

  // The WebGL canvas exists and has actually drawn something.
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1000);
  const drawn = await canvas.evaluate((element) => {
    const source = element as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = 64;
    copy.height = 64;
    const context = copy.getContext('2d');
    if (!context) return false;
    return new Promise<boolean>((resolve) => {
      requestAnimationFrame(() => {
        context.drawImage(source, 0, 0, 64, 64);
        const pixels = context.getImageData(0, 0, 64, 64).data;
        const seen = new Set<number>();
        for (let i = 0; i < pixels.length; i += 4) {
          seen.add(((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0));
        }
        resolve(seen.size > 20);
      });
    });
  });
  expect(drawn).toBe(true);

  await expect(page.getByRole('link', { name: /OpenStreetMap contributors/ })).toBeVisible();

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByLabel('Time of day')).toBeVisible();
  // The real map streams in: at least a dozen chunks around the camera, with geometry on screen.
  await expect
    .poll(
      async () =>
        Number(
          /(\d+) chunks/.exec((await page.getByTestId('stats').textContent()) ?? '')?.[1] ?? 0,
        ),
      {
        timeout: 90_000,
      },
    )
    .toBeGreaterThan(12);
  await expect
    .poll(
      async () =>
        Number(/(\d+)k tris/.exec((await page.getByTestId('stats').textContent()) ?? '')?.[1] ?? 0),
      {
        timeout: 30_000,
      },
    )
    .toBeGreaterThan(50);
  // Flying moves the camera without errors.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.getByLabel('Time of day').fill('22');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('dialog')).toContainText('Vikas T G');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByLabel('Time of day')).toBeVisible();

  expect(problems).toEqual([]);
});
