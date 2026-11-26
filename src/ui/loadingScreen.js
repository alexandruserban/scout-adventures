/**
 * Full-screen loading card. It is in index.html from the start, so it shows while the scripts load
 * and paint their sprites (finishBoot hides it), and comes back each time a level is built (run).
 */
(function (Forest) {
  const screen = document.getElementById('loading-screen');
  const iconElement = document.getElementById('loading-icon');
  const headingElement = document.getElementById('loading-heading');
  const titleElement = document.getElementById('loading-title');
  const subtitleElement = document.getElementById('loading-subtitle');
  const barFill = document.getElementById('loading-bar-fill');
  const tipElement = document.getElementById('loading-tip');
  const boyCanvas = document.getElementById('loading-boy');

  /** The fade-out at the end, in ms (matches the CSS transition on #loading-screen). */
  const FADE_MS = 350;
  /** After booting, the full bar stays up this long before fading. */
  const BOOT_SETTLE_MS = 300;
  const BOY_FRAME_MS = 110;

  const TIPS = [
    'Press jump again in mid-air for a double jump.',
    'Attack while falling to slam down on the creatures below.',
    'Every coin is worth 20 points once the boss is beaten.',
    'Meeting a new species puts it in your scrapbook, and earns points.',
    'Bosses fly into a rage at half health. Watch out for their helpers!',
    'A boss too big to jump over gets ledges in its arena.',
    'Hearts picked up at full health turn into bonus points.',
    'You can smash fireballs and lava bombs with your sword.',
    'Ice is slippery: start braking early!',
    'Gravity is weak on the moon. Float across the gaps!',
    'Sandstorm gusts push you around. Time your jumps!',
    'Train against creatures you have met: pick them in the scrapbook.'
  ];

  /** Bumped by every run(), so an older load that is still waiting gives up. */
  let loadToken = 0;
  let hideTimer = null;
  let boyTimer = null;
  let isBusy = true; // the boot load is in progress

  function randomTip() {
    return `TIP: ${TIPS[Math.floor(Math.random() * TIPS.length)]}`;
  }

  function setText({ icon = '', heading = '', title = '', subtitle = '', note = '' }) {
    iconElement.textContent = icon;
    iconElement.style.display = icon ? '' : 'none';
    headingElement.textContent = heading;
    titleElement.textContent = title;
    subtitleElement.innerHTML = note ? `${subtitle}<br><span class="loading-note">${note}</span>` : subtitle;
    tipElement.textContent = randomTip();
  }

  /** The boy walks on the spot while a level loads (his sprites only exist once the art has loaded). */
  function startBoy() {
    stopBoy();
    const frames = Forest.BoySprites && Forest.BoySprites.walk;
    if (!frames || !frames.length || !boyCanvas) return;
    const context = boyCanvas.getContext('2d');
    boyCanvas.width = frames[0].width;
    boyCanvas.height = frames[0].height;
    boyCanvas.style.display = '';
    let frame = 0;
    const draw = () => {
      context.clearRect(0, 0, boyCanvas.width, boyCanvas.height);
      context.drawImage(frames[frame % frames.length], 0, 0);
      frame++;
    };
    draw();
    boyTimer = setInterval(draw, BOY_FRAME_MS);
  }

  function stopBoy() {
    if (boyTimer) clearInterval(boyTimer);
    boyTimer = null;
  }

  /** Fill the bar from empty to full over `seconds` (a transform transition, so it runs even while JS is busy). */
  function animateBar(seconds) {
    barFill.style.transition = 'none';
    barFill.style.transform = 'scaleX(0)';
    void barFill.offsetWidth;
    barFill.style.transition = `transform ${seconds}s cubic-bezier(0.3, 0.6, 0.4, 1)`;
    barFill.style.transform = 'scaleX(1)';
  }

  function show() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    screen.classList.remove('boot', 'hiding');
    screen.style.display = 'flex';
  }

  function hide() {
    screen.classList.add('hiding');
    hideTimer = setTimeout(() => {
      screen.style.display = 'none';
      screen.classList.remove('hiding');
      stopBoy();
    }, FADE_MS);
  }

  /**
   * Show the loading screen, build the level behind it, and take it away again.
   * @param {object} options
   * @param {string} [options.icon] the world's emoji
   * @param {string} [options.heading] small line above the title, e.g. "LEVEL 3"
   * @param {string} options.title the world's name
   * @param {string} [options.subtitle] its flavour text
   * @param {string} [options.note] an extra highlighted line (e.g. a difficulty change)
   * @param {number} [options.minSeconds] the screen stays up at least this long
   * @param {() => void} options.build does the (synchronous) work; runs once the screen is painted
   * @param {() => void} [options.onReady] called as the screen starts fading out
   */
  function run({ minSeconds = 1.5, build, onReady, ...text }) {
    const token = ++loadToken;
    isBusy = true;
    setText(text);
    show();
    startBoy();
    animateBar(minSeconds);
    const shownAt = performance.now();
    // Two frames, so the screen is on the glass before the build blocks the page
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== loadToken) return;
      build();
      const remainingMs = Math.max(0, minSeconds * 1000 - (performance.now() - shownAt));
      setTimeout(() => {
        if (token !== loadToken) return;
        isBusy = false;
        hide();
        if (onReady) onReady();
      }, remainingMs);
    }));
  }

  /** Everything has loaded: fill the bar, then fade out and call `onDone`. */
  function finishBoot(onDone) {
    // Carry on from wherever the boot animation got to
    barFill.style.transform = getComputedStyle(barFill).transform;
    screen.classList.remove('boot');
    void barFill.offsetWidth;
    barFill.style.transition = 'transform 0.25s ease-out';
    barFill.style.transform = 'scaleX(1)';
    tipElement.textContent = 'READY!';
    setTimeout(() => {
      isBusy = false;
      hide();
      if (onDone) onDone();
    }, BOOT_SETTLE_MS);
  }

  Forest.LoadingScreen = {
    run,
    finishBoot,
    /** True while a load is in progress (the screen is up and the level isn't ready yet). */
    get isBusy() {
      return isBusy;
    }
  };
})(window.Forest);
