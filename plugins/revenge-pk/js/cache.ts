import { callNativeMethodSync } from '@revenge-mod/modules/native';
import type {
	JsonStorage,
	JsonStorageOptions,
} from '@revenge-mod/json-storage';
import type { PluginApiExtensionsOptions } from '@revenge-mod/plugins/types';

export interface CacheEntry {
	expiresAt: number;
	systemColor: number | null;
	memberColor: number | null;
	name: string | null;
	tag: string | null;
}

export interface Cache {
	[key: string]: CacheEntry;
}

export const CACHE_VERSION = 3 as const;

type Enumerate<
	N extends number,
	Acc extends number[] = [],
> = Acc['length'] extends N
	? Acc[number]
	: Enumerate<N, [...Acc, Acc['length']]>;

export type PluginStorage =
	| {
			cacheVersion: typeof CACHE_VERSION;
			cache: Cache;
	  }
	| { cacheVersion: Enumerate<typeof CACHE_VERSION> };

export const DEFAULT_STORAGE: PluginStorage = {
	cacheVersion: CACHE_VERSION,
	cache: {},
};

export const JSON_STORAGE_OPTIONS: JsonStorageOptions<PluginStorage> = {
	default: DEFAULT_STORAGE,
};

export interface PluginOptions extends PluginApiExtensionsOptions {
	jsonStorage: PluginStorage;
}

function addToNativeCache(cache: Cache) {
	callNativeMethodSync('revengepk.addToCache', [cache]);
}

declare module '@revenge-mod/modules/native' {
	// noinspection JSUnusedGlobalSymbols
	export interface NativeMethods {
		'revengepk.addToCache': [[cache: Cache], undefined];
	}
}

export async function getCache(
	jsonStorage: JsonStorage<PluginStorage>,
): Promise<Cache> {
	const storage = await jsonStorage.get();
	let cache: Cache = {};

	if (storage.cacheVersion === 3) {
		cache = storage.cache;
	} else {
		console.log('[revenge-pk] cache out of date');
		await jsonStorage.set(DEFAULT_STORAGE, true);
	}
	addToNativeCache(cache);

	return cache;
}

export async function addEntry(
	cache: Cache,
	jsonStorage: JsonStorage<PluginStorage>,
	key: string,
	value: CacheEntry,
): Promise<void> {
	const entries = { [key]: value };
	cache[key] = value;
	addToNativeCache(entries);
	await jsonStorage.set({ cache: entries });
}
