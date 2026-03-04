/**
 * Trekk-animasjoner for presentasjonsvinduet.
 * Alle funksjoner er rent DOM-baserte, ingen state-avhengighet.
 */

/**
 * Kjør "trekke"-animasjon: en elev om gangen flyr til sin pult.
 *
 * @param {Array} assignments - [{ studentName, deskEl }] — rekkefølge for trekking
 * @param {Object} opts
 * @param {number} opts.delayBetween  - ms mellom hvert trekk (default 1200)
 * @param {Function} opts.onComplete  - kalt når alle er plassert
 * @returns {{ next: Function, showAll: Function, cancel: Function }}
 */
export function createDrawAnimation(assignments, opts = {}) {
  const { delayBetween = 1200, onComplete = () => {} } = opts;
  let idx = 0;
  let timer = null;
  let cancelled = false;

  function revealStudent(assignment) {
    const { studentName, deskEl } = assignment;
    const nameEls = deskEl.querySelectorAll('.student-name');
    nameEls.forEach(el => {
      el.classList.add('anim-fly-in');
      el.style.opacity = '0';
      el.style.transform = 'scale(2.5) translateY(-30px)';
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.4s ease, transform 0.5s ease';
        el.style.opacity = '1';
        el.style.transform = 'scale(1) translateY(0)';
      });
    });
  }

  function next() {
    if (idx >= assignments.length) return;
    revealStudent(assignments[idx]);
    idx++;
    if (idx >= assignments.length) onComplete();
  }

  function autoPlay() {
    if (cancelled || idx >= assignments.length) return;
    next();
    if (idx < assignments.length) {
      timer = setTimeout(autoPlay, delayBetween);
    }
  }

  function showAll() {
    cancel();
    assignments.slice(idx).forEach(a => revealStudent(a));
    idx = assignments.length;
    onComplete();
  }

  function cancel() {
    cancelled = true;
    if (timer) clearTimeout(timer);
  }

  return { next, showAll, cancel, autoPlay };
}

/**
 * Shuffle-animasjon: viser elever som "blandes" med hurtig
 * navne-veksling på pultene før endelig plassering.
 *
 * @param {HTMLElement} container - canvas-elementet
 * @param {number} duration - ms total varighet (default 2000)
 * @param {Function} onComplete
 */
export function shuffleAnimation(container, duration = 2000, onComplete = () => {}) {
  const nameEls = [...container.querySelectorAll('.student-name')];
  const names = nameEls.map(el => el.textContent);

  if (names.length === 0) { onComplete(); return; }

  const start = performance.now();
  const shuffledNames = [...names].sort(() => Math.random() - 0.5);

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);

    // Hurtig veksling tidlig, roer seg mot slutten
    const interval = 50 + progress * 300;
    nameEls.forEach((el, i) => {
      if (Math.random() < 0.5) {
        el.textContent = names[Math.floor(Math.random() * names.length)];
      }
    });

    if (progress < 1) {
      setTimeout(() => requestAnimationFrame(tick), interval);
    } else {
      // Sett endelige navn
      nameEls.forEach((el, i) => { el.textContent = shuffledNames[i] ?? names[i]; });
      onComplete();
    }
  }

  requestAnimationFrame(tick);
}
