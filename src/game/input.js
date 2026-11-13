/**
 * Maps keyboard/mouse input to named game actions.
 * Other code asks "is `left` held?" or registers callbacks for when an action is pressed/released,
 * without caring which physical key triggered it.
 */
(function (Forest) {
  const KEY_BINDINGS = {
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    KeyW: 'jump',
    ArrowUp: 'jump',
    Space: 'jump',
    KeyJ: 'attack',
    KeyZ: 'attack',
    KeyK: 'attack',
    Enter: 'attack',
    KeyR: 'restart',
    KeyM: 'toggleSound',
    KeyB: 'toggleMusic'
  };

  class InputController {
    /**
     * @param {object} handlers
     * @param {Object<string, Function>} [handlers.onPress] action name -> callback when pressed
     * @param {Object<string, Function>} [handlers.onRelease] action name -> callback when released
     */
    constructor({ onPress = {}, onRelease = {} }) {
      this.onPress = onPress;
      this.onRelease = onRelease;
      this.heldActions = new Set();

      window.addEventListener('keydown', event => {
        if (event.repeat) return;
        const action = KEY_BINDINGS[event.code];
        if (action) this.press(action);
      });

      window.addEventListener('keyup', event => {
        const action = KEY_BINDINGS[event.code];
        if (action) this.release(action);
      });

      // Clicking anywhere on the game (but not on buttons or the HUD) attacks
      window.addEventListener('mousedown', event => {
        if (event.target.tagName === 'BUTTON' || event.target.closest('#hud')) return;
        this.trigger('attack');
      });
    }

    /** Mark an action as held and fire its press callback. Also used by the on-screen touch buttons. */
    press(action) {
      this.heldActions.add(action);
      this.trigger(action);
    }

    release(action) {
      this.heldActions.delete(action);
      const callback = this.onRelease[action];
      if (callback) callback();
    }

    /** Fire an action's press callback without marking it as held. */
    trigger(action) {
      const callback = this.onPress[action];
      if (callback) callback();
    }

    isHeld(action) {
      return this.heldActions.has(action);
    }

    /** -1 for left, 1 for right, 0 for neither (or both). */
    horizontalDirection() {
      return (this.isHeld('right') ? 1 : 0) - (this.isHeld('left') ? 1 : 0);
    }

    isPressingLeftOrRight() {
      return this.isHeld('left') || this.isHeld('right');
    }
  }

  Forest.InputController = InputController;
})(window.Forest);
