import 'package:flutter/material.dart';
import '../services/auth_storage.dart';
import '../services/theme_controller.dart';
import '../theme/app_tokens.dart';
import 'agrolink_logo.dart';
import 'notificacoes_panel.dart';
import '../services/notificacoes_controller.dart';
import 'user_avatar.dart';

/// Cabeçalho consistente em todas as telas autenticadas — paridade visual
/// com `AppHeader`/`AppShell` da web.
///
/// Estrutura:
/// `[ logo  título · subtítulo ]   [ ☀/☾ ] [ 🔔 ] [ avatar ]`
///
/// Em telas como o detalhe da ocorrência, `onBack` substitui a logo por um
/// botão "voltar" — mantém o mesmo footprint horizontal.
class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final VoidCallback? onAvatarTap;
  final UsuarioLogado? usuario;
  final bool showThemeToggle;
  final bool showNotificacoes;
  final bool showAvatar;
  final List<Widget> extraActions;

  const AppHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.onBack,
    this.onAvatarTap,
    this.usuario,
    this.showThemeToggle = true,
    this.showNotificacoes = true,
    this.showAvatar = true,
    this.extraActions = const [],
  });

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);

    return Container(
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(bottom: BorderSide(color: t.border)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
          child: Row(
            children: [
              if (onBack != null)
                IconButton(
                  onPressed: onBack,
                  icon: Icon(Icons.arrow_back_rounded, color: t.text),
                  tooltip: 'Voltar',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                      minWidth: 40, minHeight: 40),
                )
              else
                const Padding(
                  padding: EdgeInsets.only(left: 4, right: 8),
                  child: AgrolinkLogo(size: 30),
                ),
              const SizedBox(width: 4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: t.text,
                        letterSpacing: 0.2,
                      ),
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty)
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: t.textMuted,
                        ),
                      ),
                  ],
                ),
              ),
              ...extraActions,
              if (showThemeToggle) const _ThemeToggle(),
              if (showNotificacoes) _NotificacoesBell(t: t),
              if (showAvatar)
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: GestureDetector(
                    onTap: onAvatarTap,
                    child: UserAvatar(
                      nome: usuario?.nome ?? '?',
                      fotoUrl: usuario?.fotoUrl,
                      size: 34,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ThemeToggle extends StatelessWidget {
  const _ThemeToggle();

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ThemeController.instance,
      builder: (context, _) {
        final isDark = ThemeController.instance.isDark;
        final t = AppTokens.of(context);
        return IconButton(
          tooltip: isDark ? 'Tema claro' : 'Tema escuro',
          onPressed: ThemeController.instance.toggle,
          icon: Icon(
            isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
            color: t.text,
            size: 22,
          ),
        );
      },
    );
  }
}

class _NotificacoesBell extends StatefulWidget {
  final AppTokens t;
  const _NotificacoesBell({required this.t});

  @override
  State<_NotificacoesBell> createState() => _NotificacoesBellState();
}

class _NotificacoesBellState extends State<_NotificacoesBell> {
  final _ctrl = NotificacoesController.instance;

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(_onCtrl);
  }

  @override
  void dispose() {
    _ctrl.removeListener(_onCtrl);
    super.dispose();
  }

  void _onCtrl() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final naoLidas = _ctrl.naoLidas;
    return IconButton(
      tooltip: 'Notificações',
      onPressed: () => NotificacoesPanel.abrir(context),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          Icon(Icons.notifications_outlined, size: 24, color: widget.t.text),
          if (naoLidas > 0)
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: widget.t.danger,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: widget.t.surface, width: 1.5),
                ),
                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                child: Text(
                  naoLidas > 9 ? '9+' : '$naoLidas',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
