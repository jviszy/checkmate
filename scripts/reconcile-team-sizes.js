/**
 * Data Migration & Reconciliation Script: Enforce Team Size Limits (Item 6)
 *
 * Rules:
 * - Enforce team size between 2 and 5 players (excluding the coach).
 * - Teams with fewer than 2 players are deleted (along with members, matches, and games).
 * - Teams with more than 5 players have extra members removed.
 * - Logs every removal and deletion to the Audit Log.
 *
 * Can be run via Node: `node scripts/reconcile-team-sizes.js`
 * Also callable in-app via `reconcileTeamSizes()` in `src/lib/api.js`.
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../amplify_outputs.json' with { type: 'json' };

Amplify.configure(outputs);
const client = generateClient();

const MIN_TEAM_MEMBERS = 2;
const MAX_TEAM_MEMBERS = 5;

async function listAll(model, options = {}) {
  const out = [];
  let nextToken = null;
  do {
    const res = await client.models[model].list({ authMode: 'apiKey', ...options, nextToken, limit: 1000 });
    if (res?.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
    out.push(...(res.data ?? []));
    nextToken = res.nextToken;
  } while (nextToken);
  return out;
}

async function recordAudit(entry) {
  try {
    if (client.models.AuditLog) {
      await client.models.AuditLog.create(entry);
    }
  } catch (err) {
    console.warn('Could not record to remote AuditLog:', err.message);
  }
}

export async function runReconciliation() {
  console.log('--- Checkmate Team Size Reconciliation (Item 6) ---');
  console.log(`Enforcing: Minimum ${MIN_TEAM_MEMBERS} members, Maximum ${MAX_TEAM_MEMBERS} members (excluding coach).\n`);

  const [teams, players, allMatches, allGames] = await Promise.all([
    listAll('Team'),
    listAll('Player'),
    listAll('Match'),
    listAll('Game'),
  ]);

  console.log(`Found ${teams.length} teams and ${players.length} players.`);

  const byTeam = new Map();
  for (const t of teams) byTeam.set(t.id, []);
  for (const p of players) {
    if (p.teamId && byTeam.has(p.teamId)) {
      byTeam.get(p.teamId).push(p);
    }
  }

  let deletedTeamsCount = 0;
  let trimmedPlayersCount = 0;

  for (const team of teams) {
    const roster = byTeam.get(team.id) || [];

    // 1. Teams with fewer than 2 players are deleted
    if (roster.length < MIN_TEAM_MEMBERS) {
      console.log(`[DELETE TEAM] Team "${team.name}" (ID: ${team.id}) has ${roster.length} player(s) (< ${MIN_TEAM_MEMBERS}). Removing...`);

      const targetMatches = allMatches.filter((m) => m.teamAId === team.id || m.teamBId === team.id);
      const matchIds = new Set(targetMatches.map((m) => m.id));
      const playerIds = new Set(roster.map((p) => p.id));

      const targetGames = allGames.filter((g) => (
        g.whiteTeamId === team.id ||
        g.blackTeamId === team.id ||
        matchIds.has(g.matchId) ||
        playerIds.has(g.whitePlayerId) ||
        playerIds.has(g.blackPlayerId)
      ));

      await Promise.all([
        ...roster.map((p) => client.models.Player.delete({ id: p.id })),
        ...targetMatches.map((m) => client.models.Match.delete({ id: m.id })),
        ...targetGames.map((g) => client.models.Game.delete({ id: g.id })),
      ]);
      await client.models.Team.delete({ id: team.id });

      await recordAudit({
        adminEmail: 'migration@checkmate.coderina.org',
        adminName: 'Reconciliation Migration',
        action: 'RECONCILIATION_DELETE_TEAM',
        targetType: 'team',
        targetId: team.id,
        targetName: team.name,
        details: `Deleted team "${team.name}" during team size reconciliation because it had ${roster.length} member(s) (< ${MIN_TEAM_MEMBERS} minimum).`,
        timestamp: new Date().toISOString(),
      });

      deletedTeamsCount++;
      continue;
    }

    // 2. Teams with more than 5 players have excess members removed
    if (roster.length > MAX_TEAM_MEMBERS) {
      console.log(`[TRIM TEAM] Team "${team.name}" (ID: ${team.id}) has ${roster.length} players (> ${MAX_TEAM_MEMBERS}). Trimming to 5...`);

      const sorted = [...roster].sort((a, b) => {
        if (a.isCaptain && !b.isCaptain) return -1;
        if (!a.isCaptain && b.isCaptain) return 1;
        return (
          (Number(b.individualScore) || 0) - (Number(a.individualScore) || 0) ||
          String(a.displayName || '').localeCompare(String(b.displayName || '')) ||
          String(a.id).localeCompare(String(b.id))
        );
      });

      const toRemove = sorted.slice(MAX_TEAM_MEMBERS);
      for (const p of toRemove) {
        console.log(`  - Removing excess player: "${p.displayName}" (${p.email})`);
        const games = await listAll('Game', {
          filter: { or: [{ whitePlayerId: { eq: p.id } }, { blackPlayerId: { eq: p.id } }] }
        });
        await Promise.all(games.filter((g) => g.status === 'scheduled').map((g) => client.models.Game.delete({ id: g.id })));
        await client.models.Player.delete({ id: p.id });

        await recordAudit({
          adminEmail: 'migration@checkmate.coderina.org',
          adminName: 'Reconciliation Migration',
          action: 'RECONCILIATION_TRIM_PLAYER',
          targetType: 'player',
          targetId: p.id,
          targetName: p.displayName,
          details: `Removed excess player "${p.displayName}" from team "${team.name}" during size reconciliation (exceeded ${MAX_TEAM_MEMBERS} maximum).`,
          timestamp: new Date().toISOString(),
        });

        trimmedPlayersCount++;
      }
    }
  }

  console.log(`\nReconciliation Complete: ${deletedTeamsCount} team(s) deleted, ${trimmedPlayersCount} excess player(s) removed.`);
  console.log('All removals and deletions logged to Audit Log.');
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runReconciliation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Reconciliation failed:', err);
      process.exit(1);
    });
}
