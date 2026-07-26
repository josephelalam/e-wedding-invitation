import { sql } from 'drizzle-orm';
import { getDb, type Db } from './db';
import { audit } from './services/audit';

// Cron work (spec §4.10/§7.3/§7.4): nightly R2 backup dump, retention purge of
// guest PII, and housekeeping. No queue — nothing here has fan-out or retry
// semantics worth a broker.

type BackupBucket = { put(key: string, value: string): Promise<unknown> };

const BACKUP_TABLES = ['events', 'locations', 'invitations', 'rsvps', 'audit_log'] as const;

async function backupToBucket(db: Db, bucket: BackupBucket, now: Date): Promise<void> {
	const day = now.toISOString().slice(0, 10);
	const manifest: Record<string, number> = {};
	for (const table of BACKUP_TABLES) {
		const rows = (await db.all(sql.raw(`SELECT * FROM ${table}`))) as Record<string, unknown>[];
		manifest[table] = rows.length;
		const jsonl = rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
		await bucket.put(`backups/${day}/${table}.jsonl`, jsonl);
	}
	await bucket.put(`backups/${day}/manifest.json`, JSON.stringify(manifest, null, '\t'));
}

async function retentionPurge(db: Db, now: Date): Promise<void> {
	const nowIso = now.toISOString();
	const due = (await db.all(
		sql`SELECT id FROM events
		    WHERE purged_at IS NULL
		    AND datetime(date_main, '+' || retention_months || ' months') <= datetime(${nowIso})`
	)) as { id: string }[];
	for (const { id } of due) {
		await db.run(
			sql`UPDATE rsvps SET note = NULL
			    WHERE invitation_id IN (SELECT id FROM invitations WHERE event_id = ${id})`
		);
		await db.run(
			sql`UPDATE invitations SET guest_label = 'purged', phone = NULL WHERE event_id = ${id}`
		);
		await db.run(
			sql`UPDATE events SET status = 'archived', purged_at = ${nowIso}, updated_at = ${nowIso}
			    WHERE id = ${id}`
		);
		await audit(db, 'system', 'retention.purge', 'event', id);
	}
}

async function housekeeping(db: Db, now: Date): Promise<void> {
	const nowSec = Math.floor(now.getTime() / 1000);
	await db.run(sql`DELETE FROM rate_limits WHERE reset_at < ${nowSec}`);
	const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
	await db.run(sql`DELETE FROM outbox WHERE consumed_at IS NOT NULL AND created_at < ${cutoff}`);
	// better-auth verification rows (magic links) — expired ones are dead weight
	await db.run(sql`DELETE FROM verification WHERE expires_at < ${now.getTime()}`);
}

/** Testable core — unit tests drive this directly with a bucket stub. */
export async function nightly(db: Db, bucket: BackupBucket, now: Date): Promise<void> {
	const stages: [string, () => Promise<void>][] = [
		['backup', () => backupToBucket(db, bucket, now)],
		['retention', () => retentionPurge(db, now)],
		['housekeeping', () => housekeeping(db, now)]
	];
	for (const [name, run] of stages) {
		try {
			await run();
		} catch (err) {
			console.error(`nightly job stage "${name}" failed`, err);
		}
	}
}

/** Entry point for the Worker's scheduled handler. */
export async function runNightlyJobs(env: { DB: D1Database; MEDIA: R2Bucket }): Promise<void> {
	await nightly(getDb(env.DB), env.MEDIA, new Date());
}
