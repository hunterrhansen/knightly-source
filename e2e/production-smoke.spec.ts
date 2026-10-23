import { expect, test } from '@playwright/test';

test('production sign-in renders and development labs redirect without controls', async ({
  page,
}) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({ status: 503, body: 'offline' }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Could not connect', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry connection' }),
  ).toBeVisible();
  await expect(page.getByRole('gridcell')).toHaveCount(0);
  for (const route of [
    '/board-lab',
    '/shell-lab',
    '/account-preview',
    '/account-settings-preview',
    '/account-privacy-preview',
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(
      page.getByRole('heading', { name: 'Could not connect', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Board workshop', { exact: true })).toHaveCount(
      0,
    );
  }
});
