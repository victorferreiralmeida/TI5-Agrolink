import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

typedef LatLngPair = List<double>; // [lat, lng]

const _coresSetor = ['#c26b00', '#1f6b3a', '#114f9f', '#7b3fa3', '#b02222'];

List<LatLng> parsePolygonLatLng(String? raw) {
  if (raw == null || raw.trim().isEmpty) return [];
  try {
    final j = jsonDecode(raw) as Map<String, dynamic>;
    if (j['type'] != 'Polygon') return [];
    final coords = j['coordinates'];
    if (coords is! List || coords.isEmpty) return [];
    final ring = coords[0];
    if (ring is! List) return [];
    final out = <LatLng>[];
    for (final item in ring) {
      if (item is! List || item.length < 2) continue;
      final lng = (item[0] as num).toDouble();
      final lat = (item[1] as num).toDouble();
      if (lat.isFinite && lng.isFinite) out.add(LatLng(lat, lng));
    }
    if (out.length >= 2 && out.first == out.last) out.removeLast();
    return out;
  } catch (_) {
    return [];
  }
}

/// Todos os vértices dos anéis (para `CameraFit.coordinates`).
List<LatLng> allPointsFromPolygons(List<List<LatLng>> rings) {
  final out = <LatLng>[];
  for (final ring in rings) {
    out.addAll(ring);
  }
  return out;
}

String corSetorMapa(int id) => _coresSetor[id.abs() % _coresSetor.length];

Color corSetorMapaFlutter(int id) => parseHexColor(corSetorMapa(id));

Color parseHexColor(String hex) {
  final h = hex.replaceFirst('#', '');
  if (h.length == 6) {
    return Color(int.parse('FF$h', radix: 16));
  }
  return const Color(0xFF757575);
}

/// Estilo do perímetro da fazenda (paridade com `MapPage.tsx` / dashboard web).
({Color fill, Color border, double borderWidth}) estiloPerimetroFazenda({
  required bool satelite,
}) {
  if (satelite) {
    return (
      fill: const Color(0xFFFFFDE7).withValues(alpha: 0.38),
      border: const Color(0xFFFFCC00),
      borderWidth: 3.5,
    );
  }
  final verde = parseHexColor('#1f6b3a');
  return (
    fill: verde.withValues(alpha: 0.12),
    border: verde,
    borderWidth: 2,
  );
}

/// Preenchimento interno do polígono de setor.
/// Quando [destacado], aumenta o fill e usa borda amarela em destaque
/// (igual ao realce de seleção do mapa web).
({Color fill, Color border, double borderWidth}) estiloPoligonoSetor(
  Color cor, {
  bool destacado = false,
}) {
  if (destacado) {
    return (
      fill: cor.withValues(alpha: 0.55),
      border: const Color(0xFFFFCC00),
      borderWidth: 5,
    );
  }
  return (
    fill: cor.withValues(alpha: 0.22),
    border: cor,
    borderWidth: 2,
  );
}

bool pointInPolygon(double lat, double lng, List<LatLng> poly) {
  if (poly.length < 3) return false;
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    final yi = poly[i].latitude;
    final xi = poly[i].longitude;
    final yj = poly[j].latitude;
    final xj = poly[j].longitude;
    final denom = yj - yi;
    final intersect = yi > lat != yj > lat &&
        lng < ((xj - xi) * (lat - yi) / (denom.abs() < 1e-18 ? 1e-18 : denom)) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

double areaPoligonoAprox(List<LatLng> poly) {
  if (poly.length < 3) return double.infinity;
  var s = 0.0;
  for (var i = 0; i < poly.length; i++) {
    final p1 = poly[i];
    final p2 = poly[(i + 1) % poly.length];
    s += p1.longitude * p2.latitude - p2.longitude * p1.latitude;
  }
  return s.abs() / 2;
}
