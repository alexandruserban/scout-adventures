/** Toolbar button that cycles the difficulty: EASY -> NORMAL -> HARD. */
(function (Forest) {
  const { Difficulty } = Forest;
  const button = document.getElementById('btn-difficulty');

  const ICONS = { EASY: '🌱', NORMAL: '⚔️', HARD: '💀' };

  function showLevel(level) {
    button.textContent = `${ICONS[level.id]} ${level.label}`;
    button.dataset.level = level.id;
  }

  button.addEventListener('click', () => Difficulty.cycle());
  Difficulty.onChange(showLevel);
  showLevel(Difficulty.current);
})(window.Forest);
