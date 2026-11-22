/** On-screen DOM interface: hearts, score, points, banners, toasts, and the game over / victory overlays. */
(function (Forest) {
  class Hud {
    constructor() {
      this.heartsElement = document.getElementById('hud-hearts');
      this.scoreElement = document.getElementById('hud-score');
      this.overlayElement = document.getElementById('game-overlay');
      this.bannerElement = document.getElementById('wave-banner');
      this.pointsElement = document.getElementById('hud-points');
      this.toastElement = document.getElementById('species-toast');
      this.lastScoreHtml = null;
      this.lastPointsHtml = null;
    }

    /** Points this run, plus the best for this difficulty. Cheap to call every frame. */
    showPoints(points, bestPoints) {
      const html = `POINTS: ${points.toLocaleString()}<span class="hud-score-detail">BEST: ${bestPoints.toLocaleString()}</span>`;
      if (html === this.lastPointsHtml) return;
      this.lastPointsHtml = html;
      this.pointsElement.innerHTML = html;
    }

    /**
     * Small note at the top of the screen that fades out by itself (e.g. a new scrapbook species).
     * @param {string} title
     * @param {string} detail may contain HTML
     * @param {number} seconds
     */
    showToast(title, detail, seconds) {
      const toast = this.toastElement;
      toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-detail">${detail}</div>`;
      toast.className = '';
      void toast.offsetWidth; // restart the CSS animation
      toast.style.animationDuration = `${seconds}s`;
      toast.className = 'show';
    }

    hideToast() {
      this.toastElement.className = '';
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
      // An empty objective hides its whole card
      this.scoreElement.parentElement.style.display = html ? '' : 'none';
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

    /**
     * The boy was defeated somewhere in a level.
     * @param {() => void} onRetry restart the level
     * @param {{levelLabel:string, points:number, bestPoints:number, isNewBestPoints:boolean}} run
     */
    showGameOver(onRetry, { levelLabel, points, bestPoints, isNewBestPoints }) {
      const message = `The boy fell in ${levelLabel}.<br><br>POINTS: ${points.toLocaleString()}<br>`
        + (isNewBestPoints ? '&#9733; NEW HIGH SCORE! &#9733;' : `HIGH SCORE: ${bestPoints.toLocaleString()}`);
      this.showOverlay({
        variant: 'game-over',
        titleClass: 'text-red',
        title: 'DEFEATED!',
        message,
        buttonLabel: 'PRESS [ R ] TO TRY THE LEVEL AGAIN',
        onRestart: onRetry
      });
    }

    /**
     * Every level and boss beaten.
     * @param {() => void} onPlayAgain
     * @param {{points:number, coins:number, totalCoins:number, bestPoints:number, isNewBestPoints:boolean}} run
     */
    showVictory(onPlayAgain, { points, coins, totalCoins, bestPoints, isNewBestPoints }) {
      const message = 'All three bosses are beaten and the forest is safe again!'
        + `<br><br>COINS: ${coins} / ${totalCoins}<br>POINTS: ${points.toLocaleString()}<br>`
        + (isNewBestPoints ? '&#9733; NEW HIGH SCORE! &#9733;' : `HIGH SCORE: ${bestPoints.toLocaleString()}`);
      this.showOverlay({
        variant: 'victory',
        titleClass: 'text-green',
        title: 'YOU WIN!',
        message,
        buttonLabel: 'PLAY AGAIN',
        onRestart: onPlayAgain
      });
    }

    /**
     * End of a training session.
     * @param {{won:boolean, defeated:number, total:number, points:number,
     *   onRetry:() => void, onLeave:() => void}} result
     */
    showTrainingResult({ won, defeated, total, points, onRetry, onLeave }) {
      const message = (won
        ? `All ${total} training foes defeated!`
        : `The boy fell after defeating ${defeated} of ${total} training foes.`)
        + `<br><br>POINTS: ${points.toLocaleString()}<br>(Training doesn't count towards high scores.)`;
      this.showOverlay({
        variant: won ? 'victory' : 'game-over',
        titleClass: won ? 'text-green' : 'text-red',
        title: won ? 'TRAINING COMPLETE!' : 'TRAINING OVER',
        message,
        buttons: [
          { label: '[ R ] TRAIN AGAIN', onClick: onRetry },
          { label: '🌲 BACK TO ADVENTURE', onClick: onLeave }
        ]
      });
    }

    hideOverlay() {
      this.overlayElement.style.display = 'none';
    }

    /**
     * Pass either `buttonLabel` + `onRestart` for a single button, or `buttons` for several.
     * @param {{variant:string, titleClass:string, title:string, message:string, buttonLabel?:string,
     *   onRestart?:() => void, buttons?:{label:string, onClick:() => void}[]}} overlay
     */
    showOverlay({ variant, titleClass, title, message, buttonLabel, onRestart, buttons }) {
      const buttonList = buttons || [{ label: buttonLabel, onClick: onRestart }];
      this.overlayElement.innerHTML = `
        <div class="overlay-card ${variant}">
          <h1 class="pixel-title ${titleClass}">${title}</h1>
          <p class="pixel-subtitle">${message}</p>
          <div class="overlay-buttons">
            ${buttonList.map(button => `<button class="pixel-btn">${button.label}</button>`).join('')}
          </div>
        </div>
      `;
      this.overlayElement.querySelectorAll('button').forEach((element, index) => {
        element.addEventListener('click', () => {
          element.blur();
          buttonList[index].onClick();
        });
      });
      this.overlayElement.style.display = 'flex';
    }
  }

  Forest.Hud = Hud;
})(window.Forest);
