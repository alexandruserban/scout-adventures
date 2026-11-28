/** On-screen buttons for touch devices (they also work with a mouse). */
(function (Forest) {
  const BUTTON_ACTIONS = {
    'btn-touch-left': 'left',
    'btn-touch-right': 'right',
    'btn-touch-jump': 'jump',
    'btn-touch-atk': 'attack'
  };

  /**
   * Jump and attack sit close together, and their touch areas reach past the buttons. A touch in
   * either area goes to whichever of the two visible buttons is nearer the finger, and a near tie
   * counts as attack (a stray jump mid-fight hurts more than a stray swing).
   */
  const ACTION_BUTTON_IDS = { jump: 'btn-touch-jump', attack: 'btn-touch-atk' };
  /** Attack wins unless jump is nearer by more than this many CSS pixels. */
  const ATTACK_PREFERENCE_PIXELS = 12;

  /** Distance in CSS pixels from (x, y) to the nearest point of an element's box (0 inside it). */
  function distanceToElement(element, x, y) {
    const box = element.getBoundingClientRect();
    const dx = Math.max(box.left - x, 0, x - box.right);
    const dy = Math.max(box.top - y, 0, y - box.bottom);
    return Math.hypot(dx, dy);
  }

  function nearerOfJumpAndAttack(x, y) {
    const jump = document.getElementById(ACTION_BUTTON_IDS.jump);
    const attack = document.getElementById(ACTION_BUTTON_IDS.attack);
    if (!jump || !attack) return undefined;
    return distanceToElement(jump, x, y) + ATTACK_PREFERENCE_PIXELS < distanceToElement(attack, x, y) ? 'jump' : 'attack';
  }

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
      const action = button ? BUTTON_ACTIONS[button.id] : undefined;
      if (action === 'jump' || action === 'attack') return nearerOfJumpAndAttack(touch.clientX, touch.clientY);
      return action;
    };

    const forgetFinger = identifier => {
      const action = fingerActions.get(identifier);
      if (!action) return;
      fingerActions.delete(identifier);
      if (!isHeldByAnotherFinger(action)) input.release(action);
    };

    /**
     * Browsers sometimes never send the touchend (a system gesture, the notification shade, an app
     * switch). Any finger we still remember that isn't on the screen any more is let go here, so a
     * lost touchend can't leave ◀ or ▶ stuck down.
     */
    const forgetLiftedFingers = event => {
      const onScreen = new Set([...event.touches].map(touch => touch.identifier));
      [...fingerActions.keys()].forEach(identifier => {
        if (!onScreen.has(identifier)) forgetFinger(identifier);
      });
    };

    // Leaving the page releases everything (see InputController), so forget the fingers too
    input.onReleaseAll = () => fingerActions.clear();

    document.addEventListener('touchstart', event => {
      forgetLiftedFingers(event);
      let isOnButton = false;
      for (const touch of event.changedTouches) {
        // A reused identifier whose touchend went missing still holds its old button
        forgetFinger(touch.identifier);
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
      forgetLiftedFingers(event);
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

  /** The ☰ button pauses the game on the main menu (phones have no Esc key). */
  function bindMenuToggle() {
    const toggle = document.getElementById('btn-menu-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      toggle.blur();
      if (Forest.Game) Forest.Game.openMenu();
    });
  }

  /** Height in CSS pixels, from the bottom of the window, that the touch buttons cover (0 when hidden). */
  function coveredBottomPixels() {
    const panel = document.getElementById('touch-controls');
    if (!panel || getComputedStyle(panel).display === 'none') return 0;
    return window.innerHeight - panel.getBoundingClientRect().top;
  }

  Forest.TouchControls = { bind, coveredBottomPixels };
})(window.Forest);
