#!/usr/bin/env node
// Entrypoint for the design generator.
//
// Kept separate from build-design.mjs so that module stays import-safe. The previous
// version guarded its side effects with `process.argv[1] === fileURLToPath(import.meta.url)`,
// which silently no-ops when the two disagree — e.g. a checkout reached through a
// junction or symlink, where argv[1] keeps the link path but import.meta.url is
// realpathed. A separate entrypoint removes the class of bug instead of hardening
// a heuristic: here main() is always meant to run.
import { main } from './build-design.mjs';

main();
