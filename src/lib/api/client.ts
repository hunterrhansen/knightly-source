import createClient from 'openapi-fetch';
import { z } from 'zod';
import { ApiError, httpError } from './api-error';
import {
  gamesSchema,
  linkedAccountSchema,
  lookupSchema,
  onboardingSchema,
  statusSchema,
  updateSchema,
} from './import-contract';
import {
  type JourneyMap,
  journeyMapSchema,
  type KeptNight,
  keptNightSchema,
} from './journey-contract';
import {
  type AnswerInput,
  answerSchema,
  type CardFeedback,
  cardFeedbackResponseSchema,
  type Deck,
  deckSchema,
  type HintInput,
  hintSchema,
  type PracticeAnswer,
  type PracticeStep,
  type PuzzleAnswerInput,
  type PuzzleHintInput,
  type SuspendedCard,
  type SuspendReason,
  stepSchema,
  suspendedCardsSchema,
  suspendResultSchema,
  type UnannouncedAnswerInput,
} from './practice-contract';
import {
  type GameFilters,
  gameFiltersSchema,
  overviewSchema,
  type ProgressRange,
  patternsSchema,
} from './progress-contract';
import {
  type MeResponse,
  meSchema,
  parsePublicConfig,
  type ReadyConfig,
} from './response-schemas';
import {
  type EngineLines,
  engineLinesSchema,
  finishReviewSchema,
  type GameDetail,
  gameDetailSchema,
  gameLinesSchema,
  type ReviewInput,
} from './review-contract';
import type { paths } from './schema';
import {
  type AccountSettings,
  type PracticePace,
  settingsSchema,
} from './settings-contract';
import { type ThreatAnswer, threatAnswerSchema } from './threat-contract';
import {
  type DailyReview,
  homeTodaySchema,
  streakDaysSchema,
  type Watch,
  watchSchema,
} from './today-contract';

type ThreatAnswerInput =
  paths['/api/threats/answer']['post']['requestBody']['content']['application/json'];
export type ApiOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  isCurrent: () => boolean;
  /** Aborts every request, such as when the signed-in session ends. */
  lifetime?: AbortSignal;
  fetcher?: typeof fetch;
};
/** `lesson` is tonight's watch; `extra` continues tonight's extra watch
 * (started by `extraWatch`). */
