import 'package:flutter/material.dart';

import '../services/equipe_api.dart';
import '../services/notificacoes_api.dart';
import '../services/notificacoes_controller.dart';
import '../theme/app_tokens.dart';

/// Bottom sheet de notificações — paridade com `HeaderNotificacoes` da web.
class NotificacoesPanel extends StatefulWidget {
  const NotificacoesPanel({super.key});

  static Future<void> abrir(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const NotificacoesPanel(),
    );
  }

  @override
  State<NotificacoesPanel> createState() => _NotificacoesPanelState();
}

class _NotificacoesPanelState extends State<NotificacoesPanel> {
  final _ctrl = NotificacoesController.instance;
  int? _busyConviteId;

  @override
  void initState() {
    super.initState();
    _ctrl.addListener(_onCtrl);
    if (_ctrl.itens.isEmpty && _ctrl.convites.isEmpty) {
      _ctrl.recarregar();
    }
  }

  @override
  void dispose() {
    _ctrl.removeListener(_onCtrl);
    super.dispose();
  }

  void _onCtrl() {
    if (mounted) setState(() {});
  }

  Color _corIcone(AppTokens t, NotificacaoItem n) {
    switch (n.tagTone) {
      case 'danger':
        return t.danger;
      case 'ok':
        return t.primary;
      default:
        return t.textMuted;
    }
  }

  IconData _icone(String kind) {
    switch (kind) {
      case 'user':
        return Icons.person_outline;
      case 'chat':
        return Icons.chat_bubble_outline;
      case 'sync':
        return Icons.sync;
      case 'wrench':
        return Icons.build_outlined;
      default:
        return Icons.notifications_active_outlined;
    }
  }

  Future<void> _aceitarConvite(ConviteEquipe c) async {
    setState(() => _busyConviteId = c.id);
    await _ctrl.aceitarConvite(c.id);
    if (mounted) setState(() => _busyConviteId = null);
  }

  Future<void> _recusarConvite(ConviteEquipe c) async {
    setState(() => _busyConviteId = c.id);
    await _ctrl.recusarConvite(c.id);
    if (mounted) setState(() => _busyConviteId = null);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final convites = _ctrl.convites;
    final itens = _ctrl.itens;
    final naoLidas = _ctrl.naoLidas;

    return Container(
      height: MediaQuery.of(context).size.height * 0.72,
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: t.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                Text(
                  'Notificações',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: t.text,
                  ),
                ),
                const SizedBox(width: 8),
                if (naoLidas > 0)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: t.danger,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      naoLidas > 9 ? '9+' : '$naoLidas',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                const Spacer(),
                if (itens.isNotEmpty)
                  TextButton(
                    onPressed: () => _ctrl.marcarTodasLidas(),
                    child: Text(
                      'Marcar como lidas',
                      style: TextStyle(
                        fontSize: 12,
                        color: t.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Divider(height: 1, color: t.border),
          if (_ctrl.erro != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(_ctrl.erro!,
                  style: TextStyle(color: t.danger, fontSize: 12)),
            ),
          Expanded(
            child: _ctrl.carregando && convites.isEmpty && itens.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : convites.isEmpty && itens.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.notifications_none,
                                size: 48, color: t.textMuted),
                            const SizedBox(height: 10),
                            Text('Nenhuma notificação',
                                style:
                                    TextStyle(color: t.textMuted, fontSize: 14)),
                          ],
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.only(bottom: 16),
                        children: [
                          if (convites.isNotEmpty) ...[
                            Padding(
                              padding:
                                  const EdgeInsets.fromLTRB(20, 14, 20, 6),
                              child: Text(
                                'Convites para entrar em fazenda',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: t.text,
                                ),
                              ),
                            ),
                            ...convites.map((c) {
                              final busy = _busyConviteId == c.id;
                              return Container(
                                margin: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 4),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: t.surfaceMuted,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: t.border),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Convite como ${c.papelLabel}',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w600,
                                        color: t.text,
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: busy
                                                ? null
                                                : () => _recusarConvite(c),
                                            child: const Text('Recusar'),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: FilledButton(
                                            onPressed: busy
                                                ? null
                                                : () => _aceitarConvite(c),
                                            child:
                                                Text(busy ? '…' : 'Aceitar'),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            }),
                            Divider(height: 24, color: t.border),
                          ],
                          ...itens.map((n) {
                            final lida = _ctrl.isLida(n.id);
                            final cor = _corIcone(t, n);
                            return Dismissible(
                              key: Key('notif-${n.id}'),
                              direction: DismissDirection.endToStart,
                              background: Container(
                                color: t.danger,
                                alignment: Alignment.centerRight,
                                padding: const EdgeInsets.only(right: 20),
                                child: const Icon(Icons.delete_outline,
                                    color: Colors.white),
                              ),
                              onDismissed: (_) => _ctrl.marcarLida(n.id),
                              child: InkWell(
                                onTap: () => _ctrl.marcarLida(n.id),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 20, vertical: 14),
                                  color: lida ? t.surface : t.surfaceMuted,
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 40,
                                        height: 40,
                                        decoration: BoxDecoration(
                                          color: cor.withValues(alpha: 0.14),
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(_icone(n.icon),
                                            color: cor, size: 20),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                      horizontal: 6,
                                                      vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: cor.withValues(
                                                        alpha: 0.12),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            4),
                                                  ),
                                                  child: Text(
                                                    n.tag,
                                                    style: TextStyle(
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      color: cor,
                                                    ),
                                                  ),
                                                ),
                                                const Spacer(),
                                                if (!lida)
                                                  Container(
                                                    width: 8,
                                                    height: 8,
                                                    decoration: BoxDecoration(
                                                      color: cor,
                                                      shape: BoxShape.circle,
                                                    ),
                                                  ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              n.textoExibicao,
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: lida
                                                    ? FontWeight.w500
                                                    : FontWeight.bold,
                                                color: t.text,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              tempoRelativoNotificacao(
                                                  n.criadoEm),
                                              style: TextStyle(
                                                fontSize: 10,
                                                color: t.textMuted,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}

/// Diálogo de convite ao entrar no app (paridade com `ConviteLoginPrompt` web).
class ConviteLoginDialog {
  ConviteLoginDialog._();

  static Future<void> mostrarSePendente(BuildContext context) async {
    final ctrl = NotificacoesController.instance;
    await ctrl.recarregar(silencioso: true);
    if (!context.mounted || ctrl.convites.isEmpty) return;

    final c = ctrl.convites.first;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final t = AppTokens.of(ctx);
        var busy = false;
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return AlertDialog(
              title: const Text('Convite para fazenda'),
              content: Text(
                'Você foi convidado para integrar a equipe como ${c.papelLabel}. Deseja aceitar?',
              ),
              actions: [
                TextButton(
                  onPressed: busy
                      ? null
                      : () async {
                          setLocal(() => busy = true);
                          await ctrl.recusarConvite(c.id);
                          if (ctx.mounted) Navigator.pop(ctx);
                        },
                  child: const Text('Recusar'),
                ),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () async {
                          setLocal(() => busy = true);
                          await ctrl.aceitarConvite(c.id);
                          if (ctx.mounted) Navigator.pop(ctx);
                        },
                  child: Text(busy ? '…' : 'Aceitar'),
                ),
              ],
              backgroundColor: t.surface,
            );
          },
        );
      },
    );
  }
}
