/**
 * Every script in the game attaches its public API to this single global namespace.
 *
 * The game is loaded with classic <script> tags (no bundler), which keeps it runnable by
 * simply opening index.html from disk. The load order in index.html therefore matters:
 * a script may only use namespace members defined by scripts listed above it.
 */
window.Forest = {};
