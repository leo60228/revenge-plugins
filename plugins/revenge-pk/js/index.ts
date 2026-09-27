import { getModules } from '@revenge-mod/modules/finders';
import { withName } from '@revenge-mod/modules/finders/filters';
import { instead } from '@revenge-mod/patcher';
import { getCache, JSON_STORAGE_OPTIONS } from './cache';
import { refresh } from './pluralkit';
import type { Cache, PluginOptions } from './cache';

// noinspection JSUnusedGlobalSymbols
export default plugin<PluginOptions>({
	jsonStorage: JSON_STORAGE_OPTIONS,
	start({ jsonStorage, cleanup }) {
		console.log('[revenge-pk] started');

		let cache: Cache = {};
		getCache(jsonStorage).then(x => (cache = x));

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

						if (needsRefresh) {
							void refresh(cacheKey, message.id, cache, jsonStorage);
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
