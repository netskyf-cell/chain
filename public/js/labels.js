// Text and icon for every state Chain shows. Status is never colour alone (CLAUDE.md):
// each label carries an icon and words; the CSS class only adds colour.
import { h } from './dom.js';

const ARTIFACT = {
  accepted: ['✓', 'accepted'],
  revising: ['↻', 'revising'],
  proposed: ['\u270E', 'proposed'],
  absent: ['○', 'absent'],
};

const LIFECYCLE = {
  'no intent': '⚠',
  idea: '•',
  specified: '••',
  planned: '•••',
  building: '⚒',
  shipped: '✔',
};

const HEALTH = {
  'on track': '✓',
  blocked: '⛔',
};

export function artifactBadge(state) {
  const [icon, text] = ARTIFACT[state] || ['?', state];
  return h('span', { class: `state ${state}` }, h('span', { 'aria-hidden': 'true' }, icon), text);
}

export function lifecycleBadge(lifecycle) {
  return h('span', { class: `pill lifecycle ${lifecycle.replace(' ', '-')}` },
    h('span', { 'aria-hidden': 'true' }, LIFECYCLE[lifecycle] || '?'), lifecycle);
}

export function healthBadge(health) {
  const status = health.status;
  return h('span', { class: `pill health ${status.replace(' ', '-')}`, title: health.reason },
    h('span', { 'aria-hidden': 'true' }, HEALTH[status] || '?'), status);
}

export function days(n) {
  return n === 1 ? '1 day' : `${n} days`;
}
