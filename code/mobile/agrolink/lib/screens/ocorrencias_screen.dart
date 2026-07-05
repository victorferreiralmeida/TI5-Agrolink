import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';

import '../config/api_config.dart';
import '../main.dart' show TelaPrincipal;
import '../models/ocorrencia_model.dart';
import '../services/api_service.dart';
import '../services/auth_storage.dart';
import '../services/equipe_api.dart';
import '../services/ocorrencias_repository.dart';
import '../services/offline_db.dart';
import '../services/sync_events.dart';
import '../services/ocorrencias_api.dart';
import '../theme/app_tokens.dart';
import '../widgets/app_header.dart';
import '../widgets/imagem_ocorrencia.dart';
import '../widgets/status_pills.dart';
import '../widgets/sync_pending_chip.dart';
import 'registrar_ocorrencia_screen.dart';

// ═══════════════════════════════════════════════════════════════
// FILTROS — paridade com OcorrenciasPage.tsx
// ═══════════════════════════════════════════════════════════════

enum _StatusFiltro { todos, aberta, resolvida }

extension _StatusFiltroLabel on _StatusFiltro {
  String get label {
    switch (this) {
      case _StatusFiltro.todos:
        return 'Todos status';
      case _StatusFiltro.aberta:
        return 'Abertas';
      case _StatusFiltro.resolvida:
        return 'Resolvidas';
    }
  }
}

enum _PrioridadeFiltro { todas, baixa, media, alta, urgente }

extension _PrioridadeFiltroLabel on _PrioridadeFiltro {
  String get label {
    switch (this) {
      case _PrioridadeFiltro.todas:
        return 'Todas prioridades';
      case _PrioridadeFiltro.baixa:
        return 'Baixa';
      case _PrioridadeFiltro.media:
        return 'Média';
      case _PrioridadeFiltro.alta:
        return 'Alta';
      case _PrioridadeFiltro.urgente:
        return 'Crítica';
    }
  }

  String get apiValue {
    switch (this) {
      case _PrioridadeFiltro.todas:
        return 'TODAS';
      case _PrioridadeFiltro.baixa:
        return 'BAIXA';
      case _PrioridadeFiltro.media:
        return 'MEDIA';
      case _PrioridadeFiltro.alta:
        return 'ALTA';
      case _PrioridadeFiltro.urgente:
        return 'URGENTE';
    }
  }
}

enum _PeriodoFiltro { semana, mes, trimestre, todo }

extension _PeriodoFiltroLabel on _PeriodoFiltro {
  String get label {
    switch (this) {
      case _PeriodoFiltro.semana:
        return 'Últimos 7 dias';
      case _PeriodoFiltro.mes:
        return 'Últimos 30 dias';
      case _PeriodoFiltro.trimestre:
        return 'Últimos 90 dias';
      case _PeriodoFiltro.todo:
        return 'Todo período';
    }
  }

