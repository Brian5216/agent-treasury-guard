# GitHub Publish Checklist

## Before First Push

1. Confirm the public positioning is final
2. Fill any submission-only placeholders that should not stay in the repository
3. Review the live proof pages and README links
4. Run the local test suite
5. Review the git status before staging

## Public Repo Sanity Checks

- `README.md` and `README.zh-CN.md` open correctly
- `docs/showcase/index.html` is aligned with the README wording
- `docs/live-proof.md` and `docs/workflow-evidence.md` match the browser proof pages
- No local absolute filesystem links remain in public Markdown files
- `node_modules/` is ignored
- `.env` is ignored

## Recommended Commands

```bash
git status --short
git status --ignored --short
npm test
```

If you want to verify the live environment before recording or publishing demo material:

```bash
npm run preflight
```

## Known Manual Items

- Fill `Claw 型号`
- Fill `大模型版本`
- Decide whether to keep hackathon-only docs in the public repo
- Rotate any API keys or wallet keys that were exposed during local testing

## Suggested First Commit Scope

- source code
- tests
- README (EN + ZH)
- docs
- showcase pages
- `.gitignore`

Avoid including:

- `node_modules`
- local `.env`
- system files such as `.DS_Store`
