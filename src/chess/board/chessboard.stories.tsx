import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { Button } from '../../components/ui/button';
import { BoardInputDemo } from '../../features/board-lab/board-input-demo';
import { BoardLabScreen } from '../../features/board-lab/board-lab-screen';
import { BoardMotionDemo } from '../../features/board-lab/board-motion-demo';
import { legalMoves } from '../move';
import { castleFen, enPassantFen, promotionFen } from '../test-fixtures';
import { Chessboard } from './chessboard';

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const meta = {
  title: 'Chess/Static board',
  component: Chessboard,
  args: {
    position: { id: 'story', fen: start },
    orientation: 'w',
    policy: { mode: 'read-only' },
    presentation: { showDestinations: false, highlights: [], arrows: [] },
    onAttempt: () => {},
  },
  decorators: [
    (Story) => (
      <View style={{ width: 320, maxWidth: '100%' }}>
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Chessboard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const White: Story = {};
export const Black: Story = { args: { orientation: 'b' } };
export const InvalidPosition: Story = {
  args: { position: { id: 'invalid', fen: 'invalid' } },
};
export const MoveInput: Story = { render: () => <BoardInputDemo /> };
export const PromotionInput: Story = {
  render: () => <BoardInputDemo initialFen="4k3/P7/8/8/8/8/8/4K3 w - - 0 1" />,
};
export const CastleInput: Story = {
  render: () => (
    <BoardInputDemo initialFen="r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1" />
  ),
};
export const EnPassantInput: Story = {
  render: () => (
    <BoardInputDemo initialFen="4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1" />
  ),
};

export const RejectedPreview: Story = {
  args: {
    feedback: {
      positionId: 'story',
      attemptId: 'a1',
      outcome: 'rejected',
      message: 'Try again',
    },
    presentation: {
      showDestinations: false,
      highlights: [],
      arrows: [],
      preview: {
        positionId: 'story',
        attemptId: 'a1',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      },
    },
  },
};
export const MismatchedPreview: Story = {
  args: {
    ...RejectedPreview.args,
    feedback: {
      positionId: 'story',
      attemptId: 'old-attempt',
      outcome: 'pending',
      message: 'Checking',
    },
  },
};
export const ArtworkWorkshop: Story = {
  render: () => <BoardLabScreen />,
  decorators: [
    (Story) => (
      <View style={{ width: '100%', minHeight: 900 }}>
        <Story />
      </View>
    ),
  ],
};

export const DoubleTextControls: Story = {
  render: (args) => (
    <View style={{ gap: 16 }}>
      <Chessboard {...args} />
      <Button textScale={2} onPress={() => {}}>
        Continue learning
      </Button>
    </View>
  ),
};

export const BlockedExploration: Story = {
  args: {
    policy: {
      mode: 'movable',
      sides: ['w'],
      moves: legalMoves(start),
      submissionEnabled: false,
    },
  },
};
export const KeyboardInput: Story = { render: () => <BoardInputDemo /> };

export const MotionPreview: Story = { render: () => <BoardMotionDemo /> };
export const MotionCastling: Story = {
  render: () => (
    <BoardMotionDemo initialFen={castleFen} move={{ from: 'e1', to: 'g1' }} />
  ),
};
export const MotionEnPassant: Story = {
  render: () => (
    <BoardMotionDemo
      initialFen={enPassantFen}
      move={{ from: 'e5', to: 'd6' }}
    />
  ),
};
export const MotionUnderpromotion: Story = {
  render: () => (
    <BoardMotionDemo
      initialFen={promotionFen}
      move={{ from: 'a7', to: 'a8', promotion: 'n' }}
    />
  ),
};

export const BrilliantGrade: Story = {
  args: {
    presentation: {
      showDestinations: false,
      highlights: [],
      arrows: [],
      grade: { square: 'e2', kind: 'brilliant' },
    },
  },
};
