import 'dart:async';

import 'package:flutter/material.dart';
import 'app_theme.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/mapa_screen.dart';
import 'screens/mensagens_screen.dart';
import 'screens/ocorrencias_screen.dart';
import 'screens/perfil_screen.dart';
import 'services/theme_controller.dart';
import 'services/ocorrencias_repository.dart';
import 'services/connectivity_status.dart';
import 'services/notificacoes_controller.dart';
import 'theme/app_tokens.dart';
import 'widgets/notificacoes_panel.dart';
import 'widgets/offline_status_banner.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ThemeController.instance.load();
  await initOfflineSync();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ThemeController.instance,
      builder: (context, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'Agrolink',
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: ThemeController.instance.mode,
          // Login é a tela inicial.
          // Após autenticar, faz Navigator.pushReplacement → TelaPrincipal
          home: const TelaLogin(),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// CASCA PRINCIPAL (com BottomNavigationBar)
// Acessada somente após login ou cadastro bem-sucedido
// ─────────────────────────────────────────────────────────────
class TelaPrincipal extends StatefulWidget {
  const TelaPrincipal({super.key});

  static const int abaHome = 0;
  static const int abaMapa = 1;
  static const int abaMensagens = 2;
  static const int abaOcorrencias = 3;
  static const int abaPerfil = 4;

  /// Acesso ao estado da shell (troca de abas sem perder o menu inferior).
  // ignore: library_private_types_in_public_api
  static _TelaPrincipalState? estadoDe(BuildContext context) {
    return context.findAncestorStateOfType<_TelaPrincipalState>();
  }

  @override
  State<TelaPrincipal> createState() => _TelaPrincipalState();
}

class _TelaPrincipalState extends State<TelaPrincipal> {
  // Índice da aba atual (0 = Home)
  int _abaSelecionada = 0;
  final ConnectivityStatus _connectivity = ConnectivityStatus();

  @override
  void initState() {
    super.initState();
    _connectivity.addListener(_onConnectivityChanged);
    unawaited(_connectivity.start());
    unawaited(NotificacoesController.instance.iniciar());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        unawaited(ConviteLoginDialog.mostrarSePendente(context));
      }
    });
  }

  @override
  void dispose() {
    _connectivity.removeListener(_onConnectivityChanged);
    _connectivity.dispose();
    NotificacoesController.instance.parar();
    super.dispose();
  }

  void _onConnectivityChanged() {
    if (mounted) setState(() {});
  }

  void selecionarAba(int indice) {
    if (indice < 0 || indice >= _telas.length) return;
    setState(() => _abaSelecionada = indice);
  }

  // 5 telas — índice sincronizado com os items do BottomNavigationBar
  // Home(0) | Mapa(1) | Mensagens(2) | Ocorrências(3) | Perfil(4)
  final List<Widget> _telas = const [
    TelaHome(),
    TelaMapa(),
    TelaMensagens(),
    TelaOcorrencias(),
    TelaPerfil(),
  ];

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Scaffold(
      body: Column(
        children: [
          Expanded(child: _telas[_abaSelecionada]),
          OfflineStatusBanner(status: _connectivity),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: t.border)),
        ),
        child: BottomNavigationBar(
          currentIndex: _abaSelecionada,
          onTap: (int novoIndice) {
            setState(() => _abaSelecionada = novoIndice);
          },
          backgroundColor: t.surface,
          selectedItemColor: t.primary,
          unselectedItemColor: t.textMuted,
          type: BottomNavigationBarType.fixed,
          showUnselectedLabels: true,
          selectedLabelStyle: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
          unselectedLabelStyle: const TextStyle(fontSize: 11),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard_rounded),
              label: 'Início',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.map_outlined),
              activeIcon: Icon(Icons.map_rounded),
              label: 'Mapa',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.chat_bubble_outline_rounded),
              activeIcon: Icon(Icons.chat_bubble_rounded),
              label: 'Mensagens',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.warning_amber_rounded),
              activeIcon: Icon(Icons.warning_rounded),
              label: 'Ocorrências',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded),
              label: 'Perfil',
            ),
          ],
        ),
      ),
    );
  }
}