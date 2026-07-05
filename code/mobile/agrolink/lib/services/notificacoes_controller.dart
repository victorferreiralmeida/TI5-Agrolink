import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_storage.dart';
import 'equipe_api.dart';
import 'notificacoes_api.dart';

/// Estado global de notificações — paridade com `HeaderNotificacoes` da web.
class NotificacoesController extends ChangeNotifier {
  NotificacoesController._();
  static final NotificacoesController instance = NotificacoesController._();

  static const _pollInterval = Duration(seconds: 40);

  List<NotificacaoItem> _itens = const [];
  List<ConviteEquipe> _convites = const [];
  Set<int> _lidas = {};
  String? _erro;
  bool _carregando = false;
  Timer? _timer;

  List<NotificacaoItem> get itens => _itens;
  List<ConviteEquipe> get convites => _convites;
  String? get erro => _erro;
  bool get carregando => _carregando;

  int get naoLidas {
    final notif = _itens.where((n) => !_lidas.contains(n.id)).length;
    return _convites.length + notif;
  }

  Future<void> iniciar() async {
    await _carregarLidas();
    await recarregar();
    _timer?.cancel();
    _timer = Timer.periodic(_pollInterval, (_) => recarregar(silencioso: true));
  }

  void parar() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> recarregar({bool silencioso = false}) async {
    if (!silencioso) {
      _carregando = true;
      notifyListeners();
    }
    _erro = null;
    try {
      final results = await Future.wait([
        NotificacoesApi.listar(),
        EquipeApi.meusConvites(),
      ]);
      _itens = results[0] as List<NotificacaoItem>;
      _convites = results[1] as List<ConviteEquipe>;
    } catch (_) {
      _erro = 'Não foi possível carregar notificações.';
    } finally {
      _carregando = false;
      notifyListeners();
    }
  }

  Future<void> _carregarLidas() async {
    final usuario = await AuthStorage.lerUsuario();
    if (usuario == null) {
      _lidas = {};
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('agrolink_notif_lidas_${usuario.id}');
    if (raw == null) {
      _lidas = {};
      return;
    }
    try {
      final arr = jsonDecode(raw) as List<dynamic>;
      _lidas = arr.whereType<num>().map((n) => n.toInt()).toSet();
    } catch (_) {
      _lidas = {};
    }
  }

  Future<void> _salvarLidas() async {
    final usuario = await AuthStorage.lerUsuario();
    if (usuario == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'agrolink_notif_lidas_${usuario.id}',
      jsonEncode(_lidas.toList()),
    );
  }

  bool isLida(int id) => _lidas.contains(id);

  Future<void> marcarLida(int id) async {
    _lidas = {..._lidas, id};
    await _salvarLidas();
    notifyListeners();
  }

  Future<void> marcarTodasLidas() async {
    _lidas = {..._lidas, ..._itens.map((n) => n.id)};
    await _salvarLidas();
    notifyListeners();
  }

  Future<bool> aceitarConvite(int id) async {
    final ok = await EquipeApi.aceitarConvite(id);
    if (ok) await recarregar(silencioso: true);
    return ok;
  }

  Future<bool> recusarConvite(int id) async {
    final ok = await EquipeApi.recusarConvite(id);
    if (ok) await recarregar(silencioso: true);
    return ok;
  }
}

String tempoRelativoNotificacao(String iso) {
  final t = DateTime.tryParse(iso);
  if (t == null) return '';
  final diff = DateTime.now().difference(t.toLocal());
  final min = diff.inMinutes.clamp(1, 999999);
  if (min < 60) return 'há $min min';
  final h = (min / 60).round();
  if (h < 24) return 'há $h h';
  final d = (h / 24).round();
  if (d == 1) return 'Ontem';
  return 'há $d dias';
}
