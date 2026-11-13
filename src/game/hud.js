/** On-screen DOM interface: hearts, score, the live state inspector, and the game over / victory overlays. */
(function (Forest) {
  class Hud {
    constructor() {
      this.heartsElement = document.getElementById('hud-hearts');
      this.scoreElement = document.getElementById('hud-score');
      this.playerStateBadge = document.getElementById('inspector-boy-state');
      this.mushroomStateBadge = document.getElementById('inspector-mushroom-state');
      this.overlayElement = document.getElementById('game-overlay');
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

    showScore(defeatedCount, totalCount) {
      this.scoreElement.textContent = `MUSHROOMS DEFEATED: ${defeatedCount} / ${totalCount}`;
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

    showGameOver(onRestart) {
      this.showOverlay({
        variant: 'game-over',
        titleClass: 'text-red',
        title: 'DEFEATED!',
        message: 'The evil forest mushrooms overwhelmed the boy...',
        buttonLabel: 'PRESS [ R ] TO TRY AGAIN',
        onRestart
      });
    }

    showVictory(onRestart) {
      this.showOverlay({
        variant: 'victory',
        titleClass: 'text-green',
        title: 'FOREST CLEARED!',
        message: 'All evil mushrooms have been vanquished! The ancient forest is safe!',
        buttonLabel: 'PRESS [ R ] TO PLAY AGAIN',
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
