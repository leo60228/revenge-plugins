package dev.vriska.revengepk

import io.github.revenge.bridge.RevengeBridge

data class CacheEntry(val memberColor: Int?, val systemColor: Int?, val name: String?, val tag: String?)

object Cache {
    private val cache = HashMap<String, CacheEntry>()
    private val waiting = HashMap<String, ArrayList<(CacheEntry) -> Unit>>()

    fun add(key: String, value: CacheEntry) {
        cache[key] = value
        waiting.remove(key)?.forEach { it(value) }
    }

    fun acquire(key: String, cb: (CacheEntry) -> Unit) {
        val value = cache[key]
        if (value != null) {
            cb(value)
        } else {
            waiting.getOrPut(key) { arrayListOf() }.add(cb)
        }
    }

    private fun addFromJs(map: Map<*, *>) {
        val entries = map.mapKeys { it.key as String }
        for ((key, value) in entries) {
            val entryMap = value as Map<*, *>
            val entry = CacheEntry(
                (entryMap["memberColor"] as Double?)?.toInt(),
                (entryMap["systemColor"] as Double?)?.toInt(),
                entryMap["name"] as String?,
                entryMap["tag"] as String?,
            )
            add(key, entry)
        }
    }

    fun bridge(bridge: RevengeBridge) {
        bridge.registerMethod("revengepk.addToCache") { args ->
            addFromJs(args[0] as Map<*, *>)
        }
    }
}