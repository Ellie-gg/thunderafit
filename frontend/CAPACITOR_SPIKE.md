# Fase 19 — Spike Capacitor + Auth por Cookie (runbook)

**Objetivo do spike:** provar/refutar que a auth por cookie httpOnly (Fase 5.5)
persiste dentro de um WebView Capacitor no Android, antes de investir no app.

## Estado deste spike

- Scaffold Capacitor 8.4.2 criado neste repo (`frontend/`): `capacitor.config.ts`,
  projeto nativo `frontend/android/`, `webDir` fallback `frontend/capacitor-www/`.
- **Mitigação aplicada:** `server.url` aponta para a **origem real de produção**
  (`https://thunderafit-frontend-vy6oiie6rq-uc.a.run.app`), não o `https://localhost`
  padrão — assim o WebView carrega a mesma origem que emite os cookies e tudo é
  same-origin/first-party. `CapacitorHttp` fica **desligado** (fetch no WebView,
  cookies sob o CookieManager nativo do Chromium).
- **Ajuste #1 JÁ APLICADO** (`android/.../MainActivity.java`): `onPause()` chama
  `CookieManager.getInstance().flush()` — força o commit dos cookies em disco antes
  de o processo morrer (o Capacitor não faz isso sozinho).
- **O teste empírico NÃO foi executado** neste host: sem JDK, Android SDK, emulador
  ou `adb` (confirmado em Windows e WSL). O build falha em `JAVA_HOME is not set`.
  Este runbook existe para rodar o teste num host com Android Studio.

## Pré-requisitos (host com Android Studio)

- JDK 17+, Android SDK, Android Studio, um emulador **e** de preferência 1 aparelho
  físico de OEM de kill agressivo (Xiaomi/MIUI ou Samsung/One UI).
- `ANDROID_HOME`/`JAVA_HOME` no ambiente.

## Build + instalar

```bash
cd frontend
npm install
# (o android/ já está no repo; se precisar regenerar: npx cap add android)
npx cap sync android
cd android
./gradlew assembleDebug           # gera app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> Não é preciso `next build`: `server.url` carrega a produção remota; o `webDir`
> local é só fallback. (O `output:'export'` do Next fica gated por
> `CAPACITOR_EXPORT` e é incompatível com o proxy server-side — ver next.config.)

## O teste que importa — FAÇA O COLD START, não "Home"

⚠️ **Fechar pelo botão Home e reabrir é FALSO POSITIVO**: o processo continua vivo
e os cookies vêm da memória — não exercita o disco. Use `am force-stop`.

1. Abrir o app → login → navegar até uma tela protegida (dashboard). Confirmar dados.
2. (Opcional, evita falso negativo por timing) confirmar que o cookie já foi ao disco:
   ```bash
   adb shell run-as app.thunderafit.twa sqlite3 app_webview/Cookies "SELECT name FROM cookies;"
   # deve listar refresh_token
   ```
3. **Cold start real:**
   ```bash
   adb shell am force-stop app.thunderafit.twa
   adb shell monkey -p app.thunderafit.twa -c android.intent.category.LAUNCHER 1
   ```
   - **PASSA:** entra direto na tela protegida (sessão persistiu).
   - **FALHA:** cai no `/login`.
4. **Pior caso (kill agressivo imediato):** logar, navegar e IMEDIATAMENTE dar swipe
   nos recentes num MIUI/One UI real. Reabrir.
5. **Expiração do access (>15min):** logar, force-stop, esperar >15min, reabrir.
   Esperado: 1º fetch 401 → `POST /api/auth/refresh` (refresh de 7d) → segue logado.

Em cada falha: `adb logcat | grep -i chromium` no reopen e reinspecionar
`app_webview/Cookies` (o cookie sumiu = perda de cookie; cookie presente mas foi pro
`/login` = perda do `user` no localStorage / gate frágil → aplicar ajuste #2).

## Se falhar — ordem de correção (mais provável primeiro)

1. **Ajuste #1 (já aplicado):** `flush()` no lifecycle. Se o build antigo não o tinha,
   rebuild e teste de novo.
2. **Ajuste #2 (recomendado, NÃO aplicado — muda o fluxo de auth):** no boot, o
   `AuthGuard` deve sondar a sessão real (ex: `GET /api/auth/me` / reaproveitar
   `/api/auth/protected`) em vez de confiar só na presença de `user` no localStorage.
   Hoje a persistência depende de DOIS artefatos sobreviverem (cookie **e**
   localStorage); o DOM storage do WebView tem a mesma fragilidade de flush.
3. **Só por último** cogitar `SameSite=None; Secure` — improvável ser o culpado (o
   tráfego é same-origin, onde `Lax` já envia o cookie) e amplia CSRF. Não é a
   primeira tentativa apesar de ser o palpite comum.

## Invariante a proteger

Cookie é **host-only** (sem `Domain`): trocar o hostname de produção (domínio
custom, nova URL de revisão do Cloud Run) descarta silenciosamente o refresh_token
gravado sob o host antigo → re-login único. Se mudar o host, avise/aceite isso.
