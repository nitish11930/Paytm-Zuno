package in.munim.demo;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayInputStream;

public final class MainActivity extends Activity {
  private static final int MIC = 40, FILE = 41;
  private WebView web;
  private LinearLayout offline;
  private ProgressBar progress;
  private PermissionRequest pendingMic;
  private ValueCallback<Uri[]> pendingFile;
  private Uri endpoint;
  private boolean inForeground, requestingMic, grantOnResume;

  private boolean trusted(Uri uri) {
    return uri != null && "https".equals(uri.getScheme()) && endpoint.getHost().equals(uri.getHost())
      && uri.getPort() == endpoint.getPort() && uri.getUserInfo() == null;
  }
  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    endpoint = Uri.parse(getString(R.string.backend_url));
    if (!"https".equals(endpoint.getScheme()) || endpoint.getHost() == null) { finish(); return; }
    FrameLayout root = new FrameLayout(this);
    root.setBackgroundColor(Color.rgb(246,250,247));
    root.setOnApplyWindowInsetsListener((view,insets) -> {
      if (Build.VERSION.SDK_INT >= 30) {
        android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
        view.setPadding(bars.left,bars.top,bars.right,bars.bottom);
      } else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
      return insets;
    });
    web = new WebView(this);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setMediaPlaybackRequiresUserGesture(true);
    settings.setSupportMultipleWindows(false);
    settings.setGeolocationEnabled(false);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    WebView.setWebContentsDebuggingEnabled(false);
    root.addView(web,new FrameLayout.LayoutParams(-1,-1));
    progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
    FrameLayout.LayoutParams progressLayout = new FrameLayout.LayoutParams(-1,dp(3),Gravity.TOP);
    root.addView(progress,progressLayout);
    offline = new LinearLayout(this);
    offline.setOrientation(LinearLayout.VERTICAL);offline.setGravity(Gravity.CENTER);offline.setPadding(dp(30),dp(30),dp(30),dp(30));
    offline.setBackgroundColor(Color.rgb(246,250,247));
    TextView title=new TextView(this);title.setText("Munim");title.setTextSize(32);title.setTextColor(Color.rgb(6,75,58));title.setGravity(Gravity.CENTER);offline.addView(title);
    TextView help=new TextView(this);help.setText("Unable to connect securely.\nCheck your internet connection and try again.\nThis test app needs its online server.");help.setTextSize(16);help.setGravity(Gravity.CENTER);help.setPadding(0,dp(24),0,dp(24));offline.addView(help);
    Button retry=new Button(this);retry.setText("Try again");retry.setOnClickListener(v->load());offline.addView(retry);
    root.addView(offline,new FrameLayout.LayoutParams(-1,-1));offline.setVisibility(View.GONE);
    setContentView(root);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req) {
        if (trusted(req.getUrl())) return false;
        Toast.makeText(MainActivity.this,"External navigation is unavailable in this test app.",Toast.LENGTH_SHORT).show();return true;
      }
      @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req) {
        String scheme=req.getUrl().getScheme();
        if(trusted(req.getUrl()) || "data".equals(scheme) || "blob".equals(scheme)) return null;
        return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
      }
      @Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error) { if(req.isForMainFrame()) offline.setVisibility(View.VISIBLE); }
      @Override public void onReceivedHttpError(WebView view,WebResourceRequest req,WebResourceResponse response) { if(req.isForMainFrame() && response.getStatusCode() >= 500) offline.setVisibility(View.VISIBLE); }
      @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error) { handler.cancel();offline.setVisibility(View.VISIBLE); }
      @Override public void onPageFinished(WebView view,String url) { CookieManager.getInstance().flush(); }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onProgressChanged(WebView view,int value) { progress.setProgress(value);progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE); }
      @Override public void onPermissionRequest(PermissionRequest req) {
        if(!trusted(req.getOrigin()) || !inForeground || req.getResources().length != 1 || !PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(req.getResources()[0])) { req.deny();return; }
        if(pendingMic != null) pendingMic.deny();pendingMic=req;
        new AlertDialog.Builder(MainActivity.this).setTitle("Use microphone?").setMessage("Record only when you tap the mic. Audio is processed by the app's server and Sarvam. You can type instead.")
          .setPositiveButton("Allow",(dialog,which)->{
            if(checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) finishMic(true);
            else {requestingMic=true;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC);}
          }).setNegativeButton("Not now",(dialog,which)->finishMic(false)).setOnCancelListener(dialog->finishMic(false)).show();
      }
      @Override public void onPermissionRequestCanceled(PermissionRequest req) {if(pendingMic==req)pendingMic=null;}
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
        if(pendingFile != null)pendingFile.onReceiveValue(null);pendingFile=callback;
        Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType("audio/*");
        try{startActivityForResult(pick,FILE);}catch(Exception error){pendingFile.onReceiveValue(null);pendingFile=null;}
        return true;
      }
    });
    web.setDownloadListener((url,agent,disposition,mime,length)->{
      Uri uri=Uri.parse(url);
      if(!trusted(uri) || !"/api/export".equals(uri.getPath())) return;
      new AlertDialog.Builder(this).setTitle("Download your records?").setMessage("Save this workspace's records privately on this phone.").setPositiveButton("Download",(dialog,which)->{
        try{
          DownloadManager.Request req=new DownloadManager.Request(uri);
          String cookie=CookieManager.getInstance().getCookie(url);if(cookie!=null)req.addRequestHeader("Cookie",cookie);
          req.setTitle("Munim records");req.setMimeType("application/json");
          req.setDestinationInExternalFilesDir(this,Environment.DIRECTORY_DOWNLOADS,"munim-records-"+System.currentTimeMillis()+".json");
          req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
          ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
          Toast.makeText(this,"Download started",Toast.LENGTH_SHORT).show();
        }catch(Exception error){Toast.makeText(this,"Download failed. Try again.",Toast.LENGTH_LONG).show();}
      }).setNegativeButton("Cancel",null).show();
    });
    load();
  }
  private void load(){offline.setVisibility(View.GONE);web.loadUrl(endpoint.toString()+"/");}
  private void finishMic(boolean allow){if(pendingMic!=null){if(allow && inForeground)pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else pendingMic.deny();pendingMic=null;}}
  @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==MIC){requestingMic=false;boolean granted=results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED;if(granted && !inForeground)grantOnResume=true;else finishMic(granted);}}
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==FILE && pendingFile!=null){pendingFile.onReceiveValue(result==RESULT_OK && data!=null && data.getData()!=null ? new Uri[]{data.getData()} : null);pendingFile=null;}}
  @Override protected void onResume(){super.onResume();inForeground=true;if(grantOnResume){grantOnResume=false;finishMic(true);}if(web!=null)web.onResume();}
  @Override protected void onPause(){inForeground=false;if(!requestingMic)finishMic(false);if(web!=null){web.evaluateJavascript("window.dispatchEvent(new Event('munim:native-pause'))",null);web.onPause();}CookieManager.getInstance().flush();super.onPause();}
  @Override public void onBackPressed(){if(web!=null && web.canGoBack())web.goBack();else super.onBackPressed();}
  @Override protected void onDestroy(){finishMic(false);if(pendingFile!=null)pendingFile.onReceiveValue(null);if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
