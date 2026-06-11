// Interactive first-run tutorial: a spotlight ring + instruction card that
// walks the player through the core loop by pointing at the real UI.
// Click-to-advance steps move on when the highlighted element is clicked;
// every step also has Next/Skip so nothing can soft-lock.

interface TutStep {
  text: string;
  target?: string;       // CSS selector to spotlight; omit = centered card
  advanceOnClick?: boolean;
}

const DONE_KEY = 'sevenSeasIdle.tutorialDone';

const STEPS: TutStep[] = [
  {
    text: 'Ahoy, Captain! ⚓ You start with a leaky raft, one loyal crewman and 10 gold. This quick tour shows you the ropes — under a minute, promise.',
  },
  {
    target: '[data-action="act:sail"]',
    advanceOnClick: true,
    text: 'Everything runs on activities — your crew focuses on one at a time. Click ⛵ Sail to start earning gold and supplies.',
  },
  {
    target: '#goal-box',
    text: 'These are your Goals: five paths (combat, exploration, wealth, fleet, legend), all open at once. Hover any goal for a hint. Chase whichever fits your mood.',
  },
  {
    target: '[data-action="tab:port"]',
    advanceOnClick: true,
    text: 'Open the Port tab. Buildings give permanent bonuses — a Dock costs just 50 gold, and the Tavern brews the rum your crew drinks to stay happy.',
  },
  {
    target: '[data-action="tab:bounties"]',
    text: 'The Bounty Board is your measuring stick: 8 bosses in rising order. When your victory chance looks good, strike — each kill grants a permanent bonus.',
  },
  {
    target: '#activity-box',
    text: 'Your current focus, its earnings per second and progress live here. Switch activities anytime — port buildings, trade routes and taverns keep producing regardless.',
  },
  {
    text: 'That’s the ropes! The game autosaves every 5 seconds and keeps progressing up to 12 hours while you’re away. Fair winds, Captain! 🏴‍☠️',
  },
];

let idx = 0;
let active = false;
let highlight: HTMLElement;
let card: HTMLElement;
let posTimer: number | undefined;

function position(): void {
  const step = STEPS[idx];
  const target = step?.target ? document.querySelector<HTMLElement>(step.target) : null;
  if (target) {
    const r = target.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = `${r.left - 7}px`;
    highlight.style.top = `${r.top - 7}px`;
    highlight.style.width = `${r.width + 14}px`;
    highlight.style.height = `${r.height + 14}px`;

    // Card beside the target: prefer right, then left, then below.
    const cw = card.offsetWidth || 300;
    const ch = card.offsetHeight || 140;
    let x = r.right + 18;
    let y = r.top;
    if (x + cw > window.innerWidth - 10) x = r.left - cw - 18;
    if (x < 10) { x = Math.min(Math.max(10, r.left), window.innerWidth - cw - 10); y = r.bottom + 16; }
    if (y + ch > window.innerHeight - 10) y = window.innerHeight - ch - 10;
    card.style.left = `${Math.max(10, x)}px`;
    card.style.top = `${Math.max(10, y)}px`;
  } else {
    highlight.style.display = 'none';
    card.style.left = `${(window.innerWidth - (card.offsetWidth || 320)) / 2}px`;
    card.style.top = `${(window.innerHeight - (card.offsetHeight || 150)) / 2}px`;
  }
}

function render(): void {
  const step = STEPS[idx];
  const last = idx === STEPS.length - 1;
  card.innerHTML = `
    <div class="tut-step">Step ${idx + 1} of ${STEPS.length}</div>
    <div class="tut-text">${step.text}</div>
    ${step.advanceOnClick ? '<div class="tut-hint">👉 Click the highlighted element to continue</div>' : ''}
    <div class="tut-buttons">
      <button class="btn small" id="tut-skip">Skip tour</button>
      <button class="btn small primary" id="tut-next">${last ? '⚓ Set sail!' : 'Next ▸'}</button>
    </div>`;
  card.querySelector('#tut-skip')!.addEventListener('click', finish);
  card.querySelector('#tut-next')!.addEventListener('click', next);
  position();
}

function next(): void {
  idx++;
  if (idx >= STEPS.length) finish();
  else render();
}

function finish(): void {
  active = false;
  highlight.style.display = 'none';
  card.style.display = 'none';
  if (posTimer !== undefined) clearInterval(posTimer);
  localStorage.setItem(DONE_KEY, '1');
}

function start(): void {
  idx = 0;
  active = true;
  highlight.style.display = 'none';
  card.style.display = 'block';
  if (posTimer !== undefined) clearInterval(posTimer);
  posTimer = window.setInterval(() => { if (active) position(); }, 200);
  render();
}

export function initTutorial(): void {
  highlight = document.createElement('div');
  highlight.id = 'tut-highlight';
  card = document.createElement('div');
  card.id = 'tut-card';
  card.style.display = 'none';
  document.body.append(highlight, card);

  // Click-to-advance: watch real clicks on the highlighted element.
  document.addEventListener('click', (e) => {
    if (!active) return;
    const step = STEPS[idx];
    if (step?.advanceOnClick && step.target && (e.target as HTMLElement).closest?.(step.target)) {
      setTimeout(next, 250); // let the game UI react first
    }
  }, true);

  document.getElementById('btn-help')?.addEventListener('click', start);

  if (!localStorage.getItem(DONE_KEY)) start();
}
