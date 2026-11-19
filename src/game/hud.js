/** On-screen DOM interface: hearts, score, the live state inspector, and the game over / victory overlays. */
(function (Forest) {
  class Hud {
    constructor() {
      this.heartsElement = document.getElementById('hud-hearts');
      this.scoreElement = document.getElementById('hud-score');
      this.playerStateBadge = document.getElementById('inspector-boy-state');
      this.mushroomStateBadge = document.getElementById('inspector-mushroom-state');
      this.overlayElement = document.getElementById('game-overlay');
      this.bannerElement = document.getElementById('wave-banner');
      this.lastScoreHtml = null;
    }

    showHealth(hp, maxHp) {
      let html = '';
      for (let i = 0; i < maxHp; i++) {
        html += i < hp
          ? '<span class="pixel-heart full">&hearts;</span>'
          : '<span class="pixel-heart empty">&#9825;</span>';
      }
      this.heartsElement.innerHTML = html;
    }

    /**
     * Objective text, with an optional smaller second line.
     * Cheap to call every frame: the DOM is only touched when the text changes.
     */
    showScore(mainLine, detailLine = '') {
      const html = detailLine
        ? `${mainLine}<span class="hud-score-detail">${detailLine}</span>`
        : mainLine;
      if (html === this.lastScoreHtml) return;
      this.lastScoreHtml = html;
      this.scoreElement.innerHTML = html;
    }

    /**
     * Big announcement in the middle of the screen that fades out by itself.
     * @param {object} banner
     * @param {string} banner.title
     * @param {string} banner.subtitle
     * @param {'wave'|'boss'|'cleared'} banner.variant colour scheme
     * @param {number} banner.seconds how long it stays up
     */
    showBanner({ title, subtitle, variant, seconds }) {
      const banner = this.bannerElement;
      banner.innerHTML = `<div class="banner-title">${title}</div><div class="banner-subtitle">${subtitle}</div>`;
      banner.className = '';
      void banner.offsetWidth; // restart the CSS animation
      banner.style.animationDuration = `${seconds}s`;
      banner.className = `show ${variant}`;
    }

    hideBanner() {
      this.bannerElement.className = '';
    }

    /** Show the boy's state and the state of whichever mushroom is closest to him. */
    showInspector(player, mushrooms) {
      setStateBadge(this.playerStateBadge, player.state, player.state);

      const closest = findClosestByX(mushrooms, player.x);
      if (closest) {
        setStateBadge(this.mushroomStateBadge, closest.state, `${closest.state} (HP: ${Math.max(0, closest.hp)})`);
      } else {
        setStateBadge(this.mushroomStateBadge, null, 'NONE');
      }
    }

    /**
     * @param {() => void} onRestart
     * @param {{wave:number, foesDefeated:number, bestWave:number, isNewBest:boolean}} run
     */
    showGameOver(onRestart, { wave, foesDefeated, bestWave, isNewBest }) {
      const message = wave === 0
        ? 'The evil forest mushrooms overwhelmed the boy...'
        : `The boy fell on WAVE ${wave} after defeating ${foesDefeated} foes.<br><br>`
          + (isNewBest ? '&#9733; NEW BEST WAVE! &#9733;' : `BEST: WAVE ${bestWave}`);
      this.showOverlay({
        variant: 'game-over',
        titleClass: 'text-red',
        title: 'DEFEATED!',
        message,
        buttonLabel: 'PRESS [ R ] TO TRY AGAIN',
        onRestart
      });
    }

    hideOverlay() {
      this.overlayElement.style.display = 'none';
    }

    showOverlay({ variant, titleClass, title, message, buttonLabel, onRestart }) {
      this.overlayElement.innerHTML = `
        <div class="overlay-card ${variant}">
          <h1 class="pixel-title ${titleClass}">${title}</h1>
          <p class="pixel-subtitle">${message}</p>
          <button class="pixel-btn">${buttonLabel}</button>
        </div>
      `;
      this.overlayElement.querySelector('button').addEventListener('click', onRestart);
      this.overlayElement.style.display = 'flex';
    }
  }

  /** The badge's colour comes from a CSS class named after the state, e.g. "state-hit_recoil". */
  function setStateBadge(element, state, label) {
    element.textContent = label;
    element.className = state ? `state-badge state-${state.toLowerCase()}` : 'state-badge';
  }

  function findClosestByX(entities, x) {
    let closest = null;
    let closestDistance = Infinity;
    entities.forEach(entity => {
      const distance = Math.abs(entity.x - x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = entity;
      }
    });
    return closest;
  }

  Forest.Hud = Hud;
})(window.Forest);
