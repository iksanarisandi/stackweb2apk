package __PACKAGE_NAME__

import android.Manifest
import android.annotation.SuppressLint
import android.animation.ValueAnimator
import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.webkit.*
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File
import java.io.FileOutputStream
// __GPS_IMPORT__
// Import PermissionRequest untuk PWA notifications (selalu diperlukan)
import android.webkit.PermissionRequest

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private val appUrl = "__APP_URL__"

    // ── File Upload & Camera ──
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null
    private val FILE_CHOOSER_REQUEST_CODE = 1001
    private val PERMISSION_REQUEST_CODE = 1002

    // ── Fullscreen Video ──
    private var customView: View? = null
    private var customViewContainer: FrameLayout? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    // __GPS_PERMISSION_CONST__

    // ── Google OAuth / social login → Chrome Custom Tabs ──
    private val oauthDomains = listOf(
        "accounts.google.com",
        "login.microsoftonline.com",
        "github.com/login",
        "appleid.apple.com",
        "facebook.com/login",
        "twitter.com/i/oauth"
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)

        customViewContainer = FrameLayout(this).also {
            it.layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            it.setBackgroundColor(0xFF000000.toInt())
            it.visibility = View.GONE
            addContentView(it, it.layoutParams)
        }

        setupWebView()
        setupSwipeRefresh()
        setupDownloadListener()
        // __CAMERA_PERMISSION_REQUEST__

        // __GPS_PERMISSION_REQUEST__

        if (isNetworkAvailable()) {
            webView.loadUrl(appUrl)
        } else {
            webView.loadUrl("file:///android_asset/error.html")
        }
    }

    // ── Minta izin kamera + storage saat startup ──
    private fun requestRequiredPermissions() {
        val permissions = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA)
        }

        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES)
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_IMAGES)
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }

        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }

    // ── Resolve MIME type dari acceptTypes WebChromeClient ──
    // acceptTypes bisa berisi ["image/*"], [".jpg,.png"], ["image/jpeg","image/png"], atau [""]
    private fun resolveMimeType(params: WebChromeClient.FileChooserParams?): String {
        val raw = params?.acceptTypes
            ?.flatMap { it.split(",") }          // pisah "image/jpeg,image/png" → list
            ?.map { it.trim() }
            ?.filter { it.isNotBlank() }
            ?: emptyList()

        if (raw.isEmpty()) return "*/*"

        // Konversi ekstensi file ke MIME type
        val mimes = raw.map { token ->
            when {
                token.startsWith(".") -> extensionToMime(token)
                else -> token
            }
        }

        if (mimes.size == 1) return mimes[0]

        // Jika semua image → image/*  (galeri bisa tampil)
        return when {
            mimes.all { it.startsWith("image/") } -> "image/*"
            mimes.all { it.startsWith("video/") } -> "video/*"
            mimes.all { it.startsWith("audio/") } -> "audio/*"
            else -> "*/*"
        }
    }

    private fun extensionToMime(ext: String): String = when (ext.lowercase()) {
        ".jpg", ".jpeg" -> "image/jpeg"
        ".png"          -> "image/png"
        ".gif"          -> "image/gif"
        ".webp"         -> "image/webp"
        ".pdf"          -> "application/pdf"
        ".doc"          -> "application/msword"
        ".docx"         -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ".xls"          -> "application/vnd.ms-excel"
        ".xlsx"         -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ".mp4"          -> "video/mp4"
        ".mp3"          -> "audio/mpeg"
        else            -> "*/*"
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            javaScriptCanOpenWindowsAutomatically = true
            mediaPlaybackRequiresUserGesture = false
            setGeolocationEnabled(true)
            allowFileAccess = true
            allowContentAccess = true
            setSupportMultipleWindows(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        // ── Setup Cookie Manager untuk Service Worker & PWA ──
        // Service Worker memerlukan third-party cookies untuk persistensi
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // JavaScript interface untuk menangani blob: URL download
        webView.addJavascriptInterface(BlobDownloadInterface(), "AndroidDownload")

        // JavaScript interface untuk menangani external links (target="_blank", window.open)
        webView.addJavascriptInterface(ExternalLinkInterface(), "AndroidExternalLink")

        // JavaScript interface untuk mengubah warna status bar
        webView.addJavascriptInterface(StatusBarInterface(), "AndroidStatusBar")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                swipeRefreshLayout.isRefreshing = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefreshLayout.isRefreshing = false
                // Inject JS untuk mencegat blob: URL download sebelum sampai ke download listener
                injectBlobDownloadInterceptor()
                // Inject JS untuk menangani target="_blank" links
                injectExternalLinkInterceptor()
                // Inject JS untuk mengubah warna status bar mengikuti web
                injectStatusBarColorScript()
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                swipeRefreshLayout.isRefreshing = false
                if (request?.isForMainFrame == true) {
                    webView.loadUrl("file:///android_asset/error.html")
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrl(url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return url?.let { handleUrl(it) } ?: false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                swipeRefreshLayout.isRefreshing = newProgress < 100
            }

            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setCancelable(false).show()
                return true
            }

            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setNegativeButton("Batal") { _, _ -> result?.cancel() }
                    .setCancelable(false).show()
                return true
            }

            override fun onJsPrompt(view: WebView?, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?): Boolean {
                val input = android.widget.EditText(this@MainActivity).also { it.setText(defaultValue) }
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message).setView(input)
                    .setPositiveButton("OK") { _, _ -> result?.confirm(input.text.toString()) }
                    .setNegativeButton("Batal") { _, _ -> result?.cancel() }
                    .setCancelable(false).show()
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback
                openFilePicker(fileChooserParams)
                return true
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                customView?.let { callback?.onCustomViewHidden(); return }
                customView = view
                customViewCallback = callback
                customViewContainer?.apply { addView(view); visibility = View.VISIBLE }
                webView.visibility = View.GONE
                swipeRefreshLayout.visibility = View.GONE
            }

            override fun onHideCustomView() {
                customViewContainer?.apply { removeView(customView); visibility = View.GONE }
                customView = null
                customViewCallback?.onCustomViewHidden()
                webView.visibility = View.VISIBLE
                swipeRefreshLayout.visibility = View.VISIBLE
            }

            // __GEOLOCATION_METHOD__
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.let {
                    val granted = mutableListOf<String>()
                    for (res in it.resources) {
                        if (res == PermissionRequest.RESOURCE_VIDEO_CAPTURE &&
                            ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            granted.add(res)
                        } else if (res == PermissionRequest.RESOURCE_AUDIO_CAPTURE &&
                            ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            granted.add(res)
                        } else if (res == PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID) {
                            granted.add(res)
                        }
                    }
                    if (granted.isNotEmpty()) {
                        runOnUiThread { it.grant(granted.toTypedArray()) }
                    } else {
                        runOnUiThread { it.deny() }
                    }
                }
            }
        }
    }

    // ── Buka file picker dengan MIME type yang benar ──
    private fun openFilePicker(fileChooserParams: WebChromeClient.FileChooserParams?) {
        val mimeType = resolveMimeType(fileChooserParams)
        val allowMultiple = fileChooserParams?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE

        val extraIntents = mutableListOf<Intent>()

        // Kamera (jika izin sudah diberikan)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED) {
            val uri = createCameraImageUri()
            if (uri != null) {
                cameraImageUri = uri
                extraIntents.add(
                    Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                        putExtra(MediaStore.EXTRA_OUTPUT, uri)
                    }
                )
            }
        }

        // Galeri / file picker — gunakan ACTION_GET_CONTENT agar galeri muncul
        val fileIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = mimeType
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
        }

        val chooser = Intent.createChooser(fileIntent, "Pilih file atau ambil foto")
        if (extraIntents.isNotEmpty()) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toTypedArray())
        }

        try {
            startActivityForResult(chooser, FILE_CHOOSER_REQUEST_CODE)
        } catch (e: ActivityNotFoundException) {
            pendingFileCallback?.onReceiveValue(null)
            pendingFileCallback = null
            cameraImageUri = null
            Toast.makeText(this, "Tidak ada aplikasi untuk membuka file", Toast.LENGTH_SHORT).show()
        }
    }

    private fun createCameraImageUri(): Uri? {
        return try {
            val cv = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, "foto_${System.currentTimeMillis()}.jpg")
                put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES)
                }
            }
            contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv)
        } catch (e: Exception) { null }
    }

    // ── Download Manager — tangani URL biasa dan blob: ──
    private fun setupDownloadListener() {
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (url.startsWith("blob:")) {
                // Blob URL → gunakan JavaScript untuk konversi ke base64 lalu simpan
                downloadBlobUrl(url, mimeType, contentDisposition)
            } else if (url.startsWith("data:")) {
                // Data URL → decode langsung
                downloadDataUrl(url, contentDisposition)
            } else {
                // URL biasa → DownloadManager
                downloadWithManager(url, userAgent, contentDisposition, mimeType)
            }
        }
    }

    private fun downloadWithManager(url: String, userAgent: String, contentDisposition: String, mimeType: String) {
        try {
            val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val cookies = CookieManager.getInstance().getCookie(url) ?: ""

            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                if (userAgent.isNotBlank()) addRequestHeader("User-Agent", userAgent)
                if (cookies.isNotBlank()) addRequestHeader("Cookie", cookies)
                setTitle(fileName)
                setDescription("Mengunduh $fileName...")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                setAllowedNetworkTypes(
                    DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE
                )
            }
            val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "Mengunduh $fileName...", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (ex: Exception) {
                Toast.makeText(this, "Gagal mengunduh file", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // Inject JS ke halaman untuk mencegat klik pada <a href="blob:..."> SEBELUM
    // mencapai download listener — lebih andal karena blob URL masih valid di konteks halaman.
    private fun injectBlobDownloadInterceptor() {
        val js = """
            (function() {
                if (window.__androidBlobInterceptorActive) return;
                window.__androidBlobInterceptorActive = true;

                function fetchBlobAndSend(href, filename) {
                    fetch(href)
                        .then(function(r) { return r.blob(); })
                        .then(function(blob) {
                            return new Promise(function(resolve, reject) {
                                var fr = new FileReader();
                                fr.onloadend = function() {
                                    if (fr.result) resolve(fr.result);
                                    else reject(new Error('FileReader returned empty'));
                                };
                                fr.onerror = function() { reject(fr.error); };
                                fr.readAsDataURL(blob);
                            });
                        })
                        .then(function(dataUrl) {
                            var mime = dataUrl.split(':')[1].split(';')[0];
                            var base64 = dataUrl.split(',')[1];
                            AndroidDownload.receiveBase64(filename, mime, base64);
                        })
                        .catch(function(err) {
                            AndroidDownload.onError(String(err));
                        });
                }

                // Tangkap klik pada anchor dengan href blob:
                document.addEventListener('click', function(e) {
                    var el = e.target;
                    // Telusuri ke atas mencari elemen <a>
                    while (el && el.tagName !== 'A') el = el.parentElement;
                    if (el && el.href && el.href.startsWith('blob:')) {
                        e.preventDefault();
                        e.stopPropagation();
                        var filename = el.getAttribute('download') || el.getAttribute('filename') || 'download_' + Date.now();
                        AndroidDownload.onDownloadStart(filename);
                        fetchBlobAndSend(el.href, filename);
                    }
                }, true);
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    // Inject JS untuk menangani target="_blank" links dan window.open()
    private fun injectExternalLinkInterceptor() {
        val js = """
            (function() {
                if (window.__androidExternalLinkActive) return;
                window.__androidExternalLinkActive = true;

                // Override window.open
                var originalOpen = window.open;
                window.open = function(url, target, features) {
                    // Kirim URL ke native handler
                    if (url) {
                        AndroidExternalLink.handleUrl(url);
                    }
                    return null; // Block popup
                };

                // Intercept semua link dengan target="_blank" atau target lainnya
                document.addEventListener('click', function(e) {
                    var el = e.target;
                    // Telusuri ke atas mencari elemen <a>
                    while (el && el.tagName !== 'A') el = el.parentElement;
                    if (el && el.target && el.target !== '_self' && el.href) {
                        e.preventDefault();
                        e.stopPropagation();
                        AndroidExternalLink.handleUrl(el.href);
                    }
                }, true);
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    // Inject JS untuk mengubah warna status bar mengikuti warna header/element web
    private fun injectStatusBarColorScript() {
        val js = """
            (function() {
                // Fungsi untuk mengambil warna dari elemen
                function getBackgroundColor(element) {
                    while (element) {
                        var bg = window.getComputedStyle(element).backgroundColor;
                        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                            return bg;
                        }
                        element = element.parentElement;
                    }
                    return null;
                }

                // Fungsi untuk mengubah warna status bar
                function updateStatusBarColor() {
                    if (typeof AndroidStatusBar === 'undefined') return;

                    var color = null;

                    // 1. Prioritas 1: Cek meta tag theme-color (standar Chrome/Safari)
                    var themeColorMeta = document.querySelector('meta[name="theme-color"]');
                    if (themeColorMeta && themeColorMeta.content) {
                        color = themeColorMeta.content;
                    }

                    // 2. Prioritas 2: Cek meta tag apple-mobile-web-app-status-bar-style
                    if (!color) {
                        var appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
                        if (appleMeta && appleMeta.content === 'black-translucent') {
                            color = '#000000';
                        }
                    }

                    // 3. Prioritas 3: Cek warna background dari header, navbar, atau body
                    if (!color) {
                        var header = document.querySelector('header') ||
                                     document.querySelector('.header') ||
                                     document.querySelector('.navbar') ||
                                     document.querySelector('[class*="header"]') ||
                                     document.querySelector('[class*="navbar"]') ||
                                     document.querySelector('[id*="header"]') ||
                                     document.querySelector('[id*="navbar"]') ||
                                     document.body;

                        if (header) {
                            color = getBackgroundColor(header);
                        }
                    }

                    // Apply color jika ditemukan
                    if (color) {
                        // Convert rgb/rgba to hex
                        if (color.startsWith('rgb')) {
                            var rgb = color.match(/\d+/g);
                            if (rgb && rgb.length >= 3) {
                                var hex = '#' +
                                    ('0' + parseInt(rgb[0], 10).toString(16)).slice(-2) +
                                    ('0' + parseInt(rgb[1], 10).toString(16)).slice(-2) +
                                    ('0' + parseInt(rgb[2], 10).toString(16)).slice(-2);
                                AndroidStatusBar.setColor(hex);
                            }
                        } else if (color.startsWith('#')) {
                            // Expand shorthand hex (#fff -> #ffffff)
                            if (color.length === 4) {
                                color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
                            }
                            AndroidStatusBar.setColor(color);
                        }
                    }
                }

                var timeout;
                var lastRun = 0;
                function throttledUpdate() {
                    var now = Date.now();
                    if (now - lastRun >= 250) {
                        updateStatusBarColor();
                        lastRun = now;
                    } else {
                        clearTimeout(timeout);
                        timeout = setTimeout(function() {
                            updateStatusBarColor();
                            lastRun = Date.now();
                        }, 250);
                    }
                }

                // Update saat load complete
                if (document.readyState === 'complete') {
                    setTimeout(updateStatusBarColor, 100);
                } else {
                    window.addEventListener('load', function() {
                        setTimeout(updateStatusBarColor, 100);
                    });
                }

                // Observe perubahan DOM untuk update warna dengan debounce
                var observer = new MutationObserver(function(mutations) {
                    throttledUpdate();
                });
                observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });

                // Observe perubahan pada meta tag theme-color
                var metaObserver = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'content') {
                            updateStatusBarColor();
                        }
                    });
                });

                // Monitor semua meta tag yang sudah ada dan yang akan ditambahkan
                function observeMetaTags() {
                    var metaTags = document.querySelectorAll('meta[name="theme-color"], meta[name="apple-mobile-web-app-status-bar-style"]');
                    metaTags.forEach(function(meta) {
                        metaObserver.observe(meta, { attributes: true });
                    });
                }
                observeMetaTags();

                // Re-observe saat DOM berubah (untuk meta tag baru)
                var metaTagObserver = new MutationObserver(function(mutations) {
                    var shouldReobserve = false;
                    mutations.forEach(function(mutation) {
                        if (mutation.addedNodes.length > 0) {
                            mutation.addedNodes.forEach(function(node) {
                                if (node.nodeType === 1 && (
                                    node.tagName === 'META' &&
                                    (node.getAttribute('name') === 'theme-color' ||
                                     node.getAttribute('name') === 'apple-mobile-web-app-status-bar-style')
                                )) {
                                    shouldReobserve = true;
                                }
                            });
                        }
                    });
                    if (shouldReobserve) {
                        observeMetaTags();
                        updateStatusBarColor();
                    }
                });
                metaTagObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true
                });

                // Update saat scroll dengan throttle (untuk sticky header)
                window.addEventListener('scroll', throttledUpdate, { passive: true });
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    // Fallback: dipanggil dari download listener jika blob URL sampai sini
    // (misal download dipicu programatik bukan klik anchor)
    private fun downloadBlobUrl(blobUrl: String, mimeType: String, contentDisposition: String) {
        val fileName = URLUtil.guessFileName(blobUrl, contentDisposition, mimeType)
            .let { if (it == "downloadfile") "file_${System.currentTimeMillis()}" else it }

        // Gunakan fetch() — BUKAN XHR — karena fetch() menangani blob: URL dengan benar.
        // XHR mengembalikan status=0 untuk blob URL (bukan 200) sehingga cek status gagal.
        val escapedUrl = blobUrl.replace("'", "\\'")
        val escapedName = fileName.replace("'", "\\'")
        val js = """
            (function() {
                fetch('$escapedUrl')
                    .then(function(r) { return r.blob(); })
                    .then(function(blob) {
                        return new Promise(function(resolve, reject) {
                            var fr = new FileReader();
                            fr.onloadend = function() {
                                if (fr.result) resolve(fr.result);
                                else reject(new Error('FileReader empty'));
                            };
                            fr.onerror = function() { reject(fr.error); };
                            fr.readAsDataURL(blob);
                        });
                    })
                    .then(function(dataUrl) {
                        var mime = dataUrl.split(':')[1].split(';')[0];
                        var base64 = dataUrl.split(',')[1];
                        AndroidDownload.receiveBase64('$escapedName', mime, base64);
                    })
                    .catch(function(err) {
                        AndroidDownload.onError(String(err));
                    });
            })();
        """.trimIndent()

        webView.evaluateJavascript(js, null)
    }

    private fun downloadDataUrl(dataUrl: String, contentDisposition: String) {
        try {
            // Format: data:<mimeType>;base64,<data>
            val parts = dataUrl.split(",", limit = 2)
            if (parts.size != 2) return
            val meta = parts[0]   // data:image/png;base64
            val base64Data = parts[1]
            val mime = meta.substringAfter("data:").substringBefore(";")
            val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "bin"
            val fileName = "download_${System.currentTimeMillis()}.$ext"

            saveBase64ToDownloads(fileName, mime, base64Data)
        } catch (e: Exception) {
            Toast.makeText(this, "Gagal menyimpan file", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveBase64ToDownloads(fileName: String, mimeType: String, base64: String) {
        try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ → MediaStore (tidak butuh WRITE permission)
                val cv = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv)
                uri?.let {
                    contentResolver.openOutputStream(it)?.use { os -> os.write(bytes) }
                }
            } else {
                // Android 9 ke bawah → file langsung
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val file = File(dir, fileName)
                FileOutputStream(file).use { it.write(bytes) }
            }

            Toast.makeText(this, "File disimpan: $fileName", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Gagal menyimpan file: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    // ── JavaScript Interface untuk blob download ──
    inner class BlobDownloadInterface {

        @JavascriptInterface
        fun onDownloadStart(fileName: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Menyiapkan: $fileName...", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun receiveBase64(fileName: String, mimeType: String, base64: String) {
            runOnUiThread {
                saveBase64ToDownloads(fileName, mimeType, base64)
            }
        }

        @JavascriptInterface
        fun onError(message: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, "Unduhan gagal: $message", Toast.LENGTH_LONG).show()
            }
        }
    }

    // ── JavaScript Interface untuk external links (target="_blank", window.open) ──
    inner class ExternalLinkInterface {

        @JavascriptInterface
        fun handleUrl(url: String) {
            runOnUiThread {
                // Route URL ke handler yang tepat
                if (!this@MainActivity.handleUrl(url)) {
                    // Jika tidak ditangani oleh handleUrl, buka di browser eksternal
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(intent)
                    } catch (e: Exception) {
                        Toast.makeText(this@MainActivity, "Tidak dapat membuka link", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    // ── URL Router ──
    private fun handleUrl(url: String): Boolean {
        if (oauthDomains.any { url.contains(it) }) {
            openInCustomTab(url)
            return true
        }
        return when {
            url.startsWith("https://wa.me/") || url.startsWith("https://api.whatsapp.com/") ||
            url.startsWith("whatsapp://") -> { openExternalApp(url); true }
            url.startsWith("tel:") -> { openExternalApp(url); true }
            url.startsWith("mailto:") -> { openExternalApp(url); true }
            url.startsWith("sms:") -> { openExternalApp(url); true }
            url.startsWith("tg:") || url.contains("t.me/") -> { openExternalApp(url); true }
            url.contains("play.google.com") || url.startsWith("market://") -> { openExternalApp(url); true }
            url.startsWith("intent:") -> {
                try {
                    val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    if (intent.resolveActivity(packageManager) != null) startActivity(intent)
                } catch (e: Exception) { e.printStackTrace() }
                true
            }
            else -> false
        }
    }

    private fun openInCustomTab(url: String) {
        try {
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(this, Uri.parse(url))
        } catch (e: Exception) { openExternalApp(url) }
    }

    private fun openExternalApp(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (e: Exception) {
            // Jika aplikasi pihak ketiga tidak ditemukan
            if (url.startsWith("whatsapp://")) {
                // Fallback ke WhatsApp Web jika aplikasi WhatsApp tidak ada
                var fallbackUrl = "https://wa.me/"
                if (url.contains("phone=")) {
                    fallbackUrl = url.replace("whatsapp://send?phone=", "https://wa.me/")
                } else if (url.contains("text=")) {
                    fallbackUrl = url.replace("whatsapp://send?text=", "https://wa.me/?text=")
                }
                
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    })
                } catch (ex: Exception) {
                    Toast.makeText(this, "Tidak dapat membuka tautan WhatsApp", Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(this, "Aplikasi untuk membuka tautan ini tidak ditemukan", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupSwipeRefresh() {
        swipeRefreshLayout.setOnRefreshListener { webView.reload() }
        swipeRefreshLayout.setColorSchemeResources(
            android.R.color.holo_blue_bright,
            android.R.color.holo_green_light,
            android.R.color.holo_orange_light,
            android.R.color.holo_red_light
        )
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    fun printPage() {
        val printManager = getSystemService(PRINT_SERVICE) as PrintManager
        val jobName = "${getString(R.string.app_name)} - Print"
        printManager.print(jobName, webView.createPrintDocumentAdapter(jobName), null)
    }

    // ── onActivityResult: file picker + kamera ──
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode != FILE_CHOOSER_REQUEST_CODE) return

        if (resultCode != Activity.RESULT_OK) {
            cameraImageUri?.let { contentResolver.delete(it, null, null) }
            pendingFileCallback?.onReceiveValue(null)
            pendingFileCallback = null
            cameraImageUri = null
            return
        }

        val results = mutableListOf<Uri>()

        if (data != null) {
            when {
                data.clipData != null -> {
                    val clip = data.clipData!!
                    for (i in 0 until clip.itemCount) results.add(clip.getItemAt(i).uri)
                }
                data.data != null -> results.add(data.data!!)
            }
        }

        // Jika data null/kosong → user memilih kamera, pakai cameraImageUri
        if (results.isEmpty() && cameraImageUri != null) {
            results.add(cameraImageUri!!)
        }

        pendingFileCallback?.onReceiveValue(
            if (results.isNotEmpty()) results.toTypedArray() else null
        )
        pendingFileCallback = null
        cameraImageUri = null
    }

    // ── Permission Result ──
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            PERMISSION_REQUEST_CODE -> {
                val denied = permissions.filterIndexed { i, _ ->
                    grantResults.getOrNull(i) != PackageManager.PERMISSION_GRANTED
                }
                if (denied.isNotEmpty()) {
                    Toast.makeText(
                        this,
                        "Beberapa izin ditolak. Fitur upload/kamera mungkin tidak berfungsi.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
            // __GPS_PERMISSION_RESULT__
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        when {
            customView != null -> (webView.webChromeClient as? WebChromeClient)?.onHideCustomView()
            webView.canGoBack() -> webView.goBack()
            else -> super.onBackPressed()
        }
    }

    override fun onPause() { super.onPause(); webView.onPause() }
    override fun onResume() { super.onResume(); webView.onResume() }

    // ── Status Bar Color Control (follow web content) ──
    private var currentStatusBarColor = Color.TRANSPARENT
    private val defaultStatusBarColor = Color.parseColor("#6200EE") // Default purple

    fun setStatusBarColor(color: String) {
        runOnUiThread {
            try {
                val targetColor = Color.parseColor(color)

                // Animate color transition for smooth effect (300ms)
                val colorAnimator = ValueAnimator.ofArgb(currentStatusBarColor, targetColor)
                colorAnimator.duration = 300
                colorAnimator.interpolator = DecelerateInterpolator()
                colorAnimator.addUpdateListener { animator ->
                    val animatedColor = animator.animatedValue as Int
                    window.statusBarColor = animatedColor
                }
                colorAnimator.start()

                currentStatusBarColor = targetColor

                // Set status bar content color based on brightness (light/dark icons)
                val darkness = 1 - (0.299 * Color.red(targetColor) + 0.587 * Color.green(targetColor) + 0.114 * Color.blue(targetColor)) / 255
                val isLightBackground = darkness < 0.5

                // Use WindowInsetsControllerCompat for API 30+ (better backward compatibility)
                WindowCompat.setDecorFitsSystemWindows(window, true)
                val insetsController = WindowCompat.getInsetsController(window, window.decorView)
                insetsController?.let {
                    it.isAppearanceLightStatusBars = isLightBackground
                    it.isAppearanceLightNavigationBars = isLightBackground
                }
            } catch (e: Exception) {
                // Invalid color, use fallback
                setStatusBarColorInternal(defaultStatusBarColor)
            }
        }
    }

    private fun setStatusBarColorInternal(color: Int) {
        window.statusBarColor = color
        currentStatusBarColor = color
    }

    // ── JavaScript Interface untuk Status Bar ──
    inner class StatusBarInterface {
        @JavascriptInterface
        fun setColor(color: String) {
            setStatusBarColor(color)
        }
    }
}