export type DeckMode = 'lesson' | 'extra';
export type ApiClient = {
  exportData: (signal?: AbortSignal) => Promise<Blob>;
  deleteAccount: (signal?: AbortSignal) => Promise<void>;
  settings: (signal?: AbortSignal) => Promise<AccountSettings>;
  setAnalysis: (
    nodes: number,
    signal?: AbortSignal,
  ) => Promise<{ nodes: number }>;
  /** Saves how many new review positions a day Today serves. */
  setPractice: (
    pace: PracticePace,
    signal?: AbortSignal,
  ) => Promise<{ pace: PracticePace }>;
  /** Saves the IANA zone that decides when the user's review day starts. */
  setTimezone: (
    timezone: string,
    signal?: AbortSignal,
  ) => Promise<{ timezone: string; day: string }>;
  /** Saves the learner's watch time and anchor ("After I …"). */
  setWatch: (
    watch: Pick<Watch, 'time' | 'anchor'>,
    signal?: AbortSignal,
  ) => Promise<Watch>;
  removeConnection: (
    source: string,
    handle: string,
    signal?: AbortSignal,
  ) => Promise<void>;

  overview: (
    range: ProgressRange,
    signal?: AbortSignal,
  ) => Promise<z.infer<typeof overviewSchema>>;
  patterns: (
    range: ProgressRange,
    signal?: AbortSignal,
  ) => Promise<z.infer<typeof patternsSchema>>;
  /** Learn more: raises today's new-position limit by one pace's worth, today only. */
  learnMore: (signal?: AbortSignal) => Promise<{ added: number; day: string }>;
  /** Today's daily review: plan, streak and memory. */
  dailyReview: (signal?: AbortSignal) => Promise<DailyReview>;
  /** The Progress map and the home path: stars, ranks, nights kept, the
   * schedule ahead and what each kept night held. */
  journey: (signal?: AbortSignal) => Promise<JourneyMap>;
  /** A kept night's watch: its moves and where each stands now. */
  keptNight: (date: string, signal?: AbortSignal) => Promise<KeptNight>;
  /** Each day's streak state from `from` to `to` (at most 42 days, not past today). */
  streakDays: (
    from: string,
    to: string,
    signal?: AbortSignal,
  ) => Promise<z.infer<typeof streakDaysSchema>>;
  game: (gameId: number, signal?: AbortSignal) => Promise<GameDetail>;
  finishReview: (
    gameId: number,
    body: ReviewInput,
    signal?: AbortSignal,
  ) => Promise<z.infer<typeof finishReviewSchema>>;
  engineLines: (
    gameId: number,
    ply: number,
    signal?: AbortSignal,
  ) => Promise<EngineLines>;
  /** Every move's lines the game's analysis stored, fetched once per review. */
  gameLines: (
    gameId: number,
    signal?: AbortSignal,
  ) => Promise<ReadonlyMap<number, EngineLines>>;
  /** A card's prepared grade map, or null until the worker has made it. */
  cardFeedback: (
    gameId: number,
    ply: number,
    signal?: AbortSignal,
  ) => Promise<CardFeedback | null>;
  /** `lesson`: the daily lesson, the positions most likely forgotten first. */
  deck: (signal?: AbortSignal, mode?: DeckMode) => Promise<Deck>;
  /** Starts tonight's next extra watch (or resumes the open one) and serves
   * it as `deck(signal, 'extra')` does. 409 until tonight's watch is kept. */
  extraWatch: (signal?: AbortSignal) => Promise<Deck>;
  answer: (body: AnswerInput, signal?: AbortSignal) => Promise<PracticeAnswer>;
  /** A "Your move" answer: judged like a card's first move, never scheduled. */
  unannouncedAnswer: (
    body: UnannouncedAnswerInput,
    signal?: AbortSignal,
  ) => Promise<PracticeStep>;
  /** Don't show this again: hide a position, with why. No grade is saved. */
  suspendCard: (
    gameId: number,
    ply: number,
    reason: SuspendReason,
    signal?: AbortSignal,
  ) => Promise<{ suspended: boolean }>;
  /** Show a hidden position again; its schedule resumes where it was. */
  unsuspendCard: (
    gameId: number,
    ply: number,
    signal?: AbortSignal,
  ) => Promise<{ suspended: boolean }>;
  suspendedCards: (signal?: AbortSignal) => Promise<SuspendedCard[]>;
  hint: (
    gameId: number,
    ply: number,
    signal?: AbortSignal,
  ) => Promise<z.infer<typeof hintSchema>>;
  /** One step of a multi-move answer: every move played so far plus the new one. */
  answerLine: (
    body: AnswerInput,
    signal?: AbortSignal,
  ) => Promise<PracticeStep>;
  /** The hint for the current step of a line. */
  lineHint: (
    body: HintInput,
    signal?: AbortSignal,
  ) => Promise<z.infer<typeof hintSchema>>;
  puzzleAnswer: (
    body: PuzzleAnswerInput,
    signal?: AbortSignal,
  ) => Promise<PracticeStep>;
  threatAnswer: (
    body: ThreatAnswerInput,
    signal?: AbortSignal,
  ) => Promise<ThreatAnswer>;
  puzzleHint: (
    body: PuzzleHintInput,
    signal?: AbortSignal,
  ) => Promise<z.infer<typeof hintSchema>>;
  me: (signal?: AbortSignal) => Promise<MeResponse>;
  lookup: (
    handle: string,
    signal?: AbortSignal,
    source?: 'chesscom' | 'lichess',
  ) => Promise<z.infer<typeof lookupSchema>>;
  connect: (
    handle: string,
    signal?: AbortSignal,
    source?: 'chesscom' | 'lichess',
  ) => Promise<z.infer<typeof linkedAccountSchema>>;
  onboarding: (
    signal?: AbortSignal,
  ) => Promise<z.infer<typeof onboardingSchema>>;
  importStatus: (signal?: AbortSignal) => Promise<z.infer<typeof statusSchema>>;
  games: (
    page: number,
    signal?: AbortSignal,
    filters?: GameFilters,
  ) => Promise<z.infer<typeof gamesSchema>>;
  sync: (signal?: AbortSignal) => Promise<z.infer<typeof updateSchema>>;
};
export function createApi({
  baseUrl,
  getToken,
  isCurrent,
  lifetime,
  fetcher = fetch,
}: ApiOptions): ApiClient {
  const client = createClient<paths>({ baseUrl, fetch: fetcher });
  async function request<T>(
    schema: z.ZodType<T>,
    send: (
      headers: Record<string, string>,
      signal: AbortSignal,
    ) => Promise<{ data?: unknown; error?: unknown; response: Response }>,
    signal?: AbortSignal,
  ): Promise<T> {
    // One signal for the caller's cancellation and the session's lifetime.
    const call = new AbortController();
    const abort = () => call.abort();
    lifetime?.addEventListener('abort', abort);
    signal?.addEventListener('abort', abort);
    if (lifetime?.aborted || signal?.aborted) call.abort();
    const guard = () => {
      if (call.signal.aborted || !isCurrent())
        throw new ApiError('cancelled', 'Request cancelled.');
    };
    try {
      guard();
      const token = await getToken();
      guard();
      if (!token)
        throw new ApiError(
          'unauthenticated',
          'Sign in before accessing your data.',
        );
      const { data, error, response } = await send(
        { Authorization: `Bearer ${token}` },
        call.signal,
      );
      guard();
      if (!response.ok) {
        const failure = httpError(response.status);
        const wait = Number(response.headers.get('Retry-After'));
        if (response.status === 429 && Number.isFinite(wait) && wait > 0)
          throw new ApiError(
            failure.kind,
            failure.message,
            response.status,
            Math.min(wait, 300),
          );
        const detail = z
          .object({ detail: z.string().max(300) })
          .safeParse(error);
        // 409 carries why an answer was refused (a changed line, a new day),
        // which the lesson shows instead of a generic failure.
        if ([400, 404, 409].includes(response.status) && detail.success)
          throw new ApiError(failure.kind, detail.data.detail, response.status);
        throw failure;
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success)
        throw new ApiError(
          'invalid-response',
          'Knightly returned invalid data.',
        );
      return parsed.data;
    } catch (error) {
      guard();
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError')
        throw new ApiError('cancelled', 'Request cancelled.');
      if (error instanceof SyntaxError)
        throw new ApiError(
          'invalid-response',
          'Knightly returned invalid JSON.',
        );
      throw new ApiError(
        'network',
        'Could not connect to Knightly. Check your connection.',
      );
    } finally {
      lifetime?.removeEventListener('abort', abort);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    exportData: (signal) =>
      request(
        z.custom<Blob>(
          (value) =>
            value instanceof Blob &&
            value.size > 0 &&
            value.type === 'application/zip',
        ),
        (headers, signal) =>
          client.GET('/api/export', { headers, signal, parseAs: 'blob' }),
        signal,
      ),
    deleteAccount: async (signal) => {
      await request(
        z.undefined(),
        (headers, signal) => client.DELETE('/api/account', { headers, signal }),
        signal,
      );
    },
    settings: (signal) =>
      request(
        settingsSchema,
        (headers, signal) => client.GET('/api/settings', { headers, signal }),
        signal,
      ),
    setAnalysis: (nodes, signal) =>
      request(
        z.object({ nodes: z.literal(nodes) }),
        (headers, signal) =>
          client.PUT('/api/settings/analysis', {
            headers,
            signal,
            body: { nodes },
          }),
        signal,
      ),
    setPractice: (pace, signal) =>
      request(
        z.object({ pace: z.literal(pace) }),
        (headers, signal) =>
          client.PUT('/api/settings/practice', {
            headers,
            signal,
            body: { pace },
          }),
        signal,
      ),
    setTimezone: (timezone, signal) =>
      request(
        z.object({
          timezone: z.literal(timezone),
          day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
        (headers, signal) =>
          client.PUT('/api/settings/timezone', {
            headers,
            signal,
            body: { timezone },
          }),
        signal,
      ),
    setWatch: (watch, signal) =>
      request(
        watchSchema.refine(
          (saved) => saved.time === watch.time && saved.anchor === watch.anchor,
          'Wrong watch',
        ),
        (headers, signal) =>
          client.PUT('/api/settings/watch', { headers, signal, body: watch }),
        signal,
      ),
    removeConnection: async (source, handle, signal) => {
      await request(
        z.undefined(),
        (headers, signal) =>
          client.DELETE('/api/accounts/{source}/{handle}', {
            headers,
            signal,
            params: { path: { source, handle } },
          }),
        signal,
      );
    },
    overview: (range, signal) =>
      request(
        overviewSchema.refine((data) => data.range === range, 'Wrong range'),
        (headers, signal) =>
          client.GET('/api/overview', {
            headers,
            signal,
            params: { query: { range } },
          }),
        signal,
      ),
    patterns: (range, signal) =>
      request(
        patternsSchema.refine((data) => data.range === range, 'Wrong range'),
        (headers, signal) =>
          client.GET('/api/patterns', {
            headers,
            signal,
            params: { query: { range } },
          }),
        signal,
      ),
    learnMore: (signal) =>
      request(
        z.object({
          added: z.number().int().nonnegative(),
          day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
        (headers, signal) => client.POST('/api/deck/more', { headers, signal }),
        signal,
      ),
    dailyReview: (signal) =>
      request(
        homeTodaySchema,
        (headers, signal) => client.GET('/api/home', { headers, signal }),
        signal,
      ),
    journey: (signal) =>
      request(
        journeyMapSchema,
        (headers, signal) => client.GET('/api/journey', { headers, signal }),
        signal,
      ),
    keptNight: (date, signal) =>
      request(
        keptNightSchema.refine((night) => night.date === date, 'Wrong night'),
        (headers, signal) =>
          client.GET('/api/journey/night', {
            headers,
            signal,
            params: { query: { date } },
          }),
        signal,
      ),
    streakDays: (from, to, signal) =>
      request(
        streakDaysSchema.refine(
          ({ days }) =>
            days[0]?.date === from &&
            days[days.length - 1]?.date === to &&
            days.every((day) => day.date >= from && day.date <= to),
          'Wrong days',
        ),
        (headers, signal) =>
          client.GET('/api/streak/days', {
            headers,
            signal,
            params: { query: { from, to } },
          }),
        signal,
      ),
    game: (game_id, signal) =>
      request(
        gameDetailSchema.refine((g) => g.id === game_id, 'Wrong game'),
        (headers, signal) =>
          client.GET('/api/games/{game_id}', {
            headers,
            signal,
            params: { path: { game_id } },
          }),
        signal,
      ),
    finishReview: (game_id, body, signal) =>
      request(
        finishReviewSchema,
        (headers, signal) =>
          client.POST('/api/games/{game_id}/review', {
            headers,
            body,
            signal,
            params: { path: { game_id } },
          }),
        signal,
      ),
    gameLines: (game_id, signal) =>
      request(
        gameLinesSchema,
        (headers, signal) =>
          client.GET('/api/games/{game_id}/lines', {
            headers,
            signal,
            params: { path: { game_id } },
          }),
        signal,
      ),
    engineLines: (game_id, ply, signal) =>
      request(
        engineLinesSchema,
        (headers, signal) =>
          client.GET('/api/games/{game_id}/lines/{ply}', {
            headers,
            signal,
            params: { path: { game_id, ply } },
          }),
        signal,
      ),
    cardFeedback: async (game_id, ply, signal) =>
      (
        await request(
          cardFeedbackResponseSchema,
          (headers, signal) =>
            client.GET('/api/deck/feedback/{game_id}/{ply}', {
              headers,
              signal,
              params: { path: { game_id, ply } },
            }),
          signal,
        )
      ).feedback,
    deck: (signal, mode = 'lesson') =>
      request(
        deckSchema,
        (headers, signal) =>
          client.GET('/api/deck', {
            headers,
            signal,
            params: { query: { mode } },
          }),
        signal,
      ),
    extraWatch: (signal) =>
      request(
        deckSchema,
        (headers, signal) =>
          client.POST('/api/lesson/extra', { headers, signal }),
        signal,
      ),
    answer: (body, signal) =>
      request(
        answerSchema,
        (headers, signal) =>
          client.POST('/api/deck/answer', { headers, body, signal }),
        signal,
      ),
    unannouncedAnswer: (body, signal) =>
      request(
        stepSchema,
        (headers, signal) =>
          client.POST('/api/unannounced/answer', { headers, body, signal }),
        signal,
      ),
    suspendCard: (game_id, ply, reason, signal) =>
      request(
        suspendResultSchema,
        (headers, signal) =>
          client.POST('/api/deck/suspend', {
            headers,
            body: { game_id, ply, reason },
            signal,
          }),
        signal,
      ),
    unsuspendCard: (game_id, ply, signal) =>
      request(
        suspendResultSchema,
        (headers, signal) =>
          client.POST('/api/deck/unsuspend', {
            headers,
            body: { game_id, ply },
            signal,
          }),
        signal,
      ),
    suspendedCards: (signal) =>
      request(
        suspendedCardsSchema,
        (headers, signal) =>
          client.GET('/api/deck/suspended', { headers, signal }),
        signal,
      ),
    hint: (game_id, ply, signal) =>
      request(
        hintSchema,
        (headers, signal) =>
          client.POST('/api/deck/hint', {
            headers,
            body: { game_id, ply },
            signal,
          }),
        signal,
      ),
    answerLine: (body, signal) =>
      request(
        stepSchema,
        (headers, signal) =>
          client.POST('/api/deck/answer', { headers, body, signal }),
        signal,
      ),
    lineHint: (body, signal) =>
      request(
        hintSchema,
        (headers, signal) =>
          client.POST('/api/deck/hint', { headers, body, signal }),
        signal,
      ),
    threatAnswer: (body, signal) =>
      request(
        threatAnswerSchema,
        (headers, signal) =>
          client.POST('/api/threats/answer', { headers, body, signal }),
        signal,
      ),
    puzzleAnswer: (body, signal) =>
      request(
        stepSchema,
        (headers, signal) =>
          client.POST('/api/puzzles/answer', { headers, body, signal }),
        signal,
      ),
    puzzleHint: (body, signal) =>
      request(
        hintSchema,
        (headers, signal) =>
          client.POST('/api/puzzles/hint', { headers, body, signal }),
        signal,
      ),
    me: (signal) =>
      request(
        meSchema,
        (headers, signal) => client.GET('/api/me', { headers, signal }),
        signal,
      ),
    lookup: (handle, signal, source = 'chesscom') =>
      request(
        lookupSchema.refine(
          (account) =>
            account.source === source &&
            account.handle.toLowerCase() === handle.toLowerCase(),
          'Wrong account',
        ),
        (headers, signal) =>
          client.GET('/api/lookup', {
            headers,
            signal,
            params: { query: { source, handle } },
          }),
        signal,
      ),
    connect: (handle, signal, source = 'chesscom') =>
      request(
        linkedAccountSchema.refine(
          (account) =>
            account.source === source &&
            account.handle.toLowerCase() === handle.toLowerCase(),
          'Wrong account',
        ),
        (headers, signal) =>
          client.POST('/api/accounts', {
            headers,
            signal,
            body: { source, handle },
          }),
        signal,
      ),
    onboarding: (signal) =>
      request(
        onboardingSchema,
        (headers, signal) => client.GET('/api/onboarding', { headers, signal }),
        signal,
      ),
    importStatus: (signal) =>
      request(
        statusSchema,
        (headers, signal) => client.GET('/api/status', { headers, signal }),
        signal,
      ),
    games: (page, signal, filters = {}) => {
      const { rated, ...query } = gameFiltersSchema.parse(filters);
      return request(
        gamesSchema,
        (headers, signal) =>
          client.GET('/api/games', {
            headers,
            signal,
            params: {
              query: {
                page,
                unrated:
                  rated === 'all' ||
                  (rated === undefined && !Object.keys(filters).length),
                ...query,
              },
            },
          }),
        signal,
      );
    },
    sync: (signal) =>
      request(
        updateSchema,
        (headers, signal) =>
          client.POST('/api/update/run', { headers, signal }),
        signal,
      ),
  };
}
export async function loadPublicConfig(
  baseUrl: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<ReadyConfig> {
  try {
    const response = await fetcher(`${baseUrl}/api/config`, { signal });
    if (!response.ok) throw httpError(response.status);
    return parsePublicConfig(await response.json());
  } catch (error) {
    if (signal.aborted)
      throw new ApiError('cancelled', 'Connection cancelled.');
    if (error instanceof ApiError) throw error;
    if (error instanceof SyntaxError)
      throw new ApiError(
        'invalid-response',
        'Knightly returned invalid configuration.',
      );
    throw new ApiError(
      'network',
      'Could not connect to Knightly. Check your connection.',
    );
  }
}
