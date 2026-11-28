/**
 * TESTING ONLY (to be removed): the main menu's 🧪 TEST LEVEL button. Pick any world and play just
 * that one level (it plays as the level it has in the adventure's order); winning it goes back to
 * the title screen. A test level has its own save, separate from the adventure's: an unfinished one
 * can be resumed here, or skipped straight to its boss fight (see Forest.Game.playTestLevel), while CONTINUE on the title screen still
 * resumes the adventure.
 *
 * To remove: delete this file, its <script> tag, the #menu-test-level button and #test-level-dialog
 * in index.html, the "Test level picker" block in style.css, and the TESTING ONLY parts of main.js
 * (playTestLevel, isTestLevel and the test level save).
 */
(function (Forest) {
  const button = document.getElementById('menu-test-level');
  const dialog = document.getElementById('test-level-dialog');
  const worldSelect = document.getElementById('test-level-world');
  const playButton = document.getElementById('test-level-play');
  const bossButton = document.getElementById('test-level-boss');
  const cancelButton = document.getElementById('test-level-cancel');

  function fillChoices() {
    if (worldSelect.options.length > 0) return;
    Forest.Levels.themes.forEach((theme, index) => worldSelect.add(new Option(`${index + 1}. ${theme.icon} ${theme.name}`, theme.id)));
  }

  /** RESUME when the picked world has an unfinished course to go back to, PLAY for a fresh one. */
  function refreshPlayLabel() {
    const saved = Forest.Game.savedTestLevel;
    playButton.textContent = saved && saved.worldId === worldSelect.value ? '▶ RESUME' : '▶ PLAY';
  }

  function open() {
    fillChoices();
    // The latest test level is already picked
    const saved = Forest.Game.savedTestLevel;
    const latest = (saved && saved.worldId) || Forest.Game.lastTestWorld;
    if (latest && [...worldSelect.options].some(option => option.value === latest)) worldSelect.value = latest;
    refreshPlayLabel();
    dialog.style.display = 'flex';
  }

  function close() {
    dialog.style.display = 'none';
  }

  // Taps on the dialog mustn't reach the game underneath
  [button, dialog].forEach(element => element.addEventListener('pointerdown', event => event.stopPropagation()));
  button.addEventListener('click', () => {
    button.blur();
    open();
  });
  worldSelect.addEventListener('change', refreshPlayLabel);
  cancelButton.addEventListener('click', close);
  playButton.addEventListener('click', () => {
    close();
    Forest.Game.playTestLevel(worldSelect.value);
  });
  bossButton.addEventListener('click', () => {
    close();
    Forest.Game.playTestLevel(worldSelect.value, { toBoss: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) close();
  });
})(window.Forest);
