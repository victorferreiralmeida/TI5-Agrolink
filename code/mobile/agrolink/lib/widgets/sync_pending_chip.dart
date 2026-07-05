import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// Selo visual para ocorrências salvas offline e ainda não sincronizadas.
class SyncPendingChip extends StatelessWidget {
  final bool compact;

  const SyncPendingChip({super.key, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 3 : 4,
      ),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFD54F), Color(0xFFFFB300)],
        ),
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _SpinIcon(size: compact ? 12 : 14),
          SizedBox(width: compact ? 4 : 6),
          Text(
            compact ? 'Sync' : 'Aguardando sync',
            style: TextStyle(
              fontSize: compact ? 10 : 11,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF3D2E00),
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _SpinIcon extends StatefulWidget {
  final double size;
  const _SpinIcon({required this.size});

  @override
  State<_SpinIcon> createState() => _SpinIconState();
}

class _SpinIconState extends State<_SpinIcon> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))
      ..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RotationTransition(
      turns: _ctrl,
      child: Icon(Icons.sync, size: widget.size, color: const Color(0xFF3D2E00)),
    );
  }
}

/// Faixa de aviso no topo da lista quando há ocorrências pendentes offline.
class SyncPendingBanner extends StatelessWidget {
  final int count;
  final VoidCallback? onDismiss;

  const SyncPendingBanner({super.key, required this.count, this.onDismiss});

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();
    final t = AppTokens.of(context);
    return Container(
      margin: const EdgeInsets.fromLTRB(AppSpacing.md, 0, AppSpacing.md, AppSpacing.sm),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFB300).withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0xFFFFB300).withValues(alpha: 0.55)),
      ),
      child: Row(
        children: [
          const SyncPendingChip(compact: true),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '$count ocorrência(s) aguardando sincronização quando a conexão voltar.',
              style: TextStyle(fontSize: 12, color: t.text, height: 1.35),
            ),
          ),
          if (onDismiss != null)
            IconButton(
              visualDensity: VisualDensity.compact,
              icon: Icon(Icons.close, size: 18, color: t.textMuted),
              onPressed: onDismiss,
            ),
        ],
      ),
    );
  }
}
