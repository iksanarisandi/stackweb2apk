package __PACKAGE_NAME__

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.print.PrintManager
import android.provider.MediaStore
import android.view.View
import android.webkit.*
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
// __GPS_IMPORT__
// __CAMERA_IMPORT__

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private val appUrl = "__APP_URL__"

    // ── File Upload Support ──
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 1001
    private val FILE_CHOOSER_PERMISSION_CODE = 1002

    // ── Fullscreen Video Support ──
    private var customView: View? = null
    private var customViewContainer: FrameLayout? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    // __GPS_PERMISSION_CONST__

    // ── Google OAuth & trusted login domains → Chrome Custom Tabs ──
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

        // Fullscreen video container
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
        // __GPS_PERMISSION_REQUEST__

        if (isNetworkAvailable()) {
            webView.loadUrl(appUrl)
        } else {
            webView.loadUrl("file:///android_asset/error.html")
        }
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

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                swipeRefreshLayout.isRefreshing = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefreshLayout.isRefreshing = false
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

            // ── Progress bar ──
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                swipeRefreshLayout.isRefreshing = newProgress < 100
            }

            // ── JS alert() ──
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setCancelable(false)
                    .show()
                return true
            }

            // ── JS confirm() ──
            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton("OK") { _, _ -> result?.confirm() }
                    .setNegativeButton("Batal") { _, _ -> result?.cancel() }
                    .setCancelable(false)
                    .show()
                return true
            }

            // ── JS prompt() ──
            override fun onJsPrompt(view: WebView?, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?): Boolean {
                val input = android.widget.EditText(this@MainActivity).also { it.setText(defaultValue) }
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setView(input)
                    .setPositiveButton("OK") { _, _ -> result?.confirm(input.text.toString()) }
                    .setNegativeButton("Batal") { _, _ -> result?.cancel() }
                    .setCancelable(false)
                    .show()
                return true
            }

            // ── File Upload (all types: image, PDF, doc, video, dll.) ──
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback

                val needsStoragePerm = android.os.Build.VERSION.SDK_INT < 33 &&
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED

                if (needsStoragePerm) {
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE),
                        FILE_CHOOSER_PERMISSION_CODE
                    )
                    return true
                }

                openFilePicker(fileChooserParams)
                return true
            }

            // ── Fullscreen Video (YouTube embed, HTML5 video) ──
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                customView?.let {
                    callback?.onCustomViewHidden()
                    return
                }
                customView = view
                customViewCallback = callback
                customViewContainer?.apply {
                    addView(view)
                    visibility = View.VISIBLE
                }
                webView.visibility = View.GONE
                swipeRefreshLayout.visibility = View.GONE
            }

            override fun onHideCustomView() {
                customViewContainer?.apply {
                    removeView(customView)
                    visibility = View.GONE
                }
                customView = null
                customViewCallback?.onCustomViewHidden()
                webView.visibility = View.VISIBLE
                swipeRefreshLayout.visibility = View.VISIBLE
            }

            // __GEOLOCATION_METHOD__
            // __CAMERA_PERMISSION_METHOD__
        }
    }

    // ── Open file picker (all types + camera) ──
    private fun openFilePicker(fileChooserParams: WebChromeClient.FileChooserParams?) {
        val acceptTypes = fileChooserParams?.acceptTypes?.joinToString(",") ?: "*/*"
        val mimeType = if (acceptTypes.isBlank() || acceptTypes == ",") "*/*" else acceptTypes

        // Camera intent
        val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)

        // All-file picker
        val fileIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = mimeType
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }

        val chooser = Intent.createChooser(fileIntent, "Pilih file atau ambil foto")
        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))

        try {
            startActivityForResult(chooser, FILE_CHOOSER_REQUEST_CODE)
        } catch (e: ActivityNotFoundException) {
            pendingFileCallback?.onReceiveValue(null)
            pendingFileCallback = null
        }
    }

    // ── Download Manager (export CSV, PDF, Excel, dll.) ──
    private fun setupDownloadListener() {
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimeType)
                    addRequestHeader("User-Agent", userAgent)
                    addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
                    setTitle(fileName)
                    setDescription("Mengunduh $fileName...")
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE)
                }
                val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(this, "Mengunduh $fileName...", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                // Fallback: open in browser
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (ex: Exception) {
                    Toast.makeText(this, "Gagal membuka file", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ── URL Router ──
    private fun handleUrl(url: String): Boolean {
        // Google OAuth, social login → Chrome Custom Tabs (required: Google blocks WebView auth)
        if (oauthDomains.any { url.contains(it) }) {
            openInCustomTab(url)
            return true
        }
        // External apps
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

    // ── Chrome Custom Tabs — untuk Google Login / OAuth ──
    private fun openInCustomTab(url: String) {
        try {
            CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()
                .launchUrl(this, Uri.parse(url))
        } catch (e: Exception) {
            openExternalApp(url)
        }
    }

    private fun openExternalApp(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (e: Exception) { e.printStackTrace() }
    }

    // ── Swipe-to-Refresh ──
    private fun setupSwipeRefresh() {
        swipeRefreshLayout.setOnRefreshListener { webView.reload() }
        swipeRefreshLayout.setColorSchemeResources(
            android.R.color.holo_blue_bright,
            android.R.color.holo_green_light,
            android.R.color.holo_orange_light,
            android.R.color.holo_red_light
        )
    }

    // ── Network Check ──
    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // ── Print Page ──
    fun printPage() {
        val printManager = getSystemService(PRINT_SERVICE) as PrintManager
        val jobName = "${getString(R.string.app_name)} - Print"
        val printAdapter = webView.createPrintDocumentAdapter(jobName)
        printManager.print(jobName, printAdapter, null)
    }

    // ── onActivityResult: file picker ──
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            pendingFileCallback?.onReceiveValue(
                if (resultCode == Activity.RESULT_OK) {
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                } else null
            )
            pendingFileCallback = null
        }
    }

    // ── Permission Result: storage for file upload ──
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            FILE_CHOOSER_PERMISSION_CODE -> {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    openFilePicker(null)
                } else {
                    pendingFileCallback?.onReceiveValue(null)
                    pendingFileCallback = null
                    Toast.makeText(this, "Izin penyimpanan diperlukan untuk memilih file", Toast.LENGTH_SHORT).show()
                }
            }
            // __GPS_PERMISSION_RESULT__
        }
    }

    // ── Back Navigation (fullscreen video aware) ──
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        when {
            customView != null -> {
                (webView.webChromeClient as? WebChromeClient)?.onHideCustomView()
            }
            webView.canGoBack() -> webView.goBack()
            else -> super.onBackPressed()
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }
}
