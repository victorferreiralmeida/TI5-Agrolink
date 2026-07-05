import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Logo do projeto (mesmo SVG da web em `public/favicon.svg`).
class AgrolinkLogo extends StatelessWidget {
  const AgrolinkLogo({super.key, this.size = 80});

  final double size;

  static const String assetPath = 'assets/images/logo.svg';

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.22),
      child: SvgPicture.asset(
        assetPath,
        width: size,
        height: size,
        fit: BoxFit.contain,
      ),
    );
  }
}
