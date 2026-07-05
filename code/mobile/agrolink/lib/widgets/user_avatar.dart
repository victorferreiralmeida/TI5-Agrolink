import 'package:flutter/material.dart';
import '../config/api_config.dart';
import '../theme/app_tokens.dart';

/// Avatar do usuário — paridade com `UserAvatar` da web.
///
/// Usa a foto de `fotoUrl` quando disponível; caso contrário, exibe a inicial
/// do nome num círculo com a cor primária do tema.
class UserAvatar extends StatelessWidget {
  final String nome;
  final String? fotoUrl;
  final double size;

  const UserAvatar({
    super.key,
    required this.nome,
    this.fotoUrl,
    this.size = 36,
  });

  String get _inicial {
    final n = nome.trim();
    if (n.isEmpty) return '?';
    return n.characters.first.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final foto = (fotoUrl ?? '').trim();
    final url = foto.isEmpty ? null : resolveApiUrl(foto);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: t.primarySoft,
        border: Border.all(color: t.border, width: 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: url == null
          ? _initial(t)
          : Image.network(
              url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _initial(t),
            ),
    );
  }

  Widget _initial(AppTokens t) {
    return Center(
      child: Text(
        _inicial,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: t.primary,
          fontSize: size * 0.42,
        ),
      ),
    );
  }
}
