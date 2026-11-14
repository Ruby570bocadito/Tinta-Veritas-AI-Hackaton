package app.tinta;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.util.Locale;

/**
 * Tinta on Android: the same web app, bundled inside the APK so it runs offline.
 * The only native piece is the voice that dictates the phone number, because
 * Android WebView has no speech synthesis of its own.
 */
public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/index.html";
    private WebView web;
    private TextToSpeech voice;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        voice = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                voice.setLanguage(Locale.US);
                voice.setSpeechRate(0.8f);
            }
        });

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // Debug builds can be inspected from a computer (chrome://inspect); release builds cannot.
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "TintaNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
        });
        setContentView(web);

        Uri link = getIntent().getData(); // lets a developer point the app at a dev server
        String query = getIntent().getStringExtra("query");
        web.loadUrl(link != null ? link.toString() : HOME + (query != null ? "?" + query : ""));
    }

    private class Bridge {
        @JavascriptInterface
        public void speak(String text) {
            voice.speak(text, TextToSpeech.QUEUE_FLUSH, null, "tinta");
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        voice.shutdown();
        super.onDestroy();
    }
}
