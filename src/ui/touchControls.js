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

      const press = event => {
        event.preventDefault();
        input.press(action);
      };
      const release = event => {
        event.preventDefault();
        input.release(action);
      };

      button.addEventListener('touchstart', press);
      button.addEventListener('touchend', release);
      button.addEventListener('mousedown', press);
      button.addEventListener('mouseup', release);
    });
  }

  Forest.TouchControls = { bind };
})(window.Forest);
