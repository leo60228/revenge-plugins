package dev.vriska.revengepk

import io.github.revenge.bridge.RevengeBridge

data class CacheEntry(val memberColor: Int?, val systemColor: Int?, val name: String?, val tag: String?)

object Cache {
    private val cache = HashMap<String, CacheEntry>()

    private fun addFromJs(map: Map<*, *>) {
        val entries = map.mapKeys { it.key as String }
        entries.mapValuesTo(cache) {
            val entry = it.value as Map<*, *>
            CacheEntry(
                (entry["memberColor"] as Double?)?.toInt(),
                (entry["systemColor"] as Double?)?.toInt(),
                entry["name"] as String?,
                entry["tag"] as String?,
            )
        }
    }

    fun bridge(bridge: RevengeBridge) {
        bridge.registerMethod("revengepk.addToCache") { args ->
            addFromJs(args[0] as Map<*, *>)
        }
    }

    operator fun get(cacheKey: String): CacheEntry? {
        return cache[cacheKey]
    }
}