package expo.modules.sloganupdater

import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/** Controlled APK distribution only. No auth tokens or arbitrary URLs cross this boundary. */
class SloganUpdaterModule : Module() {
  private val busy = AtomicBoolean(false)
  private val canceled = AtomicBoolean(false)
  @Volatile private var connection: HttpURLConnection? = null
  @Volatile private var ready: Pair<File, JSONObject>? = null

  override fun definition() = ModuleDefinition {
    Name("SloganUpdater")
    Events("progress")

    AsyncFunction("check") {
      val response = open(URL("https://slogan-preview-mobile.pages.dev/downloads/android.json"))
      val data = try {
        response.inputStream.use { input ->
          val bytes = ByteArrayOutputStream()
          val buffer = ByteArray(4096)
          val started = SystemClock.elapsedRealtime()
          while (true) {
            require(SystemClock.elapsedRealtime() - started < 30_000) { "UPDATE_METADATA_INVALID" }
            val count = input.read(buffer)
            if (count == -1) break
            require(bytes.size() + count <= 64 * 1024) { "UPDATE_METADATA_INVALID" }
            bytes.write(buffer, 0, count)
          }
          JSONObject(bytes.toString("UTF-8"))
        }
      } finally {
        response.disconnect()
      }
      validate(data)
      val installed = installed()
      mapOf(
        "installedVersion" to (installed.versionName ?: ""),
        "installedVersionCode" to version(installed),
        "release" to if (data.getLong("versionCode") > version(installed)) data.toString() else null
      )
    }

    AsyncFunction("download") { raw: String -> download(JSONObject(raw)) }
    Function("cancel") { cancel() }
    Function("canInstall") {
      Build.VERSION.SDK_INT < 26 || context().packageManager.canRequestPackageInstalls()
    }
    AsyncFunction("openSettings") {
      val activity = appContext.currentActivity ?: error("UPDATE_ACTIVITY_UNAVAILABLE")
      activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:${context().packageName}")))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("install") {
      val (file, data) = ready ?: error("UPDATE_NOT_READY")
      validate(data)
      require(data.getLong("versionCode") > version(installed())) { "UPDATE_NOT_NEWER" }
      require(file.exists() && file.length() == data.getLong("bytes")) { "UPDATE_NOT_READY" }
      require(Build.VERSION.SDK_INT < 26 || context().packageManager.canRequestPackageInstalls()) {
        "UPDATE_PERMISSION_REQUIRED"
      }
      val activity = appContext.currentActivity ?: error("UPDATE_ACTIVITY_UNAVAILABLE")
      val uri = FileProvider.getUriForFile(context(), "${context().packageName}.slogan-updates", file)
      activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      })
    }.runOnQueue(Queues.MAIN)
    OnDestroy { cancel() }
  }

  private fun context() = appContext.reactContext ?: error("UPDATE_CONTEXT_UNAVAILABLE")
  @Suppress("DEPRECATION")
  private fun flags() = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES
    else PackageManager.GET_SIGNATURES
  @Suppress("DEPRECATION")
  private fun installed() = context().packageManager.getPackageInfo(context().packageName, flags())
  @Suppress("DEPRECATION")
  private fun version(info: PackageInfo) = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode
    else info.versionCode.toLong()
  @Suppress("DEPRECATION")
  private fun certificate(info: PackageInfo): String {
    val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners
      else info.signatures
    require(signatures?.size == 1) { "UPDATE_SIGNATURE_INVALID" }
    return hex(MessageDigest.getInstance("SHA-256").digest(signatures!![0].toByteArray()))
  }
  private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }

  private fun validate(data: JSONObject) {
    require(data.getString("commit").matches(Regex("[a-f0-9]{40}"))) { "UPDATE_METADATA_INVALID" }
    require(data.getString("sha256").matches(Regex("[a-f0-9]{64}"))) { "UPDATE_METADATA_INVALID" }
    require(data.getString("version").matches(Regex("[0-9]{1,9}\\.[0-9]{1,9}\\.[0-9]{1,9}"))) { "UPDATE_METADATA_INVALID" }
    require(data.getLong("versionCode") in 1..2100000000L) { "UPDATE_METADATA_INVALID" }
    require(data.getLong("bytes") in 1..250_000_000L) { "UPDATE_METADATA_INVALID" }
    require(data.getString("package") == context().packageName) { "UPDATE_PACKAGE_INVALID" }
    require(data.getString("certificateSha256") == certificate(installed())) { "UPDATE_SIGNATURE_INVALID" }
    val abi = data.getJSONArray("abi")
    require((0 until abi.length()).any { Build.SUPPORTED_ABIS.contains(abi.getString(it)) }) {
      "UPDATE_ABI_UNSUPPORTED"
    }
  }

  private fun trusted(url: URL) {
    require(url.protocol == "https" && url.userInfo == null && url.port in listOf(-1, 443)) {
      "UPDATE_SOURCE_INVALID"
    }
    require(url.host in setOf("slogan-preview-mobile.pages.dev", "github.com",
      "release-assets.githubusercontent.com", "objects.githubusercontent.com")) { "UPDATE_SOURCE_INVALID" }
  }

  private fun open(start: URL, transfer: Boolean = false): HttpURLConnection {
    var url = start
    repeat(6) {
      trusted(url)
      if (transfer && canceled.get()) error("UPDATE_CANCELED")
      val response = (url.openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false
        connectTimeout = 15_000
        readTimeout = 30_000
        useCaches = false
        setRequestProperty("Cache-Control", "no-cache")
        setRequestProperty("Accept-Encoding", "identity")
      }
      if (transfer) connection = response
      try {
        val status = response.responseCode
        if (status in listOf(301, 302, 303, 307, 308)) {
          val location = response.getHeaderField("Location") ?: error("UPDATE_SOURCE_INVALID")
          url = URL(url, location)
          response.disconnect()
        } else {
          require(status == 200) { "UPDATE_DOWNLOAD_FAILED" }
          return response
        }
      } catch (error: Exception) {
        response.disconnect()
        throw error
      }
    }
    error("UPDATE_SOURCE_INVALID")
  }

  private fun cancel() {
    canceled.set(true)
    connection?.disconnect()
  }

  private fun verify(file: File, data: JSONObject, digest: String) {
    require(file.length() == data.getLong("bytes") && digest == data.getString("sha256")) {
      "UPDATE_INTEGRITY_INVALID"
    }
    @Suppress("DEPRECATION")
    val archive = context().packageManager.getPackageArchiveInfo(file.path, flags())
      ?: error("UPDATE_APK_INVALID")
    require(archive.packageName == context().packageName && version(archive) == data.getLong("versionCode")) {
      "UPDATE_APK_INVALID"
    }
    require(certificate(archive) == certificate(installed())) { "UPDATE_SIGNATURE_INVALID" }
  }

  private fun download(data: JSONObject) {
    require(busy.compareAndSet(false, true)) { "UPDATE_BUSY" }
    canceled.set(false)
    ready = null
    val root = File(context().cacheDir, "slogan-updates")
    val verified = File(root, "verified")
    val partial = File(root, "download.part")
    var completed = false
    try {
      validate(data)
      require(data.getLong("versionCode") > version(installed())) { "UPDATE_NOT_NEWER" }
      verified.mkdirs()
      partial.delete()
      val target = File(verified, "${data.getString("sha256")}.apk")
      verified.listFiles()?.filter { it != target }?.forEach { it.delete() }
      if (target.exists()) {
        try {
          val digest = MessageDigest.getInstance("SHA-256")
          target.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
              if (canceled.get()) error("UPDATE_CANCELED")
              val count = input.read(buffer)
              if (count == -1) break
              digest.update(buffer, 0, count)
            }
          }
          verify(target, data, hex(digest.digest()))
          ready = target to data
          completed = true
          return
        } catch (error: Exception) {
          target.delete()
          if (canceled.get()) throw error
        }
      }
      val response = open(URL("https://github.com/cuilongsheng/Slogan/releases/download/android-${data.getString("commit")}/slogan.apk"), true)
      val expected = data.getLong("bytes")
      require(response.contentLengthLong == -1L || response.contentLengthLong == expected) {
        "UPDATE_INTEGRITY_INVALID"
      }
      val digest = MessageDigest.getInstance("SHA-256")
      var bytes = 0L
      var emitted = 0L
      val started = SystemClock.elapsedRealtime()
      response.inputStream.use { input ->
        partial.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            if (canceled.get()) error("UPDATE_CANCELED")
            require(SystemClock.elapsedRealtime() - started < 10 * 60_000) { "UPDATE_DOWNLOAD_FAILED" }
            val count = input.read(buffer)
            if (count == -1) break
            bytes += count
            require(bytes <= expected) { "UPDATE_INTEGRITY_INVALID" }
            digest.update(buffer, 0, count)
            output.write(buffer, 0, count)
            if (SystemClock.elapsedRealtime() - emitted >= 250 || bytes == expected) {
              sendEvent("progress", mapOf("bytes" to bytes, "total" to expected))
              emitted = SystemClock.elapsedRealtime()
            }
          }
        }
      }
      if (canceled.get()) error("UPDATE_CANCELED")
      verify(partial, data, hex(digest.digest()))
      require(partial.renameTo(target)) { "UPDATE_DOWNLOAD_FAILED" }
      ready = target to data
      completed = true
    } finally {
      connection?.disconnect()
      connection = null
      partial.delete()
      if (!completed) ready = null
      busy.set(false)
    }
  }
}
