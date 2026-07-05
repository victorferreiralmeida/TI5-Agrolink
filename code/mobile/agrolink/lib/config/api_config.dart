import 'dart:io' show Platform;

/// URL do Spring Boot consumido pelo app mobile.
///
/// Em emulador Android `localhost` aponta para o próprio emulador, então o
/// padrão é `http://10.0.2.2:8080` (alias do host). Para iOS, Web ou
/// dispositivo físico, sobrescreva via `--dart-define`:
///
///   flutter run --dart-define=API_BASE_URL=http://192.168.0.10:8080
///   flutter run --dart-define=API_BASE_URL=http://localhost:8080
///
/// O backend roda na porta 8080 quando `npm run dev` (perfil dev) é usado.
const String _kEnvApiBaseUrl = String.fromEnvironment('API_BASE_URL');

String _defaultApiBaseUrl() {
  if (_kEnvApiBaseUrl.isNotEmpty) return _kEnvApiBaseUrl;
  try {
    if (Platform.isAndroid) return 'http://10.0.2.2:8080';
  } catch (_) {
    // Plataforma sem dart:io (ex.: web) — cai no fallback.
  }
  return 'http://localhost:8080';
}

final String kApiBaseUrl = _defaultApiBaseUrl();

/// Converte `/uploads/...` em URL absoluta para o app mobile.
String resolveApiUrl(String path) {
  if (path.isEmpty) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final base = kApiBaseUrl.endsWith('/')
      ? kApiBaseUrl.substring(0, kApiBaseUrl.length - 1)
      : kApiBaseUrl;
  return path.startsWith('/') ? '$base$path' : '$base/$path';
}
