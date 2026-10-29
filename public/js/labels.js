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
  drift: '↯',
  blocked: '⛔',
};

// S2 drift signals: severity icon and words, and a plain name for each kind.
const SEVERITY = {
  high: ['‼', 'high'],
  warn: ['⚠', 'warning'],
  info: ['ℹ', 'info'],
};

const KIND = {
  intent_rework: 'Intent reworked after the spec started',
  spec_rework: 'Spec reworked after the plan started',
  plan_revised: 'Plan revised by a build PR',
  pr_declares_divergence: 'PR declares a divergence from the plan',
  compliance_finding: 'Compliance finding in a review',
  gate_bypassed: 'Artifact changed without a PR',
  light_path_large: 'Light change above the size guard',
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

export function severityBadge(severity) {
  const [icon, text] = SEVERITY[severity] || ['?', severity];
  return h('span', { class: `pill severity ${severity}` }, h('span', { 'aria-hidden': 'true' }, icon), text);
}

export function kindLabel(kind) {
  return KIND[kind] || kind;
}

// Evidence link text: "commit 1c1fade", "PR #9", "review on PR #35", "inline comment on PR #35".
export function evidenceText(signal) {
  const e = signal.evidence;
  if (e.type === 'commit') return `commit ${String(e.ref).slice(0, 7)}`;
  if (e.type === 'pr') return `PR #${signal.pr}`;
  if (e.type === 'review') return `review on PR #${signal.pr}`;
  return `inline comment on PR #${signal.pr}`;
}

// "2026-10-28 14:41 UTC": the evidence time, never "now".
export function when(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function days(n) {
  return n === 1 ? '1 day' : `${n} days`;
}
