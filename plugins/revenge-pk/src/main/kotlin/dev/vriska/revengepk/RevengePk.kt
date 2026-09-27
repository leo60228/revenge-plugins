@file:JvmName("RevengePk")

package dev.vriska.revengepk

import android.widget.TextView
import io.github.revenge.plugins.plugin
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedHelpers
import java.lang.invoke.MethodHandles.publicLookup
import java.lang.invoke.MethodType.methodType

var hook: XC_MethodHook.Unhook? = null

@Suppress("UNUSED")
val revengePk = plugin {
    start {
        Cache.bridge(bridge)

        val guildIdClass = XposedHelpers.findClass("com.discord.primitives.GuildId", classLoader)
        val messageClass = XposedHelpers.findClass("com.discord.chat.bridge.Message", classLoader)
        val tagTextField = XposedHelpers.findField(messageClass, "tagText")
        val guildIdField = XposedHelpers.findField(messageClass, "guildId")
        val usernameField = XposedHelpers.findField(messageClass, "username")

        val getTagText =
            publicLookup().unreflectGetter(tagTextField).asType(methodType(String::class.java, Any::class.java))
        val getGuildId =
            publicLookup().unreflectGetter(guildIdField).asType(methodType(Any::class.java, Any::class.java))
        val getUsername =
            publicLookup().unreflectGetter(usernameField).asType(methodType(String::class.java, Any::class.java))

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

                    val tagText = (getTagText.invokeExact(message) as String?) ?: return
                    if (tagText != "PK") return

                    val guildId = getGuildId.invokeExact(message)?.toString() ?: return
                    val username = (getUsername.invokeExact(message) as String?) ?: return
                    val cacheKey = "${guildId}:${username}"
                    val entry = Cache[cacheKey] ?: return
                    log.i(entry.toString())

                    /* if (entry.memberColor != null && entry.systemColor != null) {
                        val spannable = SpannableString(textView.getText())
                        spannable.setSpan(ForegroundColorSpan(0xFFFF00FF.toInt()), 1, 5, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
                        textView.setText(spannable, TextView.BufferType.SPANNABLE)
                    } else */ if (entry.memberColor != null) {
                        textView.setTextColor(entry.memberColor)
                    } else if (entry.systemColor != null) {
                        textView.setTextColor(entry.systemColor)
                    }
                }
            })
    }

    stop {
        hook?.unhook()
    }
}
