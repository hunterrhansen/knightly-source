import { expect, test } from '@playwright/test';

test('app protects Account while offline and keeps workshop navigation usable across reload', async ({
  page,
}) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({ status: 503, body: 'offline' }),
  );
  await page.goto('/account');
  await expect(
    page.getByRole('button', { name: 'Retry connection' }),
  ).toBeVisible();
  await expect(page.getByText('Sign out', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Explore board workshop' }).click();
  await expect(page).toHaveURL(/\/board-lab$/);
  await expect(
    page.getByRole('heading', { name: 'Board workshop', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('gridcell')).toHaveCount(64);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Board workshop', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('gridcell')).toHaveCount(64);
});
