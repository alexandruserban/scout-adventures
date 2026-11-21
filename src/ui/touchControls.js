/** On-screen buttons for touch devices (they also work with a mouse). */
(function (Forest) {
  const BUTTON_ACTIONS = {
    'btn-touch-left': 'left',
    'btn-touch-right': 'right',
    'btn-touch-jump': 'jump',
    'btn-touch-atk': 'attack'
  };

  /** @param {Forest.InputController} input */
  function bind(input) {
    Object.entries(BUTTON_ACTIONS).forEach(([buttonId, action]) => {
      const button = document.getElementById(buttonId);
      if (!button) return;

      let held = false;
      const press = event => {
        event.preventDefault();
        held = true;
        input.press(action);
      };
      const release = event => {
        event.preventDefault();
        if (!held) return;
        held = false;
        input.release(action);
      };

      button.addEventListener('touchstart', press);
      button.addEventListener('touchend', release);
      button.addEventListener('touchcancel', release);
      button.addEventListener('mousedown', press);
      button.addEventListener('mouseup', release);
      button.addEventListener('mouseleave', release);
    });

    bindMenuToggle();
  }

  /**
   * The ☰ button shows/hides the settings bar (music, sound, CRT, difficulty, gallery) on touch
   * screens. The game is paused while it's open.
   */
  function bindMenuToggle() {
    const toggle = document.getElementById('btn-menu-toggle');
    const bar = document.getElementById('controls-bar');
    if (!toggle || !bar) return;

    toggle.addEventListener('click', () => setMenuOpen(!bar.classList.contains('open')));
  }

  function setMenuOpen(open) {
    const toggle = document.getElementById('btn-menu-toggle');
    const bar = document.getElementById('controls-bar');
    if (!toggle || !bar) return;
    bar.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (Forest.Game) Forest.Game.setPaused(open, 'menu');
  }

  /** Hide the ☰ settings bar (e.g. when a menu item starts something), resuming the game. */
  function closeMenu() {
    setMenuOpen(false);
  }

  /** Height in CSS pixels, from the bottom of the window, that the touch buttons cover (0 when hidden). */
  function coveredBottomPixels() {
    const panel = document.getElementById('touch-controls');
    if (!panel || getComputedStyle(panel).display === 'none') return 0;
    return window.innerHeight - panel.getBoundingClientRect().top;
  }

  Forest.TouchControls = { bind, coveredBottomPixels, closeMenu };
})(window.Forest);
