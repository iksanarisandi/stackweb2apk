# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# ── WebView JavascriptInterface ──────────────────────────────────────────────
# KRITIS: Tanpa rule ini, semua @JavascriptInterface akan di-strip oleh R8/ProGuard
# saat release build, menyebabkan fitur blob download dan komunikasi JS-native gagal.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# ── WebView Client & Chrome Client ───────────────────────────────────────────
-keepclassmembers class * extends android.webkit.WebViewClient { public *; }
-keepclassmembers class * extends android.webkit.WebChromeClient { public *; }

# ── Stack trace yang bisa dibaca (debug) ─────────────────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Suppress warning dari library internal ───────────────────────────────────
-dontwarn kotlin.reflect.jvm.internal.**
