# ESLint Fixes - Remaining Issues

## Summary

ESLint has been configured and auto-fix has resolved most formatting issues. The following are **genuine code quality issues** that require manual fixes:

---

## 🔴 Critical Errors (16)

### 1. **Undefined Global Variables**

**File:** `main.js`  
**Issue:** `soundManager` and `PIECE_SVGS` are used but not defined

- Lines: 130, 241, 468, 470, 589, 605, 2153, 2155, 2160, 2162

**Fix Required:**

- Import `soundManager` properly from `sounds.js`
- Import or define `PIECE_SVGS`

### 2. **Lexical Declarations in Case Blocks**

**File:** `ai-worker.js`  
**Lines:** 35, 36, 41, 42

**File:** `gameEngine.js`  
**Lines:** 150, 151

**Issue:** `let`/`const` declarations inside `case` blocks without braces

**Fix Required:** Wrap case block content in curly braces:

```javascript
// Bad
case 'something':
  const x = 1;
  break;

// Good
case 'something': {
  const x = 1;
  break;
}
```

---

## ⚠️ Warnings (9)

### 1. **Unused Variables**

- `ai-worker.js:94` - `toPiece` assigned but never used
- `gameEngine.additional.test.js:5` - `BOARD_SIZE` imported but never used
- `gameEngine.js:199` - `from`, `to` parameters unused
- `main.js:931-932` - `whiteMobility`, `blackMobility` calculated but never used
- `sounds.test.js:5` - `soundManager` imported but never used
- `ui.js:648` - `pieceSymbol` assigned but never used
- `ui.js:843` - `index` parameter unused

**Fix Options:**

1. Remove unused variables
2. Prefix with `_` if intentionally unused (e.g., `_index`)
3. Use the variables

---

## ✅ Auto-fixed Issues

- ✅ Indentation (2 spaces everywhere)
- ✅ Quotes (single quotes)
- ✅ Semicolons
- ✅ Arrow function spacing
- ✅ Object/Array spacing

---

## Next Steps

1. Fix undefined globals (import statements)
2. Fix case block declarations
3. Clean up unused variables
4. Run `npm run lint` again to verify
