const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

function sponsorRelationship(a, b) {
  if (!a || !b || a.id === b.id) return 50;
  const direct = a.relations?.[b.id];
  const reverse = b.relations?.[a.id];
  const source = Number.isFinite(direct) ? direct : Number.isFinite(reverse) ? reverse : 0;
  // Sponsor diplomacy informs the starting climate, but is deliberately softened:
  // colonies are separate political actors and do not inherit sponsor relations as orders.
  return clamp(50 + source * 0.45, 20, 80);
}

export function ensureColonyPoliticalState(w) {
  if (!Array.isArray(w.settlements)) return;
  for (const settlement of w.settlements) {
    const sponsor = w.sponsors?.find(item => item.id === settlement.sponsorId);
    settlement.politics ??= {};
    const p = settlement.politics;
    const isPrimary = settlement.kind === 'primary-colony';
    p.martianIdentity ??= isPrimary ? 8 : 12;
    p.localAutonomy ??= isPrimary ? (w.campaign?.autonomy ?? 40) : 18;
    p.sponsorInfluence ??= isPrimary ? 82 : 78;
    p.politicalStability ??= 70;
    p.cooperation ??= 15;
    p.relations ??= {};
    p.lastPlayerActions ??= {};
    p.history ??= [];
    p.sponsorName ??= sponsor?.name ?? 'Unknown sponsor';
  }

  for (let i = 0; i < w.settlements.length; i++) {
    for (let j = i + 1; j < w.settlements.length; j++) {
      const a = w.settlements[i], b = w.settlements[j];
      const pa = a.politics, pb = b.politics;
      if (pa.relations[b.id] === undefined && pb.relations[a.id] === undefined) {
        const sponsorA = w.sponsors?.find(item => item.id === a.sponsorId);
        const sponsorB = w.sponsors?.find(item => item.id === b.sponsorId);
        const score = sponsorRelationship(sponsorA, sponsorB);
        pa.relations[b.id] = score;
        pb.relations[a.id] = score;
      } else if (pa.relations[b.id] === undefined) {
        pa.relations[b.id] = pb.relations[a.id];
      } else if (pb.relations[a.id] === undefined) {
        pb.relations[a.id] = pa.relations[b.id];
      }
    }
  }
  return w.settlements;
}

export function processColonyPolitics(w, sol, events = []) {
  ensureColonyPoliticalState(w);
  const colonies = w.settlements ?? [];
  for (const colony of colonies) {
    if (colony.status === 'failed' || colony.status === 'abandoned') continue;
    const p = colony.politics;
    // Identity and self-government emerge gradually; neither is guaranteed to dominate.
    const relationshipValues = Object.values(p.relations ?? {});
    const cooperativeNeighbours = relationshipValues.filter(value => value >= 65).length;
    p.martianIdentity = clamp(p.martianIdentity + 0.006 + cooperativeNeighbours * 0.0015);
    p.localAutonomy = clamp(p.localAutonomy + 0.0025 + (p.martianIdentity >= 40 ? 0.001 : 0));
    p.sponsorInfluence = clamp(p.sponsorInfluence - 0.0015 - (p.localAutonomy >= 50 ? 0.002 : 0));
    p.politicalStability = clamp(p.politicalStability + (p.sponsorInfluence > 55 ? 0.001 : -0.002));
    p.lastUpdatedSol = sol;
  }

  // Relationships are between colonies, not copied live from their sponsors.
  // Small drift toward cooperation is possible, but no automatic pan-Martian bloc forms.
  for (let i = 0; i < colonies.length; i++) {
    for (let j = i + 1; j < colonies.length; j++) {
      const a = colonies[i], b = colonies[j];
      if (a.status === 'failed' || b.status === 'failed') continue;
      const pa = a.politics, pb = b.politics;
      const current = clamp((Number(pa.relations[b.id]) + Number(pb.relations[a.id])) / 2, 0, 100);
      const affinity = (pa.martianIdentity + pb.martianIdentity) / 2;
      const target = 48 + (affinity - 25) * 0.18 + (Math.min(pa.cooperation, pb.cooperation) - 15) * 0.12;
      const next = clamp(current + Math.sign(target - current) * Math.min(0.01, Math.abs(target - current) * 0.001));
      pa.relations[b.id] = next;
      pb.relations[a.id] = next;
    }
  }
  return events;
}

export function influenceColony(w, colonyId, actionId) {
  ensureColonyPoliticalState(w);
  const player = w.settlements?.find(item => item.kind === 'primary-colony');
  const target = w.settlements?.find(item => item.id === colonyId && item.kind === 'rival-colony');
  if (!player || !target) return { ok: false, reason: 'That colony is not available for diplomatic engagement.' };
  const p = target.politics;
  const actions = {
    'joint-research': {
      cost: 20, cooldownSols: 90, label: 'Joint scientific programme',
      apply() {
        p.cooperation = clamp(p.cooperation + 8);
        p.relations[player.id] = clamp(p.relations[player.id] + 8);
        player.politics.relations[target.id] = p.relations[player.id];
        p.martianIdentity = clamp(p.martianIdentity + 2);
        p.politicalStability = clamp(p.politicalStability + 1);
      },
      description: 'proposed a joint scientific programme'
    },
    'martian-autonomy': {
      cost: 15, cooldownSols: 120, label: 'Support Martian self-government',
      apply() {
        p.localAutonomy = clamp(p.localAutonomy + 7);
        p.martianIdentity = clamp(p.martianIdentity + 4);
        p.sponsorInfluence = clamp(p.sponsorInfluence - 4);
        p.relations[player.id] = clamp(p.relations[player.id] + 2);
        player.politics.relations[target.id] = p.relations[player.id];
        p.cooperation = clamp(p.cooperation + 2);
      },
      description: 'supported greater Martian self-government'
    }
  };
  const action = actions[actionId];
  if (!action) return { ok: false, reason: 'Unknown diplomatic initiative.' };
  const lastSol = Number(p.lastPlayerActions[actionId]);
  if (Number.isFinite(lastSol) && w.time.sol - lastSol < action.cooldownSols) {
    return { ok: false, reason: 'This initiative cannot be repeated for another ' + (action.cooldownSols - (w.time.sol - lastSol)) + ' sols.' };
  }
  if ((w.economy?.funds ?? 0) < action.cost) return { ok: false, reason: 'Insufficient funds.' };
  w.economy.funds -= action.cost;
  action.apply();
  p.lastPlayerActions[actionId] = w.time.sol;
  p.history.push({ sol: w.time.sol, action: actionId, description: action.description });
  if (p.history.length > 20) p.history.splice(0, p.history.length - 20);
  w.events ??= [];
  w.events.push({
    type: 'colony-diplomacy',
    sol: w.time.sol,
    colonyId: target.id,
    action: actionId,
    description: 'Your colony ' + action.description + ' with ' + target.name + '.'
  });
  return { ok: true, reason: action.label + ' agreed in principle; political effects will develop over time.' };
}

export function getColonyPoliticalSummary(w, settlement) {
  ensureColonyPoliticalState(w);
  const p = settlement?.politics;
  if (!p) return null;
  const home = w.settlements.find(item => item.kind === 'primary-colony');
  return {
    martianIdentity: Math.round(p.martianIdentity),
    localAutonomy: Math.round(p.localAutonomy),
    sponsorInfluence: Math.round(p.sponsorInfluence),
    politicalStability: Math.round(p.politicalStability),
    relationToPlayer: home && settlement.id !== home.id ? Math.round(p.relations[home.id] ?? 50) : null,
    cooperation: Math.round(p.cooperation)
  };
}
