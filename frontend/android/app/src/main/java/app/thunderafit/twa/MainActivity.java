package app.thunderafit.twa;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

/**
 * Fase 19 (spike Capacitor) — AJUSTE #1 aplicado.
 *
 * O commit em disco dos cookies do WebView (Chromium, app_webview/Cookies) é
 * assíncrono/best-effort e o Capacitor NÃO chama flush() em nenhum ponto do
 * ciclo de vida (Bridge.java não tem flush). Sem isto, em OEMs de kill
 * agressivo (MIUI/One UI) ou aparelhos com Android System WebView antigo
 * (possível com minSdk=24), o refresh_token de 7 dias pode nunca chegar ao
 * disco antes de o processo morrer — causando falso logout no cold start,
 * dentro da janela de validade. Forçar flush() em onPause() elimina essa
 * corrida contra o SIGKILL. É a correção mais provável apontada pela análise
 * de viabilidade (ver STATUS.md, Fase 19); segura e idempotente.
 *
 * NÃO resolve a fragilidade paralela do `user` em localStorage (DOM storage
 * do WebView tem flush assíncrono semelhante) — ver AJUSTE #2 recomendado no
 * STATUS.md (sondar a sessão via endpoint no boot em vez de confiar só no
 * localStorage). Esse ajuste muda o fluxo de auth e ficou como recomendação,
 * não aplicado neste spike.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onPause() {
    super.onPause();
    CookieManager.getInstance().flush();
  }
}
