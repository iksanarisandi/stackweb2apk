# CatatUang - Android WebView App

Aplikasi Android WebView untuk [CatatUang](https://catat-uang-frontend.pages.dev/) - aplikasi pencatatan keuangan berbasis web.

## 📱 Fitur

- **WebView Modern** - Menampilkan web app dengan performa optimal
- **Pull to Refresh** - Swipe ke bawah untuk refresh halaman
- **External Links Support** - Mendukung pembukaan link eksternal:
  - WhatsApp (`wa.me`, `api.whatsapp.com`)
  - Telepon (`tel:`)
  - Email (`mailto:`)
  - SMS (`sms:`)
  - Telegram (`t.me`)
  - Play Store (`play.google.com`)
- **Offline Handler** - Menampilkan halaman error saat tidak ada koneksi
- **Back Navigation** - Tombol back untuk navigasi history WebView

## 📋 Informasi Aplikasi

| Property | Value |
|----------|-------|
| Package Name | `com.catatung.app` |
| Min SDK | Android 7.0 (API 24) |
| Target SDK | Android 14 (API 34) |
| Version | 1.0 |

## 🛠️ Tech Stack

- **Language**: Kotlin
- **Build System**: Gradle 8.10
- **Android Gradle Plugin**: 8.5.2
- **Kotlin Version**: 1.9.24

## 📦 Dependencies

```groovy
implementation 'androidx.core:core-ktx:1.12.0'
implementation 'androidx.appcompat:appcompat:1.6.1'
implementation 'com.google.android.material:material:1.11.0'
implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
```

## 🚀 Build Instructions

### Prerequisites

- Java JDK 17 atau lebih baru
- Android SDK dengan:
  - Platform Tools
  - Build Tools 34.0.0
  - Android Platform 34

### Build Debug APK

```bash
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

### Build Release APK (Signed)

1. Buat keystore (jika belum ada):
```bash
keytool -genkeypair -v -keystore app/release-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias catatuang
```

2. Update `app/build.gradle` dengan signing config

3. Build release:
```bash
./gradlew assembleRelease
```

Output: `app/build/outputs/apk/release/app-release.apk`

## 📁 Project Structure

```
├── app/
│   ├── src/main/
│   │   ├── java/com/catatung/app/
│   │   │   └── MainActivity.kt      # Main activity dengan WebView
│   │   ├── res/
│   │   │   ├── layout/              # Layout XML
│   │   │   ├── values/              # Colors, strings, themes
│   │   │   ├── drawable/            # Vector drawables
│   │   │   └── mipmap-*/            # App icons
│   │   ├── assets/
│   │   │   └── error.html           # Offline error page
│   │   └── AndroidManifest.xml
│   └── build.gradle                 # App-level build config
├── build.gradle                     # Project-level build config
├── settings.gradle                  # Gradle settings
└── gradle.properties                # Gradle properties
```

## ⚙️ Konfigurasi

### Mengubah URL Website

Edit `MainActivity.kt`:
```kotlin
private val url = "https://your-website-url.com/"
```

### Mengubah Package Name

1. Update `app/build.gradle`:
```groovy
namespace 'com.your.package'
applicationId "com.your.package"
```

2. Rename folder di `app/src/main/java/`
3. Update package declaration di `MainActivity.kt`

## 🔐 Permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
```

## 📄 License

MIT License

## 👨‍💻 Author

[iksanarisandi](https://github.com/iksanarisandi)
