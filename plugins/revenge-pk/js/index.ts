import { schema } from '@easrng/schema';
import { getModules } from '@revenge-mod/modules/finders';
import { withName } from '@revenge-mod/modules/finders/filters';
import { callNativeMethodSync } from '@revenge-mod/modules/native';
import { instead } from '@revenge-mod/patcher';
import PQueue from 'p-queue';
import type { Schema } from '@easrng/schema';

const queue = new PQueue({
	intervalCap: 10,
	interval: 1000,
	carryoverIntervalCount: true,
	strict: true,
});

interface System {
	color?: null | string;
	tag?: null | string;
}

interface Member {
	color?: null | string;
	name?: null | string;
	display_name?: null | string;
}

interface ProxiedMessage {
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

interface Cache {
	[key: string]: {
		expiresAt: number;
		systemColor: number | null;
		memberColor: number | null;
		name: string | null;
		tag: string | null;
	};
}

const CACHE_VERSION = 3;

function parseColor(color: string | null | undefined): number | null {
	if (!color) return null;

	const parsedColor = parseInt(color, 16) + 0xff000000;
	const colorData = new Uint32Array([parsedColor]);
	const colorDataView = new DataView(colorData.buffer);
	return colorDataView.getInt32(0, true);
}

// noinspection JSUnusedGlobalSymbols
export default plugin({
	jsonStorage: {
		default: { cacheVersion: CACHE_VERSION, cache: {} },
	},
	async start({ jsonStorage, cleanup }) {
		console.log('[revenge-pk] started');

		const storage = await jsonStorage.get();
		let cache: Cache = {};

		if (!storage.cacheVersion || storage.cacheVersion !== CACHE_VERSION) {
			console.log('[revenge-pk] cache out of date');
			await jsonStorage.set({ cacheVersion: CACHE_VERSION, cache }, true);
		} else if (storage.cache) {
			cache = storage.cache;
		}
		callNativeMethodSync('revengepk.addToCache', [cache]);

		getModules(withName('RowManager'), (RowManager: any) => {
			const unpatch = instead(
				RowManager.prototype,
				'generate',
				function (args, orig) {
					const ret = orig.apply(this, args);
					const message = args?.[0]?.message;

					if (
						message?.applicationId === '466378653216014359' &&
						message.id &&
						ret?.message?.guildId &&
						message.author?.username
					) {
						console.log(`[revenge-pk] pluralkit message ${message.id}`);

						let needsRefresh = true;
						const cacheKey = `${ret.message.guildId}:${message.author.username}`;

						console.log(`[revenge-pk] cache key: ${cacheKey}`);

						ret.message.tagText = 'PK';

						if (Object.hasOwn(cache, cacheKey)) {
							console.log('[revenge-pk] in cache');

							const { expiresAt } = cache[cacheKey];
							if (expiresAt > Date.now()) needsRefresh = false;
						}

						console.log(`[revenge-pk] needs refresh: ${needsRefresh}`);

						if (needsRefresh && !pending.has(cacheKey)) {
							console.log('[revenge-pk] refreshing');
							pending.add(cacheKey);
							getProxiedMessage(message.id)
								.then(({ system, member }) => {
									console.log(`[revenge-pk] refreshed user ${cacheKey}`);
									const expiresAt = Date.now() + 1000 * 60 * 60 * 6;
									const entry = {
										expiresAt,
										systemColor: parseColor(system.color),
										memberColor: parseColor(member.color),
										name: member.display_name ?? member.name ?? null,
										tag: system.tag ?? null,
									};
									const entries = { [cacheKey]: entry };

									cache[cacheKey] = entry;
									callNativeMethodSync('revengepk.addToCache', [entries]);
									jsonStorage
										.set({ cache: entries })
										.then(() => console.log('[revenge-pk] cache saved'))
										.catch(err =>
											console.error(`[revenge-pk] error saving cache: ${err}`),
										);
								})
								.catch(err =>
									console.warn(
										`[revenge-pk] error fetching proxied message ${message.id}: ${err}`,
									),
								)
								.finally(() => pending.delete(cacheKey));
						}
					}

					return ret;
				},
			);
			cleanup(unpatch);
		});
	},
	stop() {
		console.log('[revenge-pk] stopped');
	},
});

declare module '@revenge-mod/modules/native' {
	// noinspection JSUnusedGlobalSymbols
	export interface NativeMethods {
		'revengepk.addToCache': [[cache: Cache], undefined];
	}
}
