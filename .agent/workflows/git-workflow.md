---
description: Git Commit and CI Verification Workflow
---

This workflow ensures that all changes follow the project's quality standards and pass CI before being pushed.

1. **Check Local Status**
   Run `git status` to see your current changes.
2. **Auto-Fix Linting and Formatting**
   // turbo
   Run `npm run lint:fix` and `npm run format`.
3. **Verify Compliance**
   // turbo
   Run `npm run lint` and `npm run format:check`.
4. **Run Unit Tests**
   // turbo
   Run `npm test`.

5. **Commit Changes**
   Once all checks pass, stage and commit your changes.
   `git add .`
   `git commit -m "[TYPE]: [DESCRIPTION]"`

   _Types: feat, fix, docs, style, refactor, test, chore_
