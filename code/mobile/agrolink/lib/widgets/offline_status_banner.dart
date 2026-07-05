import 'package:flutter/material.dart';

import '../services/connectivity_status.dart';

/// Faixa fixa de status offline/sync (paridade com OfflineBanner.tsx no web).
class OfflineStatusBanner extends StatelessWidget {
  final ConnectivityStatus status;

  const OfflineStatusBanner({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    if (!status.isBannerVisible) return const SizedBox.shrink();

    final style = status.bannerStyle();

    return Material(
      color: style.color,
      elevation: 4,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Text(
            style.text,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              height: 1.35,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
