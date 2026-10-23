import { reviewKey } from './review-keys';

const press = (
  key: string,
  target: object = { tagName: 'DIV' },
  extra: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    defaultPrevented: boolean;
  }> = {},
) =>
  reviewKey({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    defaultPrevented: false,
    target,
    ...extra,
  });

describe('review shortcuts', () => {
  it('maps the arrows, ends, Enter, Space, F and Escape', () => {
    expect(press('ArrowLeft')).toBe('previous');
    expect(press('ArrowRight')).toBe('next');
    expect(press('ArrowUp')).toBe('first');
    expect(press('End')).toBe('last');
    expect(press('Enter')).toBe('advance');
    expect(press(' ')).toBe('advance');
    expect(press('F')).toBe('flip');
    expect(press('Escape')).toBe('back');
    expect(press('x')).toBeUndefined();
  });

  it('maps the review buttons: Best, Explain, Hint, Show me, Try again, All moves and Back to game', () => {
    expect(press('b')).toBe('best');
    expect(press('E')).toBe('explain');
    expect(press('h')).toBe('hint');
    expect(press('s')).toBe('reveal');
    expect(press('r')).toBe('retry');
    expect(press('l')).toBe('list');
    expect(press('Backspace')).toBe('back');
    // Typing a letter into a field never opens a line.
    expect(press('b', { tagName: 'INPUT' })).toBeUndefined();
  });

  it('leaves typing, the board and browser shortcuts alone', () => {
    expect(press('ArrowLeft', { tagName: 'INPUT' })).toBeUndefined();
    expect(
      press('f', { tagName: 'DIV', isContentEditable: true }),
    ).toBeUndefined();
    // The board's own arrows move focus between squares.
    expect(
      press('ArrowLeft', { tagName: 'DIV', closest: () => ({}) }),
    ).toBeUndefined();
    expect(press('ArrowLeft', undefined, { metaKey: true })).toBeUndefined();
    expect(
      press('ArrowRight', undefined, { defaultPrevented: true }),
    ).toBeUndefined();
  });

  it('lets Enter and Space press a focused control instead of advancing', () => {
    expect(press('Enter', { tagName: 'BUTTON' })).toBeUndefined();
    expect(
      press(' ', { tagName: 'DIV', getAttribute: () => 'button' }),
    ).toBeUndefined();
    // Arrows still step from a focused control.
    expect(press('ArrowRight', { tagName: 'BUTTON' })).toBe('next');
  });
});
