/**
 * TESTING ONLY (to be removed): the main menu's 🧪 TEST LEVEL button. Pick any world and play just
 * that one level (it plays as the level it has in the adventure's order); winning it goes back to
 * the title screen. A test level has its own save, separate from the adventure's: an unfinished one
 * can be resumed here (see Forest.Game.playTestLevel), while CONTINUE on the title screen still
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
  const resumeButton = document.getElementById('test-level-resume');
  const playButton = document.getElementById('test-level-play');
  const cancelButton = document.getElementById('test-level-cancel');

  function fillChoices() {
    if (worldSelect.options.length > 0) return;
    Forest.Levels.themes.forEach((theme, index) => worldSelect.add(new Option(`${index + 1}. ${theme.icon} ${theme.name}`, theme.id)));
  }

  function open() {
    fillChoices();
    const saved = Forest.Game.savedTestLevel;
    resumeButton.style.display = saved ? '' : 'none';
    if (saved) resumeButton.textContent = `▶ RESUME ${saved.icon} ${saved.name}`;
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
  cancelButton.addEventListener('click', close);
  resumeButton.addEventListener('click', () => {
    close();
    Forest.Game.resumeTestLevel();
  });
  playButton.addEventListener('click', () => {
    close();
    Forest.Game.playTestLevel(worldSelect.value);
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) close();
  });
})(window.Forest);
