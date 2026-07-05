import 'package:flutter/material.dart';

import '../models/ocorrencia_model.dart';
import '../theme/app_tokens.dart';

/// Renderiza a imagem-capa de uma ocorrência. Quando há upload real
/// (`ocorrencia.imageUrl` não vazio), exibe via [Image.network]; caso contrário
/// (ou em caso de erro de carregamento) mostra um placeholder com gradiente
/// específico da categoria — paridade visual com a web sem depender de
/// arquivos `/images/*` no backend.
class ImagemOcorrencia extends StatelessWidget {
  final Ocorrencia ocorrencia;
  final BoxFit fit;

  const ImagemOcorrencia({
    super.key,
    required this.ocorrencia,
    this.fit = BoxFit.cover,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final url = ocorrencia.imageUrl;
    if (url.isEmpty) {
      return _PlaceholderCategoria(categoria: ocorrencia.categoria, t: t);
    }
    return Image.network(
      url,
      fit: fit,
      gaplessPlayback: true,
      errorBuilder: (_, __, ___) =>
          _PlaceholderCategoria(categoria: ocorrencia.categoria, t: t),
      loadingBuilder: (ctx, child, prog) {
        if (prog == null) return child;
        return Stack(
          fit: StackFit.expand,
          children: [
            _PlaceholderCategoria(categoria: ocorrencia.categoria, t: t),
            const Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.2),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _PlaceholderCategoria extends StatelessWidget {
  final String categoria;
  final AppTokens t;
  const _PlaceholderCategoria({required this.categoria, required this.t});

  @override
  Widget build(BuildContext context) {
    final estilo = _estiloCategoria(categoria, t);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [estilo.cor1, estilo.cor2],
        ),
      ),
      child: Center(
        child: Icon(
          estilo.icone,
          size: 56,
          color: Colors.white.withValues(alpha: 0.85),
        ),
      ),
    );
  }
}

class _EstiloCategoria {
  final IconData icone;
  final Color cor1;
  final Color cor2;
  const _EstiloCategoria(this.icone, this.cor1, this.cor2);
}

_EstiloCategoria _estiloCategoria(String categoria, AppTokens t) {
  switch (categoria.trim().toUpperCase()) {
    case 'INCENDIO':
      return const _EstiloCategoria(
        Icons.local_fire_department_rounded,
        Color(0xFFB42318),
        Color(0xFFEF6C00),
      );
    case 'PRAGA':
      return const _EstiloCategoria(
        Icons.bug_report_rounded,
        Color(0xFF6A1B9A),
        Color(0xFF8E24AA),
      );
    case 'CERCA':
      return const _EstiloCategoria(
        Icons.fence_rounded,
        Color(0xFF455A64),
        Color(0xFF607D8B),
      );
    case 'MANUTENCAO':
      return const _EstiloCategoria(
        Icons.build_rounded,
        Color(0xFF1565C0),
        Color(0xFF1E88E5),
      );
    case 'INFRAESTRUTURA':
      return const _EstiloCategoria(
        Icons.foundation_rounded,
        Color(0xFF4E342E),
        Color(0xFF6D4C41),
      );
    case 'SOLO':
      return const _EstiloCategoria(
        Icons.terrain_rounded,
        Color(0xFF6D4C41),
        Color(0xFF8D6E63),
      );
    default:
      return _EstiloCategoria(
        Icons.report_problem_rounded,
        t.primary,
        t.primary.withValues(alpha: 0.7),
      );
  }
}
