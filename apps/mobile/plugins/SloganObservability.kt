package com.slogan.mobile

import android.content.Context
import io.sentry.SentryEvent
import io.sentry.SentryLevel
import io.sentry.protocol.Message
import io.sentry.protocol.SentryException
import io.sentry.protocol.SentryStackFrame
import io.sentry.protocol.SentryStackTrace
import io.sentry.react.RNSentrySDK
import org.json.JSONObject

/** Used before React/JS starts. No raw event, scope or memory dump is persisted. */
object SloganObservability {
  fun initialize(context: Context) {
    val config = JSONObject(context.assets.open("slogan.observability.json").bufferedReader().use { it.readText() })
    if (!config.getBoolean("enabled")) return
    RNSentrySDK.init(context) { options ->
      options.dsn = config.getString("dsn")
      options.release = config.getString("release")
      options.dist = config.getString("build")
      options.environment = config.getString("environment")
      options.isSendDefaultPii = false
      options.isEnableScopePersistence = false
      options.isEnableNdk = false
      options.isEnableScopeSync = false
      options.isEnableAutoSessionTracking = false
      options.isAttachThreads = false
      options.isAttachScreenshot = false
      options.isAttachViewHierarchy = false
      options.isAttachServerName = false
      options.maxBreadcrumbs = 0
      options.maxAttachmentSize = 0
      options.shutdownTimeoutMillis = 2000
      options.flushTimeoutMillis = 2000
      options.isSendClientReports = false
      options.logs.isEnabled = false
      options.metrics.isEnabled = false
      options.integrations.removeAll { !it.javaClass.simpleName.contains("UncaughtExceptionHandler") }
      options.setBeforeBreadcrumb { _, _ -> null }
      options.setBeforeSend { event, hint ->
        hint.clearAttachments()
        hint.screenshot = null
        hint.viewHierarchy = null
        hint.threadDump = null
        hint.tombstone = null
        sanitize(event, config)
      }
    }
  }

  fun sanitize(event: SentryEvent, config: JSONObject): SentryEvent {
    val clean = SentryEvent()
    clean.eventId = event.eventId
    clean.timestamp = event.timestamp
    clean.level = SentryLevel.ERROR
    clean.release = config.getString("release")
    clean.dist = config.getString("build")
    clean.environment = config.getString("environment")
    clean.platform = "java"
    clean.setTag("service", "mobile")
    clean.setTag("platform", "android")
    clean.setTag("build", config.getString("build"))
    clean.setTag("resultCode", "NATIVE_CRASH")
    clean.message = Message().apply { formatted = "NATIVE_CRASH" }
    clean.exceptions = event.exceptions?.takeLast(1)?.map { original ->
      SentryException().apply {
        type = "NativeError"
        value = "NATIVE_CRASH"
        stacktrace = SentryStackTrace(original.stacktrace?.frames?.takeLast(30)?.mapNotNull { frame ->
          val file = frame.filename ?: return@mapNotNull null
          if (!Regex("^[a-zA-Z0-9_.-]+\\.(kt|java)$").matches(file)) return@mapNotNull null
          SentryStackFrame().apply {
            filename = file
            lineno = frame.lineno
            if (frame.module?.matches(Regex("^(com\\.(slogan|facebook)|java|android|expo|org\\.webrtc)\\.[a-zA-Z0-9_.$]{1,180}$")) == true) module = frame.module
            if (frame.function?.matches(Regex("^[a-zA-Z_$][a-zA-Z0-9_$<>]{0,120}$")) == true) function = frame.function
          }
        } ?: emptyList())
      }
    }
    return clean
  }
}
