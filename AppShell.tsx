// Приложение для iPhone и Android показывает сам сайт на весь экран (решение Данила 2026-10-28:
// «должно быть точь-в-точь как сайт»). Дизайн совпадает до пикселя, а всё, что меняется на сайте,
// сразу появляется в приложении без переустановки.
// Нативное здесь: экран запуска, жест «назад», звонки и мессенджеры, выбор видео с камеры или из галереи,
// экран «Нет связи» с повтором.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

/** Адрес сайта: задан отдельно или получается из адреса сервера без /api. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || API_URL.replace(/\/api$/, '') || 'https://akademia-app.ru').replace(/\/$/, '') + '/';
const ORIGIN = new URL(SITE_URL).origin;

// Сайт занимает экран между часами и полоской «домой», как сайт на iPhone, добавленный «На экран Домой»:
// всё, что прилипает к низу (панель вкладок, шторки), стоит ровно там же, где на сайте.
// Флаг akademiaApp — сайт знает, что открыт в приложении.
const BEFORE = `(function () {
  window.akademiaApp = true;
  function fit() {
    var m = document.querySelector('meta[name=viewport]');
    if (!m) { m = document.createElement('meta'); m.name = 'viewport'; (document.head || document.documentElement).appendChild(m); }
    m.content = 'width=device-width, initial-scale=1';
  }
  fit();
  var css = document.createElement('style');
  css.textContent = 'html,body{background:#D3DDD9;overscroll-behavior:none}';
  function add() { fit(); if (!css.parentNode) (document.head || document.documentElement).appendChild(css); }
  add();
  document.addEventListener('DOMContentLoaded', add);
})(); true;`;

const BG = '#D3DDD9';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function AppShell() {
  return (
    <SafeAreaProvider style={{ backgroundColor: BG }}>
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  const inset = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const canBack = useRef(false);

  // Android: системная кнопка «назад» листает назад внутри приложения, а не закрывает его.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canBack.current) return false;
      web.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const ready = useCallback(() => {
    setLoaded(true);
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  // Сеть медленная — не держим заставку дольше 8 с.
  useEffect(() => {
    const t = setTimeout(ready, 8000);
    return () => clearTimeout(t);
  }, [ready]);

  // Свои страницы открываем внутри; звонки, WhatsApp, СМС, карты и чужие сайты — в своих приложениях.
  const allow = (req: WebViewNavigation) => {
    const url = req.url;
    if (url.startsWith(ORIGIN) || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
    Linking.openURL(url).catch(() => {});
    return false;
  };

  if (failed) {
    return (
      <View style={st.off}>
        <StatusBar style="dark" />
        <Text style={st.offTitle}>Нет связи с сервером</Text>
        <Text style={st.offText}>Проверьте интернет и попробуйте ещё раз.</Text>
        <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setLoaded(false); }} style={st.btn}>
          <Text style={st.btnText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG, paddingTop: inset.top, paddingBottom: inset.bottom }}>
      <StatusBar style="dark" />
      <WebView
        ref={web}
        testID="site"
        source={{ uri: SITE_URL }}
        style={{ flex: 1, backgroundColor: BG }}
        containerStyle={{ backgroundColor: BG }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={BEFORE}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        overScrollMode="never"
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsLinkPreview={false}
        domStorageEnabled
        javaScriptEnabled
        sharedCookiesEnabled
        cacheEnabled
        allowFileAccess
        setSupportMultipleWindows={false}
        textZoom={100}
        pullToRefreshEnabled={false}
        decelerationRate="normal"
        onShouldStartLoadWithRequest={allow}
        onNavigationStateChange={(s) => { canBack.current = s.canGoBack; }}
        onLoadEnd={ready}
        onError={() => { ready(); setFailed(true); }}
        onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500 && !loaded) { ready(); setFailed(true); } }}
        onContentProcessDidTerminate={() => web.current?.reload()}
        onRenderProcessGone={() => { web.current?.reload(); return true; }}
      />
      {!loaded && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.wait]}>
          <ActivityIndicator color="#1DCEB9" />
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  wait: { alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  off: { flex: 1, backgroundColor: '#FAF7EE', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  offTitle: { fontSize: 20, fontWeight: '700', color: '#111413' },
  offText: { fontSize: 15, color: '#5C6360', textAlign: 'center' },
  btn: { marginTop: 12, backgroundColor: '#1DCEB9', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#111413' },
});
