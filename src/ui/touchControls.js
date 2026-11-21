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
    bindTouches(input);
    bindMouse(input);
    bindMenuToggle();

    // A long press must not open a context menu, which would cancel the held touches
    const panel = document.getElementById('touch-controls');
    if (panel) panel.addEventListener('contextmenu', event => event.preventDefault());
  }

  /**
   * Every finger is tracked on its own, by touch identifier, and matched to the button under the
   * point where it landed. One listener on the whole page does this rather than one per button, so
   * holding ◀/▶ with one thumb never stops ▲ or ⚔ from registering under the other.
   */
  function bindTouches(input) {
    /** touch identifier -> action that finger is holding */
    const fingerActions = new Map();

    const isHeldByAnotherFinger = action => [...fingerActions.values()].includes(action);

    const actionUnder = touch => {
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const button = element && element.closest('.touch-btn');
      return button ? BUTTON_ACTIONS[button.id] : undefined;
    };

    document.addEventListener('touchstart', event => {
      let isOnButton = false;
      for (const touch of event.changedTouches) {
        const action = actionUnder(touch);
        if (!action) continue;
        isOnButton = true;
        const wasHeld = isHeldByAnotherFinger(action);
        fingerActions.set(touch.identifier, action);
        if (!wasHeld) input.press(action);
      }
      // Touches elsewhere keep their default behaviour (a tap on the game attacks via mousedown)
      if (isOnButton) event.preventDefault();
    }, { passive: false });

    const endTouches = event => {
      let wasOnButton = false;
      for (const touch of event.changedTouches) {
        const action = fingerActions.get(touch.identifier);
        if (!action) continue;
        wasOnButton = true;
        fingerActions.delete(touch.identifier);
        if (!isHeldByAnotherFinger(action)) input.release(action);
      }
      if (wasOnButton && event.cancelable) event.preventDefault();
    };
    document.addEventListener('touchend', endTouches, { passive: false });
    document.addEventListener('touchcancel', endTouches, { passive: false });
  }

  /** The same buttons work with a mouse (handy for testing on a desktop). */
  function bindMouse(input) {
    Object.entries(BUTTON_ACTIONS).forEach(([buttonId, action]) => {
      const button = document.getElementById(buttonId);
      if (!button) return;

      let held = false;
      button.addEventListener('mousedown', event => {
        event.preventDefault();
        held = true;
        input.press(action);
      });
      const release = () => {
        if (!held) return;
        held = false;
        input.release(action);
      };
      button.addEventListener('mouseup', release);
      button.addEventListener('mouseleave', release);
    });
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
