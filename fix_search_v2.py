import re

with open('/home/tobber/schach9x9/js/search.ts', 'r') as f:
    content = f.read()

# 1. Fix probcut function signature
content = re.sub(
    r'function probcut\(\s*b: IntBoard,\s*d: number,\s*beta: number,\s*maximizing: boolean,\s*start: number,\s*nodes: \{ count: number \}\s*\): boolean \{',
    '''function probcut(
  board: IntBoard,
  d: number,
  beta: number,
  maximizing: boolean,
  start: number,
  nodes: { count: number },
  color: number,
  searchFn: (b: IntBoard, d: number, alpha: number, beta: number, maximizing: boolean) => { score: number; bestMove: Move | null }
): boolean {''',
    content
)

# 2. Fix probcut body - replace b with board, search with searchFn
content = content.replace('checkInt(b,', 'checkInt(board,')
content = content.replace('genLegalInt(b,', 'genLegalInt(board,')
content = content.replace('b[m.to]', 'board[m.to]')
content = content.replace('makeMoveInt(b,', 'makeMoveInt(board,')
content = content.replace('undoMoveInt(b,', 'undoMoveInt(board,')
content = content.replace('search(', 'searchFn(')  # in probcut body

# 3. Fix sort callback
content = content.replace('probcutMoves.sort((a, b) => {', 'probcutMoves.sort((m1, m2) => {')
content = content.replace('b[a.to]', 'board[m1.to]')
content = content.replace('b[b.to]', 'board[m2.to]')

# 4. Fix probcut call
content = content.replace(
    'if (probcut(b, d, beta, maximizing, start, { count: nodes })) {',
    'if (probcut(board, d, beta, maximizing, start, { count: nodes }, color, search)) {'
)

# 5. Fix isSingularMove function signature
content = re.sub(
    r'function isSingularMove\(\s*b: IntBoard,\s*d: number,\s*bestMove: Move,\s*bestScore: number,\s*alpha: number,\s*beta: number,\s*maximizing: boolean,\s*start: number,\s*nodes: \{ count: number \}\s*\): boolean \{',
    '''function isSingularMove(
  board: IntBoard,
  d: number,
  bestMove: Move,
  bestScore: number,
  _alpha: number,
  _beta: number,
  maximizing: boolean,
  start: number,
  nodes: { count: number },
  color: number,
  searchFn: (b: IntBoard, d: number, alpha: number, beta: number, maximizing: boolean) => { score: number; bestMove: Move | null }
): boolean {''',
    content
)

# 6. Fix isSingularMove body
content = content.replace('checkInt(b,', 'checkInt(board,')
content = content.replace('genLegalInt(b,', 'genLegalInt(board,')
content = content.replace('makeMoveInt(b,', 'makeMoveInt(board,')
content = content.replace('undoMoveInt(b,', 'undoMoveInt(board,')
content = content.replace('search(', 'searchFn(')  # in isSingularMove

# 7. Fix isSingularMove calls (two locations)
content = content.replace(
    'isSingularMove(b, d, bestMove, bestScore, alpha, beta, maximizing, start, { count: nodes })',
    'isSingularMove(board, d, bestMove, bestScore, alpha, beta, maximizing, start, { count: nodes }, color, search)'
)

# 7b. Fix undo in isSingularMove calls
content = content.replace(
    'const undo = makeMoveInt(b, bestMove);',
    'const undo = makeMoveInt(board, bestMove);'
)
content = content.replace(
    'const extResult = search(b,',
    'const extResult = search(board,'
)
content = content.replace(
    'undoMoveInt(b, undo);',
    'undoMoveInt(board, undo);'
)

# 8. Fix probcut call
content = content.replace(
    'if (probcut(b, d, beta, maximizing, start, { count: nodes })) {',
    'if (probcut(board, d, beta, maximizing, start, { count: nodes }, color, search)) {'
)

# 9. Fix sort callback
content = content.replace('probcutMoves.sort((a, b) => {', 'probcutMoves.sort((m1, m2) => {')
content = content.replace('b[a.to]', 'board[m1.to]')
content = content.replace('b[b.to]', 'board[m2.to]')

# 9b. Fix probcut filter
content = content.replace('b[m.to]', 'board[m.to]')

# 9c. Fix probcut body b references
content = content.replace('makeMoveInt(b,', 'makeMoveInt(board,')
content = content.replace('undoMoveInt(b,', 'undoMoveInt(board,')
content = content.replace('search(', 'searchFn(')  # in probcut body

# 10. Fix unused alpha/beta in isSingularMove
content = content.replace(
    '  alpha: number,\n  beta: number,',
    ' _alpha: number,\n  _beta: number,'
)

# 11. Remove duplicate progress callback before loop (lines ~562-571)
# This block uses bestResult before it's declared and 'd' before the loop
content = re.sub(
    r'        }\n        }; \/\/ end of move loop\n\n        tt\.store\(hash, d, bestScore, flag, bestMove\);\n        return \{ score: bestScore, bestMove \};\n        }\n        }; \/\/ end of search function\n\n        // Report progress at each depth iteration\n        if \(progressCallback\) \{\n        progressCallback\(\{\n          depth: d,\n          nodes,\n          time: performance\.now\(\) - start,\n          score: bestResult\.score,\n          pv: bestResult\.bestMove \? `\$\{bestResult\.bestMove\.from\}-\$\{bestResult\.bestMove\.to\}` : undefined,\n        \} as AIProgressData\);\n        \}\n\n      // Iterative Deepening with Aspiration Windows \+ Internal Iterative Reduction \(IIR\)',
    '''            }; // end of move loop

        tt.store(hash, d, bestScore, flag, bestMove);
        return { score: bestScore, bestMove };
        }
        }; // end of search function

            // Iterative Deepening with Aspiration Windows + Internal Iterative Reduction (IIR)''',
    content
)

# 12. Remove extra } at end of file
content = content.replace('}\n}\n}', '}\n}\n}')  # careful with this

# 13. Fix extra } at end of file properly - remove trailing }
content = re.sub(r'}\n}$', '}\n}', content)

with open('/home/tobber/schach9x9/js/search.ts', 'w') as f:
    f.write(content)

print("Done with all fixes")
