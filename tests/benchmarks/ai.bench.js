import { getBestMove, getNodesEvaluated } from '../../js/aiEngine.js';
import { createEmptyBoard } from '../../js/gameEngine.js';

async function runBenchmark() {
    console.log('--- AI Performance Benchmark ---');

    const board = createEmptyBoard();
    // Setup standard classic-like start
    board[0][4] = { type: 'k', color: 'black' };
    board[8][4] = { type: 'k', color: 'white' };
    for (let i = 0; i < 9; i++) {
        board[1][i] = { type: 'p', color: 'black' };
        board[7][i] = { type: 'p', color: 'white' };
    }

    const depths = [2, 3, 4, 5];

    for (const depth of depths) {
        console.log(`\nTesting Depth ${depth}...`);
        const start = Date.now();

        getBestMove(board, 'white', depth, 'expert');

        const end = Date.now();
        const duration = (end - start) / 1000;
        const totalNodes = getNodesEvaluated();
        const nps = duration > 0 ? Math.round(totalNodes / duration) : totalNodes * 1000;

        console.log(`Duration: ${duration.toFixed(3)}s`);
        console.log(`Nodes:    ${totalNodes.toLocaleString()}`);
        console.log(`NPS:      ${nps.toLocaleString()}`);
    }
}

runBenchmark().catch(console.error);
