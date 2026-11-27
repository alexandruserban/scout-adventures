/**
 * The exit door button in the top-right corner of the main menu (title screen and pause menu): asks "Exit the game?" and then closes it.
 * - In the phone app the Flutter shell listens on the `ForestApp` JavaScript channel and closes the app.
 * - In a browser the tab is closed if the browser allows it (only tabs a script opened can be);
 *   otherwise the game goes back to its title screen.
 * Either way the adventure was saved at the start of the level, so it can be continued next time.
 */
(function (Forest) {
  const BROWSER_CLOSE_WAIT_MS = 250;

  const button = document.getElementById('btn-exit');
  const dialog = document.getElementById('exit-dialog');
  const confirmButton = document.getElementById('btn-exit-confirm');
  const cancelButton = document.getElementById('btn-exit-cancel');

  function isOpen() {
    return dialog.style.display === 'flex';
  }

  function open() {
    if (isOpen() || Forest.LoadingScreen.isBusy) return;
    dialog.style.display = 'flex';
    Forest.Game.setPaused(true, 'exit');
    cancelButton.focus({ preventScroll: true });
  }

  function close() {
    dialog.style.display = 'none';
    Forest.Game.setPaused(false, 'exit');
  }

  function exitGame() {
    close();
    // The phone app closes itself
    if (window.ForestApp && typeof window.ForestApp.postMessage === 'function') {
      Forest.Game.setBackgrounded(true); // silence everything while the app shuts
      window.ForestApp.postMessage('exit');
      return;
    }
    // A browser: close the tab if it lets us, otherwise back to the title screen
    window.close();
    setTimeout(() => {
      if (!window.closed) Forest.Game.exitToTitle();
    }, BROWSER_CLOSE_WAIT_MS);
  }

  // Taps on the button or the dialog mustn't reach the game (or the title screen) underneath
  [button, dialog].forEach(element => element.addEventListener('pointerdown', event => event.stopPropagation()));
  button.addEventListener('click', () => {
    button.blur();
    open();
  });
  confirmButton.addEventListener('click', exitGame);
  cancelButton.addEventListener('click', close);
  // A tap on the dark backdrop cancels too
  dialog.addEventListener('click', event => {
    if (event.target === dialog) close();
  });

  // While the dialog is up, Esc cancels and Enter exits (nothing else reacts to them)
  window.addEventListener('keydown', event => {
    if (!isOpen()) return;
    if (event.code === 'Escape') close();
    else if (event.key === 'Enter') exitGame();
    else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  Forest.ExitButton = {
    open,
    get isOpen() {
      return isOpen();
    }
  };
})(window.Forest);