  int? get dias {
    switch (this) {
      case _PeriodoFiltro.semana:
        return 7;
      case _PeriodoFiltro.mes:
        return 30;
      case _PeriodoFiltro.trimestre:
        return 90;
      case _PeriodoFiltro.todo:
        return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// LISTA DE OCORRÊNCIAS
// ═══════════════════════════════════════════════════════════════

class TelaOcorrencias extends StatefulWidget {
  const TelaOcorrencias({super.key});

  @override
  State<TelaOcorrencias> createState() => _TelaOcorrenciasState();
}

class _TelaOcorrenciasState extends State<TelaOcorrencias> {
  UsuarioLogado? _usuario;
  List<Ocorrencia> _todas = const [];
  bool _loading = true;
  String? _erro;
  int? _busyId;

  final _searchCtrl = TextEditingController();
  String _busca = '';
  _StatusFiltro _statusFiltro = _StatusFiltro.todos;
  _PrioridadeFiltro _prioridadeFiltro = _PrioridadeFiltro.todas;
  _PeriodoFiltro _periodoFiltro = _PeriodoFiltro.todo;
  String _setorFiltro = 'TODAS';

  void _onSyncEvent(SyncEvent event) {
    if (!mounted) return;
    if (event.type == SyncEventType.complete) {
      _carregar();
    }
  }

  @override
  void initState() {
    super.initState();
    subscribeSyncEvents(_onSyncEvent);
    _carregarUsuario();
    _carregar();
  }

  @override
  void dispose() {
    unsubscribeSyncEvents(_onSyncEvent);
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _carregarUsuario() async {
    final u = await AuthStorage.lerUsuario();
    if (mounted) setState(() => _usuario = u);
  }

  Future<void> _carregar() async {
    setState(() {
      _loading = true;
      _erro = null;
    });
    try {
      final dados = await OcorrenciasRepository.instance.listar();
      if (!mounted) return;
      setState(() {
        _todas = dados;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _erro = e.mensagem;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      final cached = await readAllOcorrencias();
      if (cached.isNotEmpty) {
        setState(() {
          _todas = cached.map(Ocorrencia.fromJson).toList();
          _loading = false;
          _erro = 'Modo offline — dados salvos localmente.';
        });
        return;
      }
      setState(() {
        _erro = 'Não foi possível carregar as ocorrências.';
        _loading = false;
      });
    }
  }

  Future<void> _abrirNovaOcorrencia() async {
    final criou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const TelaNovaOcorrencia()),
    );
    if (criou == true) _carregar();
  }

  Future<void> _abrirDetalhe(Ocorrencia o) async {
    if (o.pendingSync) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Esta ocorrência será sincronizada quando houver conexão.'),
        ),
      );
      return;
    }
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => TelaDetalheOcorrencia(ocorrencia: o)),
    );
    _carregar();
  }

  Future<void> _resolverRapido(Ocorrencia o) async {
    if (o.pendingSync) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Aguarde a sincronização para resolver esta ocorrência.'),
        ),
      );
      return;
    }
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Confirmar resolução'),
        content: const Text(
            'Tem certeza que deseja marcar esta ocorrência como resolvida?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
    if (confirmado != true) return;

    setState(() => _busyId = o.id);
    try {
      final atual = await OcorrenciasApi.resolver(o.id);
      if (!mounted) return;
      setState(() {
        _todas = _todas.map((x) => x.id == atual.id ? atual : x).toList();
      });
    } on ApiException catch (e) {
      _snack(e.mensagem, erro: true);
    } catch (_) {
      _snack('Não foi possível atualizar a ocorrência.', erro: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  void _snack(String msg, {bool erro = false}) {
    if (!mounted) return;
    final t = AppTokens.of(context);
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: erro ? t.danger : t.primary,
        behavior: SnackBarBehavior.floating,
      ));
  }

  // ── Filtragem ──────────────────────────────────────────────────
  List<String> get _setoresDisponiveis {
    final set = _todas.map((o) => o.setor.trim()).where((s) => s.isNotEmpty).toSet().toList()
      ..sort((a, b) => a.compareTo(b));
    return ['TODAS', ...set];
  }

  List<Ocorrencia> get _filtradas {
    final agora = DateTime.now();
    final dias = _periodoFiltro.dias;
    final termo = normalizarBusca(_busca.trim());

    return _todas.where((o) {
      if (_statusFiltro == _StatusFiltro.aberta &&
          o.status != StatusOcorrencia.aberta) {
        return false;
      }
      if (_statusFiltro == _StatusFiltro.resolvida &&
          o.status != StatusOcorrencia.resolvida) {
        return false;
      }
      if (_prioridadeFiltro != _PrioridadeFiltro.todas &&
          o.prioridade != _prioridadeFiltro.apiValue) {
        return false;
      }
      if (_setorFiltro != 'TODAS' && o.setor.trim() != _setorFiltro) {
        return false;
      }
      if (dias != null) {
        final t = DateTime.tryParse(o.horario)?.toLocal();
        if (t == null) return false;
        if (agora.difference(t).inDays > dias) return false;
      }
      if (termo.isEmpty) return true;
      return normalizarBusca(o.titulo).contains(termo) ||
          o.id.toString().contains(termo) ||
          normalizarBusca(o.setor).contains(termo) ||
          normalizarBusca(labelCategoria(o.categoria)).contains(termo) ||
          normalizarBusca(o.descricao ?? '').contains(termo);
    }).toList()
      ..sort(_compararCriticidade);
  }

  int _peso(Ocorrencia o) {
    if (o.status == StatusOcorrencia.resolvida) return 4;
    switch (o.prioridade) {
      case 'URGENTE':
        return 0;
      case 'ALTA':
        return 1;
      case 'MEDIA':
        return 2;
      default:
        return 3;
    }
  }

  int _compararCriticidade(Ocorrencia a, Ocorrencia b) {
    final pa = _peso(a);
    final pb = _peso(b);
    if (pa != pb) return pa.compareTo(pb);
    final ta = DateTime.tryParse(a.horario)?.millisecondsSinceEpoch ?? 0;
    final tb = DateTime.tryParse(b.horario)?.millisecondsSinceEpoch ?? 0;
    return tb.compareTo(ta);
  }

  bool get _temFiltroAtivo =>
      _statusFiltro != _StatusFiltro.todos ||
      _prioridadeFiltro != _PrioridadeFiltro.todas ||
      _periodoFiltro != _PeriodoFiltro.todo ||
      _setorFiltro != 'TODAS' ||
      _busca.trim().isNotEmpty;

  int get _pendingSyncCount => _todas.where((o) => o.pendingSync).length;

  bool _bannerSyncVisivel = true;

  void _limparFiltros() {
    setState(() {
      _statusFiltro = _StatusFiltro.todos;
      _prioridadeFiltro = _PrioridadeFiltro.todas;
      _periodoFiltro = _PeriodoFiltro.todo;
      _setorFiltro = 'TODAS';
      _busca = '';
      _searchCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final filtradas = _filtradas;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppHeader(
        title: 'Ocorrências',
        subtitle: _temFiltroAtivo
            ? '${filtradas.length} no filtro · ${_todas.length} no total'
            : '${_todas.length} no total',
        usuario: _usuario,
        onAvatarTap: () =>
            TelaPrincipal.estadoDe(context)?.selecionarAba(TelaPrincipal.abaPerfil),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _abrirNovaOcorrencia,
        backgroundColor: t.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Registrar'),
      ),
      body: Column(
        children: [
          _buildFiltros(t),
          if (_bannerSyncVisivel && _pendingSyncCount > 0)
            SyncPendingBanner(
              count: _pendingSyncCount,
              onDismiss: () => setState(() => _bannerSyncVisivel = false),
            ),
          Expanded(
            child: _loading
                ? Center(
                    child: CircularProgressIndicator(
                      color: t.primary,
                      strokeWidth: 2.5,
                    ),
                  )
                : _erro != null
                    ? _buildErro(t)
                    : RefreshIndicator(
                        onRefresh: _carregar,
                        color: t.primary,
                        child: filtradas.isEmpty
                            ? ListView(
                                children: [_buildEmpty(t)],
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                    AppSpacing.lg,
                                    AppSpacing.md,
                                    AppSpacing.lg,
                                    96),
                                itemCount: filtradas.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: AppSpacing.md),
                                itemBuilder: (_, idx) {
                                  final o = filtradas[idx];
                                  return _CardOcorrencia(
                                    ocorrencia: o,
                                    busy: _busyId == o.id,
                                    onTap: () => _abrirDetalhe(o),
                                    onResolver: () => _resolverRapido(o),
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFiltros(AppTokens t) {
    return Container(
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(bottom: BorderSide(color: t.border)),
      ),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.md),
      child: Column(
        children: [
          TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _busca = v),
            decoration: InputDecoration(
              hintText: 'Pesquisar título, ID, descrição…',
              prefixIcon: const Icon(Icons.search_rounded, size: 20),
              isDense: true,
              suffixIcon: _busca.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() => _busca = '');
                      },
                    ),
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _DropdownFiltro<_StatusFiltro>(
                  value: _statusFiltro,
                  options: _StatusFiltro.values,
                  labelOf: (v) => v.label,
                  onChanged: (v) =>
                      setState(() => _statusFiltro = v ?? _StatusFiltro.todos),
                ),
                const SizedBox(width: 8),
                _DropdownFiltro<_PrioridadeFiltro>(
                  value: _prioridadeFiltro,
                  options: _PrioridadeFiltro.values,
                  labelOf: (v) => v.label,
                  onChanged: (v) => setState(
                      () => _prioridadeFiltro = v ?? _PrioridadeFiltro.todas),
                ),
                const SizedBox(width: 8),
                _DropdownFiltro<String>(
                  value: _setorFiltro,
                  options: _setoresDisponiveis,
                  labelOf: (v) => v == 'TODAS' ? 'Todas as áreas' : v,
                  onChanged: (v) => setState(() => _setorFiltro = v ?? 'TODAS'),
                ),
                const SizedBox(width: 8),
                _DropdownFiltro<_PeriodoFiltro>(
                  value: _periodoFiltro,
                  options: _PeriodoFiltro.values,
                  labelOf: (v) => v.label,
                  onChanged: (v) => setState(
                      () => _periodoFiltro = v ?? _PeriodoFiltro.todo),
                ),
                if (_temFiltroAtivo) ...[
                  const SizedBox(width: 8),
                  TextButton.icon(
                    onPressed: _limparFiltros,
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('Limpar'),
                    style: TextButton.styleFrom(
                      foregroundColor: t.primary,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 6),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty(AppTokens t) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_rounded, size: 56, color: t.textMuted),
            const SizedBox(height: AppSpacing.md),
            Text(
              _temFiltroAtivo
                  ? 'Nenhuma ocorrência para os filtros selecionados.'
                  : 'Nenhuma ocorrência registrada ainda.',
              textAlign: TextAlign.center,
              style: TextStyle(color: t.textMuted, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.lg),
            if (!_temFiltroAtivo)
              ElevatedButton.icon(
                onPressed: _abrirNovaOcorrencia,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Registrar a primeira'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: t.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                ),
              )
            else
              OutlinedButton.icon(
                onPressed: _limparFiltros,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Limpar filtros'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildErro(AppTokens t) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 56, color: t.danger),
            const SizedBox(height: AppSpacing.md),
            Text(
              _erro ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(color: t.textMuted, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton.icon(
              onPressed: _carregar,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Tentar novamente'),
              style: ElevatedButton.styleFrom(
                backgroundColor: t.primary,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DropdownFiltro<T> extends StatelessWidget {
  final T value;
  final List<T> options;
  final String Function(T) labelOf;
  final ValueChanged<T?> onChanged;

  const _DropdownFiltro({
    required this.value,
    required this.options,
    required this.labelOf,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: t.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: t.border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          icon: Icon(Icons.expand_more_rounded, color: t.textMuted, size: 18),
          isDense: true,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: t.text,
          ),
          dropdownColor: t.surface,
          items: options
              .map((o) => DropdownMenuItem<T>(
                    value: o,
                    child: Text(labelOf(o)),
                  ))
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _CardOcorrencia extends StatelessWidget {
  final Ocorrencia ocorrencia;
  final bool busy;
  final VoidCallback onTap;
  final VoidCallback onResolver;

  const _CardOcorrencia({
    required this.ocorrencia,
    required this.busy,
    required this.onTap,
    required this.onResolver,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final resolvida = ocorrencia.status == StatusOcorrencia.resolvida;
    final syncPending = ocorrencia.pendingSync;

    return Material(
      color: t.surface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
              color: syncPending ? const Color(0xFFE6A700) : t.border,
              width: syncPending ? 2 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 132,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ImagemOcorrencia(ocorrencia: ocorrencia),
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.05),
                              Colors.black.withValues(alpha: 0.35),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 10,
                      left: 10,
                      right: 10,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          StatusPill(status: ocorrencia.status),
                          PrioridadePill(prioridade: ocorrencia.prioridade),
                        ],
                      ),
                    ),
                    if (syncPending)
                      const Positioned(
                        left: 0,
                        right: 0,
                        bottom: 10,
                        child: Center(child: SyncPendingChip()),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            syncPending
                                ? '${labelCategoria(ocorrencia.categoria)} · local'
                                : '${labelCategoria(ocorrencia.categoria)} · #${ocorrencia.id}',
                            style: TextStyle(
                              fontSize: 11,
                              color: t.textMuted,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      ocorrencia.titulo,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: t.text,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      ocorrencia.setor,
                      style: TextStyle(
                        fontSize: 12,
                        color: t.textMuted,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Icon(Icons.schedule_outlined,
                            size: 13, color: t.textMuted),
                        const SizedBox(width: 4),
                        Text(
                          ocorrencia.dataFormatada,
                          style: TextStyle(
                            fontSize: 11,
                            color: t.textMuted,
                          ),
                        ),
                        if (ocorrencia.responsavelNome != null &&
                            ocorrencia.responsavelNome!.trim().isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Icon(Icons.person_outline_rounded,
                              size: 13, color: t.textMuted),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              ocorrencia.responsavelNome!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11,
                                color: t.textMuted,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: onTap,
                            icon: const Icon(Icons.visibility_outlined,
                                size: 16),
                            label: const Text('Ver detalhes'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: t.text,
                              side: BorderSide(color: t.border),
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(AppRadius.sm),
                              ),
                              padding: const EdgeInsets.symmetric(
                                  vertical: 10, horizontal: 8),
                              textStyle: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: (busy || resolvida || syncPending) ? null : onResolver,
                            icon: busy
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.check_rounded, size: 16),
                            label: Text(resolvida ? 'Resolvida' : 'Resolver'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: t.primary,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor:
                                  t.primary.withValues(alpha: 0.4),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(AppRadius.sm),
                              ),
                              padding: const EdgeInsets.symmetric(
                                  vertical: 10, horizontal: 8),
                              textStyle: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// DETALHE DA OCORRÊNCIA
// ═══════════════════════════════════════════════════════════════

class TelaDetalheOcorrencia extends StatefulWidget {
  final Ocorrencia ocorrencia;
  const TelaDetalheOcorrencia({super.key, required this.ocorrencia});

  @override
  State<TelaDetalheOcorrencia> createState() => _TelaDetalheOcorrenciaState();
}

class _TelaDetalheOcorrenciaState extends State<TelaDetalheOcorrencia> {
  static const _maxEvidenciasOcorrencia = 6;

  late Ocorrencia _oc;
  final _comentarioCtrl = TextEditingController();
  final _picker = ImagePicker();
  bool _loading = false;
  bool _enviando = false;
  UsuarioLogado? _usuario;

  @override
  void initState() {
    super.initState();
    _oc = widget.ocorrencia;
    _carregarUsuario();
    _recarregar();
  }

  @override
  void dispose() {
    _comentarioCtrl.dispose();
    super.dispose();
  }

  Future<void> _carregarUsuario() async {
    final u = await AuthStorage.lerUsuario();
    if (mounted) setState(() => _usuario = u);
  }

  /// Apenas gerente ou produtor podem atribuir responsável (paridade com o web).
  bool get _podeAtribuir {
    final p = _usuario?.papel.toUpperCase();
    return (p == 'GERENTE' || p == 'PRODUTOR') &&
        _oc.status == StatusOcorrencia.aberta;
  }

  Future<void> _recarregar() async {
    setState(() => _loading = true);
    try {
      final atual = await OcorrenciasApi.buscar(_oc.id);
      if (mounted) setState(() => _oc = atual);
    } catch (_) {
      // mantém dados anteriores
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resolver() async {
    setState(() => _enviando = true);
    try {
      final atual = await OcorrenciasApi.resolver(_oc.id);
      if (!mounted) return;
      setState(() => _oc = atual);
      _snack('Ocorrência marcada como resolvida.');
    } on ApiException catch (e) {
      _snack(e.mensagem, erro: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _comentar() async {
    final texto = _comentarioCtrl.text.trim();
    if (texto.isEmpty) return;
    setState(() => _enviando = true);
    try {
      final atual = await OcorrenciasApi.comentar(_oc.id, texto);
      if (!mounted) return;
      setState(() {
        _oc = atual;
        _comentarioCtrl.clear();
      });
      _snack('Comentário enviado.');
    } on ApiException catch (e) {
      _snack(e.mensagem, erro: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  /// Envia fotos para a galeria de evidências da ocorrência (paridade com "Anexar fotos" na web).
  Future<void> _anexarEvidencia() async {
    if (_enviando) return;
    final atuais = _oc.imagens.length;
    final vagas = _maxEvidenciasOcorrencia - atuais;
    if (vagas <= 0) {
      _snack('Limite de $_maxEvidenciasOcorrencia fotos por ocorrência.', erro: true);
      return;
    }
    final picked = await _picker.pickMultiImage(imageQuality: 85);
    if (picked.isEmpty || !mounted) return;

    final arquivos = <({List<int> bytes, String filename})>[];
    for (final f in picked.take(vagas)) {
      final bytes = await f.readAsBytes();
      final nome = f.name.trim().isNotEmpty ? f.name : 'foto.jpg';
      arquivos.add((bytes: bytes, filename: nome));
    }
    if (arquivos.isEmpty || !mounted) return;

    setState(() => _enviando = true);
    try {
      final atual = await OcorrenciasApi.uploadImagens(_oc.id, arquivos);
      if (!mounted) return;
      setState(() => _oc = atual);
      _snack(
        arquivos.length == 1
            ? 'Evidência adicionada.'
            : '${arquivos.length} evidências adicionadas.',
      );
    } on ApiException catch (e) {
      _snack(e.mensagem, erro: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _assumir() async {
    setState(() => _enviando = true);
    try {
      final atual = await OcorrenciasApi.assumirResponsavel(_oc.id);
      if (!mounted) return;
      setState(() => _oc = atual);
      _snack('Você assumiu esta ocorrência.');
    } on ApiException catch (e) {
      _snack(e.mensagem, erro: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  /// Permitido para PRODUTOR ou GERENTE — abre seletor de funcionário e
  /// chama a API de atribuição. Espelha o modal de atribuição da web.
  Future<void> _atribuirFuncionario() async {
    final usuario = _usuario;
    if (usuario == null) return;
    final papel = usuario.papel.toUpperCase();
    if (papel != 'GERENTE' && papel != 'PRODUTOR') {
      _snack('Apenas gerente ou produtor podem atribuir.', erro: true);
      return;
    }

    setState(() => _enviando = true);
    List<MembroEquipe> funcs;
    try {
      funcs = await EquipeApi.listarMembros(papel: 'FUNCIONARIO_CAMPO');
    } catch (_) {
      funcs = const [];
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
    if (!mounted) return;
    final ativos = funcs.where((m) => m.ativo).toList();
    if (ativos.isEmpty) {
      _snack('Nenhum funcionário de campo cadastrado na equipe.', erro: true);
      return;
    }

    final escolhido = await showModalBottomSheet<_AcaoAtribuicao>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => _SeletorAtribuicao(
        membros: ativos,
        responsavelAtualId: _oc.responsavelId,
      ),
    );
    if (escolhido == null || !mounted) return;

    setState(() => _enviando = true);
    try {
      final atual = await OcorrenciasApi.definirResponsavel(
        _oc.id,
        escolhido.remover ? null : escolhido.usuarioId,
      );
      if (!mounted) return;
      setState(() => _oc = atual);
      _snack(escolhido.remover
          ? 'Responsável removido.'
          : 'Ocorrência atribuída a ${escolhido.nome}.');
    } on ApiException catch (e) {
      _snack(e.mensagem, erro: true);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  void _snack(String msg, {bool erro = false}) {
    if (!mounted) return;
    final t = AppTokens.of(context);
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: erro ? t.danger : t.primary,
        behavior: SnackBarBehavior.floating,
      ));
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final aberta = _oc.status == StatusOcorrencia.aberta;
    final evidencias =
        _oc.imagens.map(resolveApiUrl).where((s) => s.isNotEmpty).toList();

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppHeader(
        title: 'Ocorrência #${_oc.id}',
        subtitle: labelCategoria(_oc.categoria),
        usuario: _usuario,
        onBack: () => Navigator.pop(context),
        showAvatar: false,
        showNotificacoes: false,
      ),
      body: RefreshIndicator(
        onRefresh: _recarregar,
        color: t.primary,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 120),
          children: [
            if (_loading)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: LinearProgressIndicator(
                  color: t.primary,
                  backgroundColor: t.border,
                  minHeight: 2,
                ),
              ),
            _CardResumo(ocorrencia: _oc),
            const SizedBox(height: AppSpacing.lg),
            _Bloco(
              icone: Icons.description_outlined,
              titulo: 'Descrição',
              child: Text(
                _oc.descricaoResumo,
                style: TextStyle(
                  fontSize: 13,
                  color: t.text,
                  height: 1.5,
                ),
              ),
            ),
            if (_oc.coordsY != 0 || _oc.coordsX != 0) ...[
              const SizedBox(height: AppSpacing.lg),
              _Bloco(
                icone: Icons.location_on_outlined,
                titulo: 'Local da ocorrência',
                acaoLabel:
                    '${_oc.coordsY.toStringAsFixed(5)}, ${_oc.coordsX.toStringAsFixed(5)}',
                child: _MapaLocalOcorrencia(ocorrencia: _oc),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            _Bloco(
              icone: Icons.person_outline_rounded,
              titulo: 'Responsável',
              acaoLabel: _podeAtribuir ? 'Atribuir' : null,
              onAcao: _podeAtribuir && !_enviando ? _atribuirFuncionario : null,
              child: _BlocoResponsavel(
                nome: _oc.responsavelNome,
                podeAssumir: aberta,
                ehVoceMesmo:
                    _usuario != null && _oc.responsavelId == _usuario!.id,
                onAssumir: _enviando ? null : _assumir,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _Bloco(
              icone: Icons.image_outlined,
              titulo: 'Evidências',
              acaoLabel: aberta
                  ? (evidencias.length >= _maxEvidenciasOcorrencia
                      ? 'Limite atingido'
                      : 'Adicionar foto')
                  : '${evidencias.length} ${evidencias.length == 1 ? "foto" : "fotos"}',
              onAcao: aberta &&
                      !_enviando &&
                      evidencias.length < _maxEvidenciasOcorrencia
                  ? _anexarEvidencia
                  : null,
              child: evidencias.isEmpty
                  ? Text(
                      aberta
                          ? 'Nenhuma evidência ainda. Toque em "Adicionar foto" ou use o ícone de anexo no comentário.'
                          : 'Nenhuma evidência registrada.',
                      style: TextStyle(color: t.textMuted, fontSize: 13),
                    )
                  : SizedBox(
                      height: 110,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: evidencias.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(width: 8),
                        itemBuilder: (_, idx) => ClipRRect(
                          borderRadius:
                              BorderRadius.circular(AppRadius.md),
                          child: Image.network(
                            evidencias[idx],
                            width: 140,
                            height: 110,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 140,
                              height: 110,
                              color: t.surfaceMuted,
                              child: Icon(Icons.broken_image_outlined,
                                  color: t.textMuted),
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _Bloco(
              icone: Icons.history_rounded,
              titulo: 'Comentários',
              child: _oc.linhasComentario.isEmpty
                  ? Text(
                      'Nenhum comentário ainda.',
                      style:
                          TextStyle(color: t.textMuted, fontSize: 13),
                    )
                  : Column(
                      children: _oc.linhasComentario
                          .map((l) => _ItemComentario(linha: l))
                          .toList(),
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: aberta ? _buildBarraInferior(t) : null,
    );
  }

  Widget _buildBarraInferior(AppTokens t) {
    final aberta = _oc.status == StatusOcorrencia.aberta;
    final qtdEvidencias = _oc.imagens.length;
    return SafeArea(
      child: Container(
        decoration: BoxDecoration(
          color: t.surface,
          border: Border(top: BorderSide(color: t.border)),
        ),
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, AppSpacing.sm, AppSpacing.lg, AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _comentarioCtrl,
              enabled: !_enviando,
              minLines: 1,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Adicionar comentário…',
                isDense: true,
                prefixIcon: aberta && qtdEvidencias < _maxEvidenciasOcorrencia
                    ? IconButton(
                        onPressed: _enviando ? null : _anexarEvidencia,
                        icon: Icon(Icons.add_photo_alternate_outlined,
                            color: t.primary),
                        tooltip: 'Adicionar evidência',
                      )
                    : null,
                suffixIcon: IconButton(
                  onPressed: _enviando ? null : _comentar,
                  icon: Icon(Icons.send_rounded, color: t.primary),
                  tooltip: 'Enviar',
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _enviando ? null : _resolver,
                icon: _enviando
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check_rounded, size: 16),
                label: const Text('Marcar como resolvida'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: t.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardResumo extends StatelessWidget {
  final Ocorrencia ocorrencia;
  const _CardResumo({required this.ocorrencia});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Container(
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: t.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 160,
            child: ImagemOcorrencia(ocorrencia: ocorrencia),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    StatusPill(status: ocorrencia.status),
                    PrioridadePill(prioridade: ocorrencia.prioridade),
                    CategoriaPill(categoria: ocorrencia.categoria),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  ocorrencia.titulo,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: t.text,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Icon(Icons.schedule_outlined,
                        size: 14, color: t.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      ocorrencia.dataFormatada,
                      style: TextStyle(
                        fontSize: 12,
                        color: t.textMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.location_on_outlined,
                        size: 14, color: t.textMuted),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        ocorrencia.localizacao,
                        style: TextStyle(
                          fontSize: 12,
                          color: t.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Bloco extends StatelessWidget {
  final IconData icone;
  final String titulo;
  final Widget child;
  final String? acaoLabel;
  final VoidCallback? onAcao;

  const _Bloco({
    required this.icone,
    required this.titulo,
    required this.child,
    this.acaoLabel,
    this.onAcao,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icone, size: 18, color: t.primary),
              const SizedBox(width: 6),
              Text(
                titulo,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: t.text,
                ),
              ),
              if (acaoLabel != null) ...[
                const Spacer(),
                if (onAcao != null)
                  TextButton(
                    onPressed: onAcao,
                    style: TextButton.styleFrom(
                      foregroundColor: t.primary,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      minimumSize: const Size(0, 28),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      acaoLabel!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  )
                else
                  Text(
                    acaoLabel!,
                    style: TextStyle(fontSize: 11, color: t.textMuted),
                  ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _ItemComentario extends StatelessWidget {
  final LinhaComentario linha;
  const _ItemComentario({required this.linha});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final quando = horarioComentarioLegivel(linha.quando);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: t.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: t.borderSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              linha.autor,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: t.text,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              linha.texto,
              style: TextStyle(fontSize: 13, color: t.text, height: 1.4),
            ),
            if (quando.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                quando,
                style: TextStyle(fontSize: 10, color: t.textMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Mini-mapa do detalhe — pin estilo "Google Maps" no local da ocorrência
// ─────────────────────────────────────────────────────────────────

class _MapaLocalOcorrencia extends StatelessWidget {
  final Ocorrencia ocorrencia;
  const _MapaLocalOcorrencia({required this.ocorrencia});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final ponto = LatLng(ocorrencia.coordsY, ocorrencia.coordsX);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: SizedBox(
        height: 200,
        child: FlutterMap(
          options: MapOptions(
            initialCenter: ponto,
            initialZoom: 18,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.pinchZoom |
                  InteractiveFlag.drag |
                  InteractiveFlag.doubleTapZoom,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate:
                  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              userAgentPackageName: 'com.agrolink.app',
              maxZoom: 19,
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: ponto,
                  width: 44,
                  height: 44,
                  alignment: Alignment.bottomCenter,
                  child: Icon(
                    Icons.location_on,
                    size: 40,
                    color: t.danger,
                    shadows: const [
                      Shadow(
                        color: Color(0x55000000),
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Bloco de Responsável — mostra atual + botão "Assumir" (campo)
// ─────────────────────────────────────────────────────────────────

class _BlocoResponsavel extends StatelessWidget {
  final String? nome;
  final bool podeAssumir;
  final bool ehVoceMesmo;
  final VoidCallback? onAssumir;

  const _BlocoResponsavel({
    required this.nome,
    required this.podeAssumir,
    required this.ehVoceMesmo,
    required this.onAssumir,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final hasResp = nome != null && nome!.trim().isNotEmpty;
    return Row(
      children: [
        Expanded(
          child: Text(
            hasResp ? nome! : 'Ninguém atribuído ainda',
            style: TextStyle(
              fontSize: 13,
              color: hasResp ? t.text : t.textMuted,
              fontWeight: hasResp ? FontWeight.w600 : FontWeight.w500,
              fontStyle: hasResp ? FontStyle.normal : FontStyle.italic,
            ),
          ),
        ),
        if (podeAssumir && !ehVoceMesmo)
          OutlinedButton.icon(
            onPressed: onAssumir,
            icon: const Icon(Icons.person_add_alt_1_rounded, size: 16),
            label: const Text('Assumir'),
            style: OutlinedButton.styleFrom(
              foregroundColor: t.text,
              side: BorderSide(color: t.border),
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: const Size(0, 36),
            ),
          )
        else if (ehVoceMesmo)
          Text(
            'Você é o responsável',
            style: TextStyle(
              fontSize: 11,
              color: t.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Modal de seleção de funcionário (atribuição)
// ─────────────────────────────────────────────────────────────────

class _AcaoAtribuicao {
  final int? usuarioId;
  final String nome;
  final bool remover;
  const _AcaoAtribuicao(
      {this.usuarioId, required this.nome, this.remover = false});
}

class _SeletorAtribuicao extends StatelessWidget {
  final List<MembroEquipe> membros;
  final int? responsavelAtualId;
  const _SeletorAtribuicao({
    required this.membros,
    required this.responsavelAtualId,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Atribuir funcionário de campo',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: t.text,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Apenas funcionários ativos da fazenda aparecem aqui.',
              style: TextStyle(fontSize: 12, color: t.textMuted),
            ),
            const SizedBox(height: AppSpacing.md),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 320),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: membros.length,
                separatorBuilder: (_, __) =>
                    Divider(color: t.border, height: 1),
                itemBuilder: (_, i) {
                  final m = membros[i];
                  final atual = responsavelAtualId == m.id;
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: t.primary.withValues(alpha: 0.12),
                      foregroundColor: t.primary,
                      child: Text(
                        m.nome.isNotEmpty ? m.nome[0].toUpperCase() : '?',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    title: Text(
                      m.nome,
                      style: TextStyle(color: t.text),
                    ),
                    subtitle: m.email != null && m.email!.isNotEmpty
                        ? Text(
                            m.email!,
                            style: TextStyle(
                                color: t.textMuted, fontSize: 12),
                          )
                        : null,
                    trailing: atual
                        ? Icon(Icons.check_circle, color: t.primary, size: 22)
                        : Icon(Icons.chevron_right_rounded,
                            color: t.textMuted),
                    onTap: () => Navigator.of(context).pop(
                      _AcaoAtribuicao(
                        usuarioId: m.id,
                        nome: m.nome,
                      ),
                    ),
                  );
                },
              ),
            ),
            if (responsavelAtualId != null) ...[
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).pop(
                    const _AcaoAtribuicao(nome: '', remover: true),
                  ),
                  icon: const Icon(Icons.person_off_outlined, size: 16),
                  label: const Text('Remover responsável'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: t.danger,
                    side: BorderSide(color: t.border),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
