// ============================================================
// YRE UI — Phase 2.1 (Accent Border + Fade-in Badge)
// ============================================================

const YRE_UI = {

  createBadge(scoreInfo) {
    const badge = document.createElement('div');
    badge.className = 'yre-badge-container yre-abs-badge';

    // Score color tiers
    let scoreColor;
    if (scoreInfo.score >= 80) scoreColor = '#46D369';       // Green
    else if (scoreInfo.score >= 60) scoreColor = '#F5C518';  // Gold
    else scoreColor = '#E87C03';                              // Amber

    // Set the CSS custom property for the left-accent border
    badge.style.setProperty('--yre-accent', scoreColor);

    // ── Score Line: "87% Match" ──
    const scoreLine = document.createElement('div');
    scoreLine.className = 'yre-score-line';

    const scoreNum = document.createElement('span');
    scoreNum.className = 'yre-score-number';
    scoreNum.textContent = `${scoreInfo.score}%`;
    scoreNum.style.color = scoreColor;

    const matchLabel = document.createElement('span');
    matchLabel.className = 'yre-match-label';
    matchLabel.textContent = ' Match';

    scoreLine.appendChild(scoreNum);
    scoreLine.appendChild(matchLabel);

    // ── Reason Line ──
    const reasonLine = document.createElement('div');
    reasonLine.className = 'yre-reason-line';
    reasonLine.textContent = scoreInfo.reason || '';

    badge.appendChild(scoreLine);
    badge.appendChild(reasonLine);
    badge.title = `${scoreInfo.score}% Match — ${scoreInfo.reason}`;
    return badge;
  },

  injectBadge(cardElement, scoreInfo) {
    if (cardElement.querySelector('.yre-badge-container')) return;

    // Primary: #overlays (YouTube's native overlay container)
    const overlays = cardElement.querySelector('#overlays');
    if (overlays) {
      overlays.appendChild(this.createBadge(scoreInfo));
      cardElement.dataset.yreProcessed = 'true';
      return;
    }

    // Fallback 1: ytd-thumbnail
    const thumb = cardElement.querySelector('ytd-thumbnail, #thumbnail, a#thumbnail');
    if (thumb) {
      thumb.appendChild(this.createBadge(scoreInfo));
      cardElement.dataset.yreProcessed = 'true';
      return;
    }

    // Fallback 2: #details (inline badge, no overlay)
    const details = cardElement.querySelector('#details, .details');
    if (details) {
      const badge = this.createBadge(scoreInfo);
      badge.classList.remove('yre-abs-badge');
      badge.classList.add('yre-inline-badge');
      details.appendChild(badge);
      cardElement.dataset.yreProcessed = 'true';
      return;
    }

    // Fallback 3: Direct append
    const badge = this.createBadge(scoreInfo);
    badge.style.position = 'absolute';
    badge.style.top = '8px';
    badge.style.right = '8px';
    cardElement.appendChild(badge);
    cardElement.dataset.yreProcessed = 'true';
  },

  clearAllBadges() {
    document.querySelectorAll('.yre-badge-container').forEach(b => b.remove());
    document.querySelectorAll('[data-yre-processed]').forEach(el => {
      delete el.dataset.yreProcessed;
    });
  },

  updateBadge(cardElement, aiScoreInfo) {
    const badge = cardElement.querySelector('.yre-badge-container');
    if (!badge) return;

    let scoreColor;
    if (aiScoreInfo.score >= 80) scoreColor = '#46D369';       // Green
    else if (aiScoreInfo.score >= 60) scoreColor = '#F5C518';  // Gold
    else scoreColor = '#E87C03';                              // Amber

    badge.style.setProperty('--yre-accent', scoreColor);

    const scoreNum = badge.querySelector('.yre-score-number');
    if (scoreNum) {
      scoreNum.textContent = `${aiScoreInfo.score}%`;
      scoreNum.style.color = scoreColor;
    }

    const reasonLine = badge.querySelector('.yre-reason-line');
    if (reasonLine) {
      reasonLine.textContent = aiScoreInfo.reason;
    }

    badge.title = `${aiScoreInfo.score}% Match — ${aiScoreInfo.reason}`;
    badge.classList.add('yre-ai-upgraded'); // Apply a CSS animation if desired
  }
};

window.YRE_UI = YRE_UI;
