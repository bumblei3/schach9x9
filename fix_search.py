import re

with open('/home/tobber/schach9x9/js/search.ts', 'r') as f:
    content = f.read()

# 1. Fix probcut function signature and body
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

# 2. Fix probcut body - replace b with board
content = content.replace('b,', 'board,')  # function param already handled above
content = content.replace('checkInt(b,', 'checkInt(board,')
content = content.replace('genLegalInt(b,', 'genLegalInt(board,')
content = content.replace('b[m.to]', 'board[m.to]')
content = content.replace('makeMoveInt(b,', 'makeMoveInt(board,')
content = content.replace('undoMoveInt(b,', 'undoMoveInt(board,')
content = content.replace('searchFn(b,', 'searchFn(board,')

# 3. Fix sort callback parameter shadowing
content = content.replace(
    'probcutMoves.sort((a, b) => {',
    'probcutMoves.sort((m1, m2) => {'
)
content = content.replace(
    'const victimA = b[a.to] & TYPE_MASK;',
    'const victimA = board[m1.to] & TYPE_MASK;'
)
content = content.replace(
    'const victimB = b[b.to] & TYPE_MASK;',
    'const victimB = board[m2.to] & TYPE_MASK;'
)

# 4. Fix probcut call site
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
content = content.replace(
    'const result = search(b, d - 1 - 2, singularAlpha, singularBeta, !maximizing);',
    'const result = searchFn(board, d - 1 - 2, singularAlpha, singularBeta, !maximizing);'
)

# 7. Fix isSingularMove call sites
content = content.replace(
    'if (isSingularMove(b, d, bestMove, bestScore, alpha, beta, maximizing, start, { count: nodes })) {',
    'if (isSingularMove(board, d, bestMove, bestScore, alpha, beta, maximizing, start, { count: nodes }, color, search)) {'
)

# 8. Fix probcut call site
content = content.replace(
    'if (probcut(b, d, beta, maximizing, start, { count: nodes })) {',
    'if (probcut(board, d, beta, maximizing, start, { count: nodes }, color, search)) {'
)

# 9. Fix sort callback parameter shadowing in probcut
content = content.replace(
    'probcutMoves.sort((a, b) => {',
    'probcutMoves.sort((m1, m2) => {'
)
content = content.replace('b[a.to]', 'board[m1.to]')
content = content.replace('b[b.to]', 'board[m2.to]')

# 10. Fix bestResult used before declaration - remove misplaced progress callback
# This is the block starting with "// Report progress at each depth iteration" before the loop
# We need to remove the duplicate progress callback block before the loop

# 11. Fix extra } at end of file
# will handle manually

# 12. Fix unused alpha/beta params in isSingularMove
content = content.replace(
    '  alpha: number,\n  beta: number,',
    ' _alpha: number,\n  _beta: number,'
)

# 13. Fix extra } at end of file
# will handle manually

with open('/home/tobber/schach9x9/js/search.ts', 'w') as f:
    f.write(content)

print("Done with initial fixes")
