# CONTRIBUTING

Please make sure these are done before you submit anything:

1. The tsc command should output no errors.
```bash
tsc -p tsconfig.app.json && tsc -p tsconfig.worker.json
```
2. Linting should also output no errors.
```bash
bun run lint
```
3. Use prettier to format the code.
```bash
prettier -w worker src
```
4. Keep the documentation up to date. Whenever you add, change, or remove an
   API endpoint, configuration option, permission, or user-facing feature,
   update the corresponding pages under `docs/` **in the same change**. Remember
   to update both the English (`docs/`) and Chinese (`docs/zh/`) versions, and
   adjust the sidebar in `docs/.vitepress/config.ts` when adding or removing
   pages. You can preview your changes with:
```bash
bun run docs:dev
```
5. Your commit message should only contain ASCII characters and should be clean. e.g,
```text
implement <stuff you implemented>
fix <bug you fixed>
add <feature>
```
