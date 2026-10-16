import com.slogan.mobile.SloganObservability;
import io.sentry.*;
import io.sentry.cache.EnvelopeCache;
import io.sentry.protocol.*;
import io.sentry.transport.*;
import org.json.JSONObject;
import java.io.*;
import java.nio.file.*;
import java.util.*;

/** Exercises the compiled Android callback through the real Java SDK disk cache. */
public final class NativeObservabilityCanary {
  public static void main(String[] args) throws Exception {
    String canary = "PRIVATE_NATIVE_CANARY";
    JSONObject config = new JSONObject().put("release", "slogan-mobile@abcdef123456").put("build", "abcdef123456").put("environment", "test");
    SentryOptions options = new SentryOptions();
    options.setDsn("https://0123456789abcdef@o123.ingest.us.sentry.io/123");
    options.setEnableScopePersistence(false);
    options.setSendClientReports(false);
    options.getIntegrations().clear();
    options.setCacheDirPath(args[0]);
    EnvelopeCache cache = new EnvelopeCache(options, args[0], 10);
    options.setBeforeSend((event, hint) -> { hint.clearAttachments(); return SloganObservability.INSTANCE.sanitize(event, config); });
    options.setTransportFactory((settings, details) -> new ITransport() {
      public void send(SentryEnvelope envelope, Hint hint) { cache.store(envelope, hint); }
      public void flush(long timeout) {}
      public RateLimiter getRateLimiter() { return null; }
      public void close() {}
      public void close(boolean restarting) {}
    });
    Sentry.init(options);
    try {
      SentryEvent event = new SentryEvent(new RuntimeException(canary));
      User user = new User(); user.setEmail(canary); event.setUser(user);
      event.setExtra("transcript", canary);
      Breadcrumb crumb = new Breadcrumb(); crumb.setMessage(canary); event.setBreadcrumbs(List.of(crumb));
      Message message = new Message(); message.setFormatted(canary); event.setMessage(message);
      SentryStackFrame frame = new SentryStackFrame(); frame.setFilename("MainApplication.kt"); frame.setModule("com.slogan.mobile.MainApplication"); frame.setFunction("onCreate"); frame.setLineno(42); frame.setVars(Map.of("token", canary));
      SentryException exception = new SentryException(); exception.setType("RuntimeException"); exception.setValue(canary); exception.setStacktrace(new SentryStackTrace(List.of(frame))); event.setExceptions(List.of(exception));
      Sentry.captureEvent(event);
      Sentry.flush(2000);
      boolean found = false;
      try (var files = Files.walk(Path.of(args[0]))) {
        for (Path file : files.filter(Files::isRegularFile).toList()) {
          String content = Files.readString(file);
          if (content.contains(canary)) throw new AssertionError("Native cache privacy failure");
          if (content.contains("NATIVE_CRASH")) {
            found = true;
            if (!content.contains("NativeObservabilityCanary.java") || !content.contains("lineno")) throw new AssertionError("Native source location missing");
          }
        }
      }
      if (!found) throw new AssertionError("No native event persisted");
      System.out.println("PASS: compiled native callback removed canary before real SDK disk caching");
    } finally { Sentry.close(); }
  }
}
