// Interactive first-run tutorial: a spotlight ring + instruction card that
// teaches the logistics loop by pointing at the real UI. Click-to-advance
// steps move on when the highlighted element is clicked; every step also
// has Next/Skip so nothing can soft-lock.

interface TutStep {
  text: string;
  target?: string;       // CSS selector to spotlight; omit = centered card
  advanceOnClick?: boolean;
}

const DONE_KEY = 'pirateLogistics.tutorialDone';

const STEPS: TutStep[] = [
  {
    text: 'Welcome, Quartermaster! 🏴‍☠️ This is a real-time logistics game: you design production chains and shipping routes, then watch the system run. Quick tour — under a minute.',
  },
  {
    target: '[data-action="build:woodCamp"]',
    advanceOnClick: true,
    text: 'Home Haven is selected. Click to build a Wood Camp. Important: construction is paid from THIS island’s storage — moving materials around is the whole game.',
  },
  {
    target: '[data-action="build:farm"]',
    advanceOnClick: true,
    text: 'Now a Farm. Your crew eat food and drink rum from their own island’s stores — a starving island works at half speed, and sober crews mutiny.',
  },
  {
    target: '[data-action="exp:explore"]',
    text: 'Expeditions lift the fog of war. With an idle ship, 3 crew, 10 food and 3 rum you can chart new islands — you’ll need one with iron deposits soon.',
  },
  {
    target: '[data-action="panel:routes"]',
    advanceOnClick: true,
    text: 'Open the Routes panel. Routes are your conveyor belts: each moves ONE resource from island to island with assigned ships. Colonize a second island, then connect them.',
  },
  {
    target: '[data-action="panel:production"]',
    advanceOnClick: true,
    text: 'The Production panel is your best friend: rates per minute, net surplus or deficit, and a bottleneck report naming each stalled building and exactly why it’s stuck.',
  },
  {
    target: '#speed-controls',
    text: 'Pause ⏸ to plan, 4× to let your machine hum. The world only moves while the game is open — no offline surprises.',
  },
  {
    text: 'You’re ready! The path: Wood Camp + Farm + Tavern → explore for iron → Smelter → Shipyard → ships → empire. Watch the bottlenecks. Good luck! ⚓',
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
      <button class="btn small primary" id="tut-next">${last ? '⚓ Take the helm!' : 'Next ▸'}</button>
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

  document.addEventListener('click', (e) => {
    if (!active) return;
    const step = STEPS[idx];
    if (step?.advanceOnClick && step.target && (e.target as HTMLElement).closest?.(step.target)) {
      setTimeout(next, 250);
    }
  }, true);

  document.getElementById('btn-help')?.addEventListener('click', start);

  if (!localStorage.getItem(DONE_KEY)) start();
}
