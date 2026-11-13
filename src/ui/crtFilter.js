/** Toggles the retro CRT scanline overlay. */
(function () {
  const scanlines = document.getElementById('scanline-filter');
  const button = document.getElementById('btn-crt');

  button.addEventListener('click', () => {
    const isHidden = scanlines.style.display === 'none';
    scanlines.style.display = isHidden ? 'block' : 'none';
    button.textContent = isHidden ? '📺 CRT: ON' : '📺 CRT: OFF';
  });
})();
