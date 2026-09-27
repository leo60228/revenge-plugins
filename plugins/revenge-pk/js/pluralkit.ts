import { schema } from '@easrng/schema';
import PQueue from 'p-queue';
import { addEntry } from './cache';
import { parseColor } from './util';
import type { Schema } from '@easrng/schema';
import type { JsonStorage } from '@revenge-mod/json-storage';
import type { Cache, PluginStorage } from './cache';

const queue = new PQueue({
	intervalCap: 10,
	interval: 1000,
	carryoverIntervalCount: true,
	strict: true,
});

export interface System {
	color?: null | string;
	tag?: null | string;
}

export interface Member {
	color?: null | string;
	name?: null | string;
	display_name?: null | string;
}

export interface ProxiedMessage {
	system: System;
	member: Member;
}

const proxiedMessageSchema: Schema<ProxiedMessage> = schema(
	'{"type":"object","properties":{"member":{"type":"object","properties":{"color":{"anyOf":[{"type":"null"},{"type":"string"}]},"display_name":{"anyOf":[{"type":"null"},{"type":"string"}]},"name":{"anyOf":[{"type":"null"},{"type":"string"}]}}},"system":{"type":"object","properties":{"color":{"anyOf":[{"type":"null"},{"type":"string"}]},"tag":{"anyOf":[{"type":"null"},{"type":"string"}]}}}},"required":["member","system"]}',
);

function getProxiedMessage(id: string): Promise<ProxiedMessage> {
	return queue.add(async () => {
		const req = await fetch(`https://api.pluralkit.me/v2/messages/${id}`, {
			headers: {
				'User-Agent': 'revenge-pk (leo@60228.dev)',
			},
		});
		const result = proxiedMessageSchema.validate(await req.json());
		if (result.issues) {
			console.error(result.issues);
			throw new Error('invalid pluralkit api response');
		}
		return result.value;
	});
}

const pending = new Set();
export async function refresh(
	cacheKey: string,
	id: string,
	cache: Cache,
	jsonStorage: JsonStorage<PluginStorage>,
): Promise<void> {
	if (pending.has(cacheKey)) return;

	console.log('[revenge-pk] refreshing');
	pending.add(cacheKey);

	try {
		const { system, member } = await getProxiedMessage(id);
		console.log(`[revenge-pk] refreshed user ${cacheKey}`);
		const expiresAt = Date.now() + 1000 * 60 * 60 * 6;
		const entry = {
			expiresAt,
			systemColor: parseColor(system.color),
			memberColor: parseColor(member.color),
			name: member.display_name ?? member.name ?? null,
			tag: system.tag ?? null,
		};
		await addEntry(cache, jsonStorage, cacheKey, entry);
	} catch (err) {
		console.warn(`[revenge-pk] error refreshing message ${id}: ${err}`);
	} finally {
		pending.delete(cacheKey);
	}
}
