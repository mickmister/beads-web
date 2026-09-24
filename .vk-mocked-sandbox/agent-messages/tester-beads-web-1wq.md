Please independently test beads-web-1wq — Support stdin piping for vibe-agent send messages.

Review2 approved commit:
- 118f3a07 — Support stdin for vibe-agent send

Tester scope:
1. `vibe-agent send <role> --stdin` parsing works.
2. `--respond` remains compatible with `--stdin`.
3. Existing quoted positional message behavior is unchanged.
4. Multiline stdin content is preserved exactly, including:
   - backticks: `code`
   - pipes: a | b | c
   - quotes: "double" and 'single'
   - fenced code blocks:
     ```sh
     echo "hello | world"
     ```
   - trailing newline content.
5. Empty stdin is rejected.
6. Positional message + `--stdin` is rejected.
7. Help text includes stdin usage and example.
8. Focused tests/typecheck/build pass.

Recommended commands:
- git cat-file -t 118f3a07
- npm test -- scripts/vibe-agent/legacy-cli/vibe-agent.test.ts scripts/vibe-agent/nudge/daemon.test.ts scripts/vibe-agent/nudge/criteria.test.ts
- git diff --check HEAD~1..HEAD
- npm run check-types
- npm run build
- node dist/vibe-agent/legacy-cli/vibe-agent.js --help
- rg -n "--stdin|readStdin|positional message|empty stdin|Support stdin" scripts/vibe-agent
- git status --short

Please create/close a tester bead and report JSON-like results with blockers if any.
