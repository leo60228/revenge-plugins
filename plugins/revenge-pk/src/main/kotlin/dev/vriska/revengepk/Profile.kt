package dev.vriska.revengepk

import android.text.Spannable
import android.text.SpannableString
import android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
import android.text.style.ForegroundColorSpan

fun colorName(username: CharSequence, profile: CacheEntry): Spannable? {
    val spannable = SpannableString(username)

    val memberColor = ForegroundColorSpan(profile.memberColor ?: return null)
    val systemColor = ForegroundColorSpan(profile.systemColor ?: return null)
    val name = Regex.escape(profile.name ?: return null)
    val tag = Regex.escape(profile.tag ?: return null)

    val match = Regex($$"^(?<name>$$name).*(?<tag>$$tag)$").matchEntire(username)
        ?: Regex($$"^(?<name>.*) (?<tag>$$tag)$").matchEntire(username) ?: return null

    val nameRange = match.groups["name"]!!.range
    val tagRange = match.groups["tag"]!!.range

    spannable.setSpan(memberColor, nameRange.first, nameRange.last + 1, SPAN_EXCLUSIVE_EXCLUSIVE)
    spannable.setSpan(systemColor, tagRange.first, tagRange.last + 1, SPAN_EXCLUSIVE_EXCLUSIVE)

    return spannable
}