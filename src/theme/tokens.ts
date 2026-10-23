export const tokens = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  /** inset: callouts and tinted rows inside a card. */
  radius: { inset: 12, control: 16, panel: 24 },
  typography: {
    body: 'Nunito_600SemiBold',
    bold: 'Nunito_800ExtraBold',
    heading: 'Fredoka_600SemiBold',
    // eyebrow: caps labels over a card; cardTitle: a card's heading; stat: a
    // tile's number; display: a page's headline number (Progress rating).
    size: {
      eyebrow: 13,
      small: 14,
      body: 16,
      cardTitle: 20,
      stat: 30,
      title: 32,
      hero: 48,
      display: 56,
    },
    lineHeight: { small: 20, body: 22 },
  },
  layout: {
    boardMax: 480,
    /** The home path's column on wide screens: the banner, the path's wave and
     * its side tiles; the night sky behind it stays full-bleed. */
    pathMax: 560,
    readingMax: 760,
    contentMax: 1000,
    contentBreakpoint: 768,
    headerBreakpoint: 400,
    minControl: 48,
    listItemMin: 56,
    ledge: 4,
  },
  // Board travel: 180ms at an even pace, as on Chess.com, so a piece leaves its
  // square on the next frame instead of easing in (which reads as a pause).
  motion: {
    press: 80,
    move: 180,
    moveBezier: [0, 0, 1, 1],
    pop: 300,
    popBezier: [0.22, 1, 0.36, 1],
    hint: 1600,
    answerFlash: 600,
    pieceSelect: 120,
    pieceScale: 1.08,
    // The Arcade and Dynamic styles lift a selected piece higher, as Duolingo does.
    pieceScaleLarge: 1.18,
    // A finger-dragged piece, measured from Chess.com's mobile lessons board:
    // twice its resting size, raised so its base rests on the finger, over a
    // flat 10%-black disc centred on the square under it. The tilt is ours:
    // their captured frame sits upright, this reads as a piece being carried.
    grabScale: 2,
    grabRise: 0.87,
    grabTilt: 4,
    grabHaloRadius: 1.19,
    // Share of the drawn box the artwork spans, so a carried piece can be held
    // inside the board, which clips the view and the Skia canvas alike.
    grabArtShare: 0.8,
    grabHalo: 'rgba(0, 0, 0, 0.1)',
    landingScale: 0.97,
    landingDown: 60,
    landingUp: 110,
    // Pieces arriving on an empty board: each drops a third of a square as it
    // fades in, row by row from the top, like a set being laid out.
    enter: 280,
    enterStagger: 35,
    enterDrop: 0.35,
    sheet: 320,
    fill: 400,
    celebrate: 900,
    // Springs for touch and UI (not board travel). Durations are perceptual:
    // Reanimated runs a spring about 1.5× as long. Use these, not one-off
    // configs, so every control shares one feel.
    springs: {
      // Touch-down: drops fast and stays down, no wobble.
      press: { duration: 90, dampingRatio: 1 },
      // Release: springs back past rest and settles with one bounce.
      release: { duration: 380, dampingRatio: 0.45 },
      // Something arriving on screen: one lively overshoot.
      pop: { duration: 420, dampingRatio: 0.55 },
      // Calm repositioning with no overshoot.
      settle: { duration: 320, dampingRatio: 1 },
      // Letting go after a drag: carries the finger's velocity (pass it in)
      // and overshoots only as far as that momentum takes it.
      fling: { duration: 300, dampingRatio: 0.8 },
    },
    // How far a pressed surface widens and flattens. Large flat surfaces
    // (cards, rows) squash less than buttons and chips so the edges barely move.
    squash: { control: 0.03, surface: 0.012 },
  },
  boardDrawings: {
    yellow: '#ffaa00',
    red: '#e53935',
    blue: '#1e88e5',
    green: '#43a047',
  },
  boardAnnotations: {
    best: 'rgba(99,153,34,0.85)',
    line: 'rgba(70,130,220,0.75)',
    danger: '#c33b36',
    hint: '#e9b949',
    hintGold: '#ffc233',
    hintGoldLedge: '#d39a00',
    onHintGold: '#2a1d00',
    analysis: '#4a7fd0',
    lastLight: '#f3e77e',
    lastDark: '#c3c449',
    lineLight: '#b7d2ee',
    lineDark: '#86a9cf',
    lineFrame: '#4682dc',
  },
  // Fixed piece-colour fills that do not follow the theme: the evaluation bar
  // and win graph (White's share over Black's), and the review clocks.
  evaluation: {
    white: '#f7f6f1',
    black: '#2b2926',
    onWhite: '#1d2618',
    onBlack: '#f2f1ec',
  },
  clock: { white: '#ffffff', black: '#262421' },
  pieces: {
    white: '#fbfaf5',
    whiteShade: '#d6d0c0',
    outline: '#24211c',
    black: '#36322c',
    blackShade: '#191714',
    blackOutline: '#141210',
    blackDetail: '#6a645a',
    blackEye: '#cfc8b6',
  },
} as const;
