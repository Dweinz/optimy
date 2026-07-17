// Mobile touch helpers: persistent tap-to-show tooltips and removal of
// hover-flash side-effects on touch devices.
//
// The CSS [data-tip]:hover::after tooltip vanishes instantly on mobile
// (hover fires then clears on touchend). Instead we create one persistent
// floating <div> and reposition it on each tap, keeping it visible for 3 s
// or until the user taps elsewhere.

export function initTouch(): void {
  if (!('ontouchstart' in window)) return; // desktop keeps CSS hover tooltips

  const tip = document.createElement('div');
  tip.id = 'mobile-tip';
  document.body.appendChild(tip);

  let current: Element | null = null;
  let dismissTimer = 0;

  function dismiss(): void {
    current = null;
    tip.classList.remove('visible');
    clearTimeout(dismissTimer);
  }

  document.addEventListener('touchstart', (e) => {
    const el = (e.target as Element).closest('[data-tip]');

    // Tap outside any data-tip element → hide
    if (!el) { dismiss(); return; }

    // Same element tapped again → hide (toggle off)
    if (el === current) { dismiss(); return; }

    // New element → show tooltip above it
    clearTimeout(dismissTimer);
    current = el;
    tip.textContent = el.getAttribute('data-tip') ?? '';

    // Position: centred above the tapped element, clamped inside viewport
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const idealLeft = cx - tip.offsetWidth / 2;
    const clampedLeft = Math.max(8, Math.min(idealLeft, window.innerWidth - tip.offsetWidth - 8));

    tip.style.left = `${clampedLeft}px`;
    tip.style.top  = `${r.top + window.scrollY - 8}px`; // will be pulled up by CSS transform
    tip.classList.add('visible');

    dismissTimer = window.setTimeout(dismiss, 3000);
  }, { passive: true });
}
