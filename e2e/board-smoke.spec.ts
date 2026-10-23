import { expect, type Page, test } from '@playwright/test';

async function story(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`);
  await expect(page.getByTestId('chessboard')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function point(page: Page, square: string) {
  const box = await page.getByTestId(`square-${square}`).boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error(`Square ${square} has no geometry`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Smoke only: detailed state, geometry and rendering cases belong in Jest.
for (const input of ['tap', 'drag', 'keyboard'] as const) {
  test(`${input} submits e2–e4 exactly once through the real board`, async ({
    page,
  }) => {
    await story(page, 'chess-runtime-journeys--move-input');
    if (input === 'keyboard') {
      await page
        .getByRole('gridcell', { name: 'e2, White pawn', exact: true })
        .press('Enter');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Enter');
    } else {
      const origin = await point(page, 'e2');
      const destination = await point(page, 'e4');
      if (input === 'tap') {
        await page.mouse.click(origin.x, origin.y);
        await expect(
          page.getByRole('gridcell', { name: 'e2, White pawn', exact: true }),
        ).toHaveAttribute('aria-selected', 'true');
        await page.mouse.click(destination.x, destination.y);
      } else {
        await page.mouse.move(origin.x, origin.y);
        await page.mouse.down();
        const held = page.getByTestId('dragged-piece');
        await expect(held).toBeVisible();
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await expect(held).toHaveCount(0);
        await expect(
          page.getByRole('gridcell', { name: 'e2, White pawn', exact: true }),
        ).toHaveAttribute('aria-selected', 'false');
        await expect(
          page.getByText('Attempts: 0', { exact: true }),
        ).toBeVisible();
        await page.mouse.down();
        await expect(held).toBeVisible();
        const squareBox = await page.getByTestId('square-e2').boundingBox();
        await expect
          .poll(async () => Math.round((await held.boundingBox())?.width ?? -1))
          .toBe(Math.round(squareBox?.width ?? -2));
        await page.mouse.move(destination.x, destination.y, { steps: 12 });
        await page.mouse.up();
      }
    }
    await expect(page.getByText('Attempts: 1', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('gridcell', { name: 'e2, empty', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('gridcell', { name: 'e4, White pawn', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('visual-piece-e4')).toBeVisible();
    // Let the real visual transition finish before checking for duplicate delivery.
    const artwork = page.getByTestId('visual-piece-e4');
    const destination = await page.getByTestId('square-e4').boundingBox();
    await expect
      .poll(async () => Math.round((await artwork.boundingBox())?.y ?? -1))
      .toBe(Math.round(destination?.y ?? -2));
    await expect(page.getByText('Attempts: 1', { exact: true })).toBeVisible();
  });
}

test('promotion cancels without submitting, then chooses a piece and returns focus', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await story(page, 'chess-runtime-journeys--promotion-reset');
  const pawn = page.getByRole('gridcell', {
    name: 'a7, White pawn',
    exact: true,
  });
  const queen = page.getByRole('button', {
    name: 'Promote to queen',
    exact: true,
  });
  const cancel = page.getByRole('button', {
    name: 'Cancel promotion',
    exact: true,
  });
  await pawn.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(queen).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(pawn).toBeFocused();
  await expect(page.getByText('Attempts: 0', { exact: true })).toBeVisible();
  await pawn.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(queen).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Promote to knight', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('gridcell', { name: 'a8, White knight', exact: true }),
  ).toBeFocused();
  await expect(page.getByText('Attempts: 1', { exact: true })).toBeVisible();
});

// Mouse capture must leave browser touch on RNGH's original movement-gated path.
test('touch keeps movement-gated pickup and submits e2–e4 once', async ({
  page,
}) => {
  await story(page, 'chess-runtime-journeys--move-input');
  const origin = await point(page, 'e2');
  const destination = await point(page, 'e4');
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...origin, id: 1 }],
  });
  const held = page.getByTestId('dragged-piece');
  await expect(held).toHaveCount(0);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: origin.x + 3, y: origin.y, id: 1 }],
  });
  await expect(held).toHaveCount(0);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: origin.x + 12, y: origin.y, id: 1 }],
  });
  await expect(held).toBeVisible();
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...destination, id: 1 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.getByText('Attempts: 1', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: 'e2, empty', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('gridcell', { name: 'e4, White pawn', exact: true }),
  ).toBeVisible();
});
