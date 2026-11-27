/**
 * Full-screen loading card. It is in index.html from the start, so it shows while the scripts load
 * and paint their sprites (finishBoot hides it), and comes back each time a level is built (run).
 * It also tells the story: the start of a level waits on its story page until the player is ready,
 * and showStory puts up the end-of-level page between levels.
 */
(function (Forest) {
  const screen = document.getElementById('loading-screen');
  const iconElement = document.getElementById('loading-icon');
  const headingElement = document.getElementById('loading-heading');
  const titleElement = document.getElementById('loading-title');
  const subtitleElement = document.getElementById('loading-subtitle');
  const storyElement = document.getElementById('loading-story');
  const barElement = document.getElementById('loading-bar');
  const barFill = document.getElementById('loading-bar-fill');
  const continueButton = document.getElementById('loading-continue');
  const tipElement = document.getElementById('loading-tip');
  const boyCanvas = document.getElementById('loading-boy');

  /** The fade-out at the end, in ms (matches the CSS transition on #loading-screen). */
  const FADE_MS = 350;
  /** After booting, the full bar stays up this long before fading. */
  const BOOT_SETTLE_MS = 300;
  const BOY_FRAME_MS = 110;
  /** The story types itself out, one letter every this many ms. */
  const TYPE_MS_PER_LETTER = 28;
  const TYPE_TICK_MS = 30;
  /** Keys that turn the page of a story (the game's jump and attack keys). */
  const CONTINUE_KEYS = new Set(['Enter', 'Space', 'KeyJ', 'KeyK', 'KeyZ', 'KeyW', 'ArrowUp']);

  const TIPS = [
    'Press jump again in mid-air for a double jump.',
    'Attack while falling to slam down on the creatures below.',
    'Every coin is worth 20 points once the boss is beaten.',
    'Meeting a new species puts it in your scrapbook, and earns points.',
    'Boss fights have three stages, and every stage brings more minions!',
    'Every boss arena has small ledges: get up high to dodge its attacks!',
    'Every boss has its own special power. Watch for the blinking warning!',
    'Hearts picked up at full health turn into bonus points.',
    'You can smash fireballs and lava bombs with your sword.',
    'Ice is slippery: start braking early!',
    'Gravity is weak on the moon. Float across the gaps!',
    'Sandstorm gusts push you around. Time your jumps!',
    'Train against creatures you have met: pick them in the scrapbook.',
    'Press Esc to pause the game.',
    'Cracked stones crumble soon after you land on them. Keep moving!',
    'Spikes rattle in the ground just before they pop up.',
    'Too wide to jump? Wait for a ferry to carry you across.'
  ];

  /** Bumped by every run() and showStory(), so an older load that is still waiting gives up. */
  let loadToken = 0;
  let hideTimer = null;
  let boyTimer = null;
  let isBusy = true; // the boot load is in progress
  /** What the continue button (or a tap, or a key) does while it's showing. */
  let pendingContinue = null;
  /** The story being typed out: its paragraphs and how far it has got (null once it's all shown). */
  let typing = null;

  function randomTip() {
    return `TIP: ${TIPS[Math.floor(Math.random() * TIPS.length)]}`;
  }

  /** Fill in the card. A story (paragraphs) takes the place of the subtitle and the tip. */
  function setText({ icon = '', heading = '', title = '', subtitle = '', note = '', story = null }) {
    iconElement.textContent = icon;
    iconElement.style.display = icon ? '' : 'none';
    headingElement.textContent = heading;
    titleElement.textContent = title;
    subtitleElement.innerHTML = note ? `${subtitle}<br><span class="loading-note">${note}</span>` : subtitle;
    const hasStory = Boolean(story && story.length);
    subtitleElement.style.display = hasStory && !note ? 'none' : '';
    if (hasStory && note) subtitleElement.innerHTML = `<span class="loading-note">${note}</span>`;
    stopTyping();
    storyElement.replaceChildren(...(hasStory ? story.map(text => {
      // Each paragraph is the part typed so far and the rest, which is invisible but already takes
      // its space, so the lines wrap the same as they will in the end and nothing jumps around
      const paragraph = document.createElement('p');
      const typed = document.createElement('span');
      const rest = document.createElement('span');
      rest.className = 'loading-story-rest';
      rest.textContent = text;
      paragraph.append(typed, rest);
      return paragraph;
    }) : []));
    storyElement.style.display = hasStory ? '' : 'none';
    storyElement.scrollTop = 0;
    if (hasStory) startTyping(story);
    tipElement.textContent = hasStory ? '' : randomTip();
    tipElement.style.display = hasStory ? 'none' : '';
  }

  /** Type the story out letter by letter (see setText), scrolling along to keep the newest letters in view. */
  function startTyping(story) {
    const paragraphs = [...storyElement.children].map((element, index) => ({
      text: story[index],
      typed: element.firstChild,
      rest: element.lastChild
    }));
    const total = story.reduce((sum, text) => sum + text.length, 0);
    // Scrolling back up while it types stops it following along
    let follow = true;
    const stopFollowing = () => { follow = false; };
    storyElement.addEventListener('wheel', stopFollowing, { once: true, passive: true });
    storyElement.addEventListener('touchmove', stopFollowing, { once: true, passive: true });
    const startedAt = Date.now();
    typing = {
      paragraphs,
      shown: 0,
      timer: setInterval(() => {
        showLetters(Math.min(total, Math.floor((Date.now() - startedAt) / TYPE_MS_PER_LETTER)), follow);
        if (typing && typing.shown >= total) stopTyping();
      }, TYPE_TICK_MS),
      stopFollowing
    };
  }

  /** Show the first `count` letters of the story. */
  function showLetters(count, follow) {
    if (!typing || count <= typing.shown) return;
    typing.shown = count;
    let left = count;
    let current = null;
    typing.paragraphs.forEach(paragraph => {
      const visible = Math.max(0, Math.min(paragraph.text.length, left));
      left -= visible;
      if (paragraph.typed.textContent.length !== visible) {
        paragraph.typed.textContent = paragraph.text.slice(0, visible);
        paragraph.rest.textContent = paragraph.text.slice(visible);
      }
      if (visible > 0) current = paragraph.typed;
    });
    if (follow && current) keepInView(current);
  }

  /** Scroll the story just enough to show the last line of `element`. */
  function keepInView(element) {
    const lines = element.getClientRects();
    if (!lines.length) return;
    const lastLine = lines[lines.length - 1];
    const box = storyElement.getBoundingClientRect();
    if (lastLine.bottom > box.bottom) storyElement.scrollTop += lastLine.bottom - box.bottom + 2;
  }

  /** Show the whole story at once (a tap or key while it's still typing). */
  function finishTyping() {
    if (!typing) return;
    const total = typing.paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0);
    showLetters(total, false);
    stopTyping();
  }

  function stopTyping() {
    if (!typing) return;
    clearInterval(typing.timer);
    storyElement.removeEventListener('wheel', typing.stopFollowing);
    storyElement.removeEventListener('touchmove', typing.stopFollowing);
    typing = null;
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
    if (boyCanvas) boyCanvas.style.display = 'none';
  }

  /** Fill the bar from empty to full over `seconds` (a transform transition, so it runs even while JS is busy). */
  function animateBar(seconds) {
    barElement.style.display = '';
    barFill.style.transition = 'none';
    barFill.style.transform = 'scaleX(0)';
    void barFill.offsetWidth;
    barFill.style.transition = `transform ${seconds}s cubic-bezier(0.3, 0.6, 0.4, 1)`;
    barFill.style.transform = 'scaleX(1)';
  }

  /** Swap the bar for a button; it, a tap anywhere on the card or a jump/attack key calls `action`. */
  function showContinue(label, action) {
    stopBoy();
    barElement.style.display = 'none';
    continueButton.textContent = label;
    continueButton.style.display = '';
    pendingContinue = action;
  }

  function hideContinue() {
    continueButton.style.display = 'none';
    pendingContinue = null;
  }

  function continueNow() {
    // The first tap (or key) while the story is still typing shows all of it; the next one goes on
    if (typing) {
      finishTyping();
      return;
    }
    const action = pendingContinue;
    if (!action) return;
    hideContinue();
    action();
  }

  function show() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    hideContinue();
    screen.classList.remove('boot', 'hiding');
    screen.style.display = 'flex';
  }

  function hide() {
    hideContinue();
    stopTyping();
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
   * @param {string[]} [options.story] story paragraphs; the screen then waits for the player once loaded
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
    const finish = () => {
      isBusy = false;
      hide();
      if (onReady) onReady();
    };
    // Two frames, so the screen is on the glass before the build blocks the page
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== loadToken) return;
      build();
      const remainingMs = Math.max(0, minSeconds * 1000 - (performance.now() - shownAt));
      setTimeout(() => {
        if (token !== loadToken) return;
        // With a story to read, the level waits until the player says go
        if (text.story && text.story.length) showContinue('▶ START', finish);
        else finish();
      }, remainingMs);
    }));
  }

  /**
   * A story page with a button (e.g. the end of a level). The screen stays up afterwards:
   * `onContinue` usually starts the next run(), or calls hide().
   * @param {{icon?:string, heading?:string, title:string, story:string[], buttonLabel:string, onContinue:() => void}} page
   */
  function showStory({ buttonLabel, onContinue, ...text }) {
    ++loadToken;
    isBusy = true;
    setText(text);
    show();
    stopBoy();
    showContinue(buttonLabel, onContinue);
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

  // A click anywhere on the card turns the page (a click, not a press, so the press can't also
  // reach the game as an attack once it resumes)
  screen.addEventListener('click', continueNow);
  // Caught on the way down, so the key that starts the level doesn't also jump or attack
  window.addEventListener('keydown', event => {
    if ((!pendingContinue && !typing) || !CONTINUE_KEYS.has(event.code) || event.repeat) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    continueNow();
  }, true);

  Forest.LoadingScreen = {
    run,
    showStory,
    finishBoot,
    /** Take the screen away (e.g. after the last story page). */
    hide() {
      ++loadToken;
      isBusy = false;
      hide();
    },
    /** True while the screen is up for a load or a story (the game isn't ready to play). */
    get isBusy() {
      return isBusy;
    }
  };
})(window.Forest);
