import { schema } from '@easrng/schema';
import { getModules } from '@revenge-mod/modules/finders';
import { withName } from '@revenge-mod/modules/finders/filters';
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
}

interface Member {
	color?: null | string;
}

interface ProxiedMessage {
	system: System;
	member: Member;
}
const proxiedMessageSchema: Schema<ProxiedMessage> = schema(
	'{"type":"object","properties":{"member":{"type":"object","properties":{"color":{"anyOf":[{"type":"null"},{"type":"string"}]}}},"system":{"type":"object","properties":{"color":{"anyOf":[{"type":"null"},{"type":"string"}]}}}},"required":["member","system"]}',
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

export default plugin({
	jsonStorage: {
		default: { cache: {} },
	},
	async start({ jsonStorage, cleanup }) {
		console.log('[revenge-pk] started');
		const cache: {
			[key: string]: {
				expiresAt: number;
				system: System;
				member: Member;
			};
		} = (await jsonStorage.get())?.cache || {};
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

							const { expiresAt, system, member } = cache[cacheKey];
							if (expiresAt > Date.now()) needsRefresh = false;

							const color = member.color ?? system.color;
							if (color) {
								console.log(`[revenge-pk] color: #${color}`);
								const parsedColor = parseInt(color, 16) + 0xff000000;
								const colorData = new Uint32Array([parsedColor]);
								const colorDataView = new DataView(colorData.buffer);
								const nativeColor = colorDataView.getInt32(0, true);
								ret.message.usernameColor = nativeColor;
							}
						}

						console.log(`[revenge-pk] needs refresh: ${needsRefresh}`);

						if (needsRefresh && !pending.has(cacheKey)) {
							console.log('[revenge-pk] refreshing');
							pending.add(cacheKey);
							getProxiedMessage(message.id)
								.then(({ system, member }) => {
									console.log(`[revenge-pk] refreshed user ${cacheKey}`);
									const expiresAt = Date.now() + 1000 * 60 * 60 * 6;
									const entry = { expiresAt, system, member };
									cache[cacheKey] = entry;
									jsonStorage
										.set({ cache: { [cacheKey]: entry } })
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
