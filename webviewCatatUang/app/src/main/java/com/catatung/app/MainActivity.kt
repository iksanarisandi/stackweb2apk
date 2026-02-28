package __PACKAGE_NAME__

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
import android.webkit.*
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File
import java.io.FileOutputStream
// __GPS_IMPORT__
// __CAMERA_IMPORT__

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
        requestRequiredPermissions()

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

        // JavaScript interface untuk menangani blob: URL download
        webView.addJavascriptInterface(BlobDownloadInterface(), "AndroidDownload")

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
            // __CAMERA_PERMISSION_METHOD__
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
        } catch (e: Exception) { e.printStackTrace() }
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
}
