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

  /** The ☰ button shows/hides the settings bar (music, sound, CRT, difficulty, gallery) on touch screens. */
  function bindMenuToggle() {
    const toggle = document.getElementById('btn-menu-toggle');
    const bar = document.getElementById('controls-bar');
    if (!toggle || !bar) return;

    toggle.addEventListener('click', () => {
      const open = bar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  Forest.TouchControls = { bind };
})(window.Forest);
