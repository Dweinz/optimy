// Random events with player choices. One pending event at a time; the UI
// shows a modal and calls resolveEventChoice.

import type { GameState, GameEventDef } from './types';
import { fmt } from './data';
import { hireCrewMember, loseCrewMember, averageMorale } from './crew';
import { grantMap } from './treasure';
import { tryFindRelic } from './relics';
import { gainXp } from './skills';
import { notify, logEvent } from './notifications';
import { forceStorm } from './threeScene';

let pendingEvent: GameEventDef | null = null;

export function getPendingEvent(): GameEventDef | null {
  return pendingEvent;
}

function scale(s: GameState, base: number): number {
  // Event rewards scale with progression so events stay relevant.
  return Math.floor(base * (1 + Math.sqrt(s.stats.totalGold / 500)));
}

export const EVENTS: GameEventDef[] = [
  {
    id: 'storm', name: 'Storm Front', icon: '⛈️', weight: 10,
    desc: 'Black clouds boil on the horizon. The crew looks to you, captain.',
    choices: [
      {
        label: 'Sail through it', hint: 'Risky: damage vs. great sailing experience',
        apply: (s) => {
          if (Math.random() < 0.5) {
            gainXp(s, 'sailing', 300);
            gainXp(s, 'navigation', 200);
            return 'You ride the storm like a legend! Massive Sailing and Navigation XP.';
          }
          const lost = Math.min(s.resources.supplies, scale(s, 30));
          s.resources.supplies -= lost;
          loseCrewMember(s, 'swept overboard in the storm');
          return `The storm batters your fleet. Lost ${fmt(lost)} supplies and a crew member.`;
        },
      },
      {
        label: 'Take shelter', hint: 'Safe: small supply cost',
        apply: (s) => {
          const lost = Math.min(s.resources.supplies, scale(s, 8));
          s.resources.supplies -= lost;
          return `You wait it out in a cove. Lost ${fmt(lost)} supplies, but everyone is safe.`;
        },
      },
    ],
  },
  {
    id: 'mutiny', name: 'Rumblings of Mutiny', icon: '🗡️', weight: 6,
    desc: 'Whispers below deck. Some of the crew question your leadership.',
    choices: [
      {
        label: 'Raise wages', hint: 'Costs gold, restores morale',
        apply: (s) => {
          const cost = scale(s, 40);
          if (s.resources.gold >= cost) {
            s.resources.gold -= cost;
            s.crewMembers.forEach(m => { m.morale = Math.min(100, m.morale + 20); m.loyalty = Math.min(100, m.loyalty + 10); });
            return `You pay ${fmt(cost)} gold in bonuses. Morale and loyalty surge.`;
          }
          loseCrewMember(s, 'walked out over unpaid wages');
          return 'Your purse is empty — a crew member deserts in disgust.';
        },
      },
      {
        label: 'Make an example', hint: 'Lose a crew member, others fall in line',
        apply: (s) => {
          loseCrewMember(s, 'made an example of');
          s.crewMembers.forEach(m => { m.loyalty = Math.min(100, m.loyalty + 15); m.morale = Math.max(5, m.morale - 10); });
          gainXp(s, 'crewManagement', 150);
          return 'Harsh, but effective. Loyalty rises while morale dips. Crew Management XP gained.';
        },
      },
      {
        label: 'Talk it out', hint: 'Diplomacy check — morale-based',
        apply: (s) => {
          if (averageMorale(s) > 55 || Math.random() < 0.4) {
            gainXp(s, 'diplomacy', 250);
            s.crewMembers.forEach(m => { m.loyalty = Math.min(100, m.loyalty + 8); });
            return 'Your words land true. The grumbling fades. Diplomacy XP gained.';
          }
          loseCrewMember(s, 'led a failed mutiny');
          return 'The talks collapse — the ringleader is cast off in a rowboat.';
        },
      },
    ],
  },
  {
    id: 'merchantFleet', name: 'Merchant Fleet Sighted', icon: '🚢', weight: 9,
    desc: 'A fat merchant fleet wallows past, low in the water with cargo.',
    choices: [
      {
        label: 'Attack!', hint: 'Plunder gold and goods, gain notoriety',
        apply: (s) => {
          const gold = scale(s, 60);
          s.resources.gold += gold; s.stats.totalGold += gold;
          s.resources.tradeGoods += scale(s, 5);
          s.resources.reputation += 5;
          gainXp(s, 'plundering', 200);
          return `You strike fast! +${fmt(gold)} gold, goods, and reputation.`;
        },
      },
      {
        label: 'Trade with them', hint: 'Safe profit and Trading XP',
        apply: (s) => {
          const gold = scale(s, 30);
          s.resources.gold += gold; s.stats.totalGold += gold;
          gainXp(s, 'trading', 250);
          return `A fair exchange: +${fmt(gold)} gold and Trading XP.`;
        },
      },
    ],
  },
  {
    id: 'navyPatrol', name: 'Navy Patrol', icon: '⚓', weight: 8,
    desc: 'A royal navy patrol is sweeping these waters, flags snapping.',
    choices: [
      {
        label: 'Flee', hint: 'Lose some progress, stay safe',
        apply: (s) => {
          s.exploreProgress = Math.max(0, s.exploreProgress - 10);
          gainXp(s, 'sailing', 120);
          return 'You slip away through the shallows. Sailing XP for the daring escape.';
        },
      },
      {
        label: 'Bribe them', hint: 'Costs gold, gains influence',
        apply: (s) => {
          const cost = scale(s, 50);
          if (s.resources.gold >= cost) {
            s.resources.gold -= cost;
            s.resources.influence += 8;
            return `${fmt(cost)} gold changes hands. The captain becomes a useful friend (+influence).`;
          }
          loseCrewMember(s, 'arrested by the navy');
          return 'No coin for bribes — they press one of your crew into service.';
        },
      },
      {
        label: 'Fight!', hint: 'Naval combat XP, risky',
        apply: (s) => {
          if (Math.random() < 0.45) {
            const gold = scale(s, 90);
            s.resources.gold += gold; s.stats.totalGold += gold;
            s.resources.reputation += 15;
            gainXp(s, 'navalCombat', 350);
            return `Cannons roar — the patrol strikes its colors! +${fmt(gold)} gold and reputation.`;
          }
          loseCrewMember(s, 'fell to navy guns');
          s.resources.supplies = Math.max(0, s.resources.supplies - scale(s, 15));
          gainXp(s, 'navalCombat', 100);
          return 'A bloody exchange. You limp away with losses but learn from the fight.';
        },
      },
    ],
  },
  {
    id: 'kraken', name: 'Kraken Sighting', icon: '🐙', weight: 4,
    desc: 'Tentacles the size of masts breach the swell. The sea itself shudders.',
    choices: [
      {
        label: 'Study it', hint: 'Cursed Lore XP and knowledge',
        apply: (s) => {
          s.resources.knowledge += scale(s, 10);
          gainXp(s, 'cursedLore', 300);
          return 'You sketch the beast from a safe distance. Knowledge and Cursed Lore XP.';
        },
      },
      {
        label: 'Harvest a tooth', hint: 'Very risky — relic chance',
        apply: (s) => {
          if (Math.random() < 0.3) {
            const r = tryFindRelic(s);
            s.resources.cursedRelics += 3;
            return r ? 'Madness — and it works! You pry loose a relic of the deep!' : 'You claim cursed fragments from the beast! +3 cursed relics.';
          }
          loseCrewMember(s, 'taken by the kraken');
          return 'The kraken takes its toll. A brave soul is dragged below.';
        },
      },
      {
        label: 'Flee immediately', hint: 'Completely safe',
        apply: (s) => {
          gainXp(s, 'sailing', 80);
          return 'You crowd every sail and live to tell the tale.';
        },
      },
    ],
  },
  {
    id: 'lostTreasure', name: 'Floating Wreckage', icon: '🪵', weight: 9,
    desc: 'Debris from a recent wreck bobs ahead — and something glints among it.',
    choices: [
      {
        label: 'Salvage it', hint: 'Gold and maybe a map',
        apply: (s) => {
          const gold = scale(s, 40);
          s.resources.gold += gold; s.stats.totalGold += gold;
          if (Math.random() < 0.4) { grantMap(s); return `+${fmt(gold)} gold — and a map sealed in a bottle!`; }
          return `You haul aboard ${fmt(gold)} gold worth of salvage.`;
        },
      },
      {
        label: 'Search for survivors', hint: 'Maybe gain crew and reputation',
        apply: (s) => {
          s.resources.reputation += 10;
          const m = hireCrewMember(s, true);
          if (m) return `You pull ${m.name} from the water — they join your crew! +reputation.`;
          return 'No survivors, but word of your mercy spreads. +reputation.';
        },
      },
    ],
  },
  {
    id: 'brawl', name: 'Drunken Brawl', icon: '🍺', weight: 8,
    desc: 'A tavern brawl erupts around your crew. Chairs are already airborne.',
    choices: [
      {
        label: 'Join in!', hint: 'Morale up, small costs',
        apply: (s) => {
          const cost = scale(s, 10);
          s.resources.gold = Math.max(0, s.resources.gold - cost);
          s.crewMembers.forEach(m => { m.morale = Math.min(100, m.morale + 15); });
          gainXp(s, 'tavernKeeping', 120);
          return `Glorious chaos! Damages cost ${fmt(cost)} gold but morale soars.`;
        },
      },
      {
        label: 'Drag your crew out', hint: 'Safe, slight morale dip',
        apply: (s) => {
          s.crewMembers.forEach(m => { m.morale = Math.max(5, m.morale - 5); });
          gainXp(s, 'crewManagement', 100);
          return 'You haul them out by their collars. They sulk, but stay out of jail.';
        },
      },
    ],
  },
  {
    id: 'smugglerContact', name: 'Smuggler Contact', icon: '🌑', weight: 7,
    desc: 'A hooded figure offers a "business opportunity" — no questions asked.',
    choices: [
      {
        label: 'Take the job', hint: 'Gold and Smuggling XP, small risk',
        apply: (s) => {
          if (Math.random() < 0.75) {
            const gold = scale(s, 70);
            s.resources.gold += gold; s.stats.totalGold += gold;
            s.stats.smuggleRuns++;
            gainXp(s, 'smuggling', 250);
            return `The cargo moves quietly. +${fmt(gold)} gold and Smuggling XP.`;
          }
          const fine = Math.floor(s.resources.gold * 0.1);
          s.resources.gold -= fine;
          return `A setup! You bribe your way out for ${fmt(fine)} gold.`;
        },
      },
      {
        label: 'Decline politely', hint: 'Gain a little influence',
        apply: (s) => {
          s.resources.influence += 3;
          return 'You decline, but the contact respects your caution. +influence.';
        },
      },
    ],
  },
  {
    id: 'mapFragment', name: 'Treasure Map Fragment', icon: '🗺️', weight: 7,
    desc: 'A dying sailor presses a torn map corner into your hand.',
    choices: [
      {
        label: 'Buy the other half', hint: 'Costs gold for a guaranteed map',
        apply: (s) => {
          const cost = scale(s, 35);
          if (s.resources.gold >= cost) {
            s.resources.gold -= cost;
            grantMap(s);
            return `${fmt(cost)} gold buys the missing half. A complete map is yours!`;
          }
          return 'You cannot afford the other half. The fragment is worthless alone.';
        },
      },
      {
        label: 'Research it yourself', hint: 'Cartography XP, chance of a map',
        apply: (s) => {
          gainXp(s, 'cartography', 200);
          if (Math.random() < 0.45) { grantMap(s); return 'Late nights over candlelight pay off — you reconstruct the map!'; }
          return 'The fragment defeats you, but the practice sharpens your Cartography.';
        },
      },
    ],
  },
  {
    id: 'ghostShip', name: 'Ghost Ship', icon: '👻', weight: 4,
    desc: 'A derelict drifts past, sails rotten, deck empty. Cold air rolls off her hull.',
    choices: [
      {
        label: 'Board her', hint: 'Cursed riches — or cursed luck',
        apply: (s) => {
          if (Math.random() < 0.55) {
            s.resources.cursedRelics += 2;
            s.resources.treasure += scale(s, 3);
            gainXp(s, 'cursedLore', 250);
            return 'You return with cursed relics and cold treasure. The ship vanishes behind you.';
          }
          s.crewMembers.forEach(m => { m.morale = Math.max(5, m.morale - 20); });
          return 'Whatever your crew saw below decks, they will not speak of it. Morale plummets.';
        },
      },
      {
        label: 'Give her wide berth', hint: 'Safe, small knowledge gain',
        apply: (s) => {
          s.resources.knowledge += scale(s, 4);
          return 'You note her position in the log and sail on. +knowledge.';
        },
      },
    ],
  },
];

/** Triggers a weighted-random event. */
export function triggerRandomEvent(s: GameState): void {
  if (pendingEvent) return;
  const total = EVENTS.reduce((a, e) => a + e.weight, 0);
  let roll = Math.random() * total;
  for (const e of EVENTS) {
    roll -= e.weight;
    if (roll <= 0) { pendingEvent = e; break; }
  }
  if (pendingEvent) {
    notify(`${pendingEvent.icon} Event: ${pendingEvent.name}!`);
    // The harbor reflects the drama: storms (and krakens) churn the sea.
    if (pendingEvent.id === 'storm' || pendingEvent.id === 'kraken') forceStorm(30);
  }
}

export function resolveEventChoice(s: GameState, choiceIndex: number): string | null {
  if (!pendingEvent) return null;
  const choice = pendingEvent.choices[choiceIndex];
  if (!choice) return null;
  const outcome = choice.apply(s);
  logEvent(s, `${pendingEvent.name}: ${outcome}`);
  s.stats.eventsResolved++;
  pendingEvent = null;
  s.eventTimer = 120 + Math.random() * 120;
  return outcome;
}
