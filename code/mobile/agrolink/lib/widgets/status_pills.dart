import 'package:flutter/material.dart';
import '../models/ocorrencia_model.dart';
import '../theme/app_tokens.dart';

/// Pills coloridos para status/prioridade/categoria — paridade com
/// `occ-card__status`/`occ-card__prio` da web.
class StatusPill extends StatelessWidget {
  final StatusOcorrencia status;
  const StatusPill({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final ok = status == StatusOcorrencia.resolvida;
    final bg = ok ? t.successSoft : t.dangerSoft;
    final fg = ok ? t.success : t.danger;
    return _Pill(
      label: ok ? 'Resolvida' : 'Aberta',
      bg: bg,
      fg: fg,
      borderColor: fg.withValues(alpha: 0.18),
    );
  }
}

class PrioridadePill extends StatelessWidget {
  final String prioridade;
  const PrioridadePill({super.key, required this.prioridade});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    Color bg;
    Color fg;
    switch (prioridade.toUpperCase()) {
      case 'URGENTE':
        bg = t.dangerSoft;
        fg = t.danger;
        break;
      case 'ALTA':
        bg = t.warningSoft;
        fg = t.warning;
        break;
      case 'MEDIA':
        bg = t.infoSoft;
        fg = t.info;
        break;
      case 'BAIXA':
      default:
        bg = t.surfaceMuted;
        fg = t.textMuted;
    }
    return _Pill(
      label: labelPrioridade(prioridade).toUpperCase(),
      bg: bg,
      fg: fg,
      borderColor: fg.withValues(alpha: 0.18),
    );
  }
}

class CategoriaPill extends StatelessWidget {
  final String categoria;
  const CategoriaPill({super.key, required this.categoria});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return _Pill(
      label: labelCategoria(categoria),
      bg: t.surfaceMuted,
      fg: t.textMuted,
      borderColor: t.border,
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;
  final Color borderColor;

  const _Pill({
    required this.label,
    required this.bg,
    required this.fg,
    required this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: borderColor, width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: fg,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
