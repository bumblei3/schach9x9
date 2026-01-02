import { getBestMove, getNodesEvaluated, resetNodesEvaluated } from '../js/aiEngine.js';
import { createEmptyBoard } from '../js/gameEngine.js';

describe('AI Engine - Search Performance', () => {
  let board;

  beforeEach(() => {
    board = createEmptyBoard();
  });

  test('Search efficiency with NMP and LMR', () => {
    // Setup a somewhat busy midgame board
    // 9x9 board
    board[4][4] = { type: 'k', color: 'white' };
    board[0][4] = { type: 'k', color: 'black' };
    board[5][4] = { type: 'p', color: 'white' };
    board[6][4] = { type: 'r', color: 'white' };
    board[2][4] = { type: 'p', color: 'black' };
    board[1][4] = { type: 'r', color: 'black' };
    board[4][2] = { type: 'n', color: 'white' };
    board[4][6] = { type: 'b', color: 'black' };

    resetNodesEvaluated();
    const depth = 4;
    getBestMove(board, 'white', depth, 'expert');
    const nodesWithOptimizations = getNodesEvaluated();

    console.log(`Nodes evaluated at depth ${depth}: ${nodesWithOptimizations}`);

    // For a 9x9 board at depth 4 with ~20-30 moves per ply,
    // a basic minimax would be 30^4 = 810,000 nodes.
    // Alpha-Beta reduces this towards sqrt(N) = 30^2 = 900.
    // NMP and LMR should keep it well within a few thousand for this sparse position.
    expect(nodesWithOptimizations).toBeLessThan(50000);
  });
});
