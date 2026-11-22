# CLAUDE.md

## Folders

- This folder (`d:\projects\scout-adventures-repo`) is the git working copy: make every edit, test and commit here.
- `d:\projects\scout-adventures` is only a synced copy of the game files (`index.html`, `soundtrack.mp3`, `src`, `style.css`, `three.min.js`) for the Flutter app's `assets/game` junction. Never edit it or run git there; the sync step overwrites it and deletes anything else (including `.git`).
- To sync on request: copy those game files from this folder to `d:\projects\scout-adventures` (mirror `src`).

## Git

- Never create branches for commits. Everything is committed directly on `main`.
