@file:JvmName("RevengePk")

package dev.vriska.revengepk

import android.text.Spannable
import android.text.SpannableString
import android.text.style.ForegroundColorSpan
import android.widget.TextView
import io.github.revenge.plugins.plugin
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedHelpers

data class CacheEntry(val memberColor: Int?, val systemColor: Int?)

val cache = HashMap<String, CacheEntry>()

var hook: XC_MethodHook.Unhook? = null

@Suppress("UNUSED")
val revengePk = plugin {
    start {
        bridge.registerMethod("revengepk.addToCache") { args ->
            val entries = (args[0] as Map<*, *>).mapKeys { it.key as String }
            entries.mapValuesTo(cache) {
                val entry = it.value as Map<*, *>
                CacheEntry(
                    (entry["memberColor"] as Double?)?.toInt(),
                    (entry["systemColor"] as Double?)?.toInt()
                )
            }
            Unit
        }

        log.i("setting up hooks")
        hook = XposedHelpers.findAndHookMethod(
            "com.discord.chat.presentation.message.MessageUtilsKt",
            classLoader,
            "clearOrSetRoleColors",
            TextView::class.java,
            "com.discord.chat.bridge.Message",
            object : XC_MethodHook() {
                override fun afterHookedMethod(param: MethodHookParam) {
                    val textView = param.args[0] as TextView
                    val message = param.args[1]

                    val tagText = XposedHelpers.getObjectField(message, "tagText") as String?
                    if (tagText != "PK") return

                    val guildId = XposedHelpers.getObjectField(message, "guildId")?.toString() ?: return
                    val username = XposedHelpers.getObjectField(message, "username")?.toString() ?: return
                    val cacheKey = "${guildId}:${username}"
                    val entry = cache[cacheKey] ?: return
                    log.i(entry.toString())

                    val spannable = SpannableString(textView.getText())
                    //spannable.setSpan(ForegroundColorSpan(0xFFFF00FF.toInt()), 1, 5, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
                    textView.setText(spannable, TextView.BufferType.SPANNABLE)
                }
            })
    }

    stop {
        hook?.unhook()
    }
}
