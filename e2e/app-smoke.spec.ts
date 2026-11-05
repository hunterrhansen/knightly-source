import { expect, test } from '@playwright/test';

test('app protects Account offline, preserves workshop input and switches the restored navigation across reload', async ({
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
  await page.goto('/navigation-preview');
  const navigation = page.getByRole('navigation');
  await navigation.getByRole('link', { name: 'Games', exact: true }).click();
  await expect(page).toHaveURL(/\/navigation-preview\/games$/);
  await expect(
    page.getByRole('heading', { name: 'Games', exact: true }),
  ).toBeVisible();
  const progress = navigation.getByRole('link', {
    name: 'Progress',
    exact: true,
  });
  await progress.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/navigation-preview\/progress$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Progress', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Today', exact: true })
    .click();
  await expect(page).toHaveURL(/\/navigation-preview$/);
});
