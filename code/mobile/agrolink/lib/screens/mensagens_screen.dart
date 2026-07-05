import 'package:flutter/material.dart';

import '../config/api_config.dart';
import '../main.dart';
import '../services/auth_storage.dart';
import '../services/chat_api.dart';
import '../theme/app_tokens.dart';
import '../widgets/app_header.dart';
import '../widgets/user_avatar.dart';

// ═══════════════════════════════════════════════════════════════
// MODELOS
// ═══════════════════════════════════════════════════════════════

class Conversa {
  final int id;
  final String titulo;
  final String? ultimaPreview;
  final String? ultimaEm;
  final String? imagemUrl;

  const Conversa({
    required this.id,
    required this.titulo,
    this.ultimaPreview,
    this.ultimaEm,
    this.imagemUrl,
  });

  factory Conversa.fromApi(Map<String, dynamic> sala) {
    final preview = sala['ultimaPreview']?.toString();
    return Conversa(
      id: sala['id'] as int? ?? int.tryParse('${sala['id']}') ?? 0,
      titulo: sala['nome']?.toString().trim().isNotEmpty == true
          ? sala['nome'].toString()
          : 'Canal sem nome',
      ultimaPreview: preview != null && preview.isNotEmpty ? preview : null,
      ultimaEm: sala['ultimaEm']?.toString(),
      imagemUrl: sala['imagemUrl']?.toString(),
    );
  }
}

class Mensagem {
  final String id;
  final String autor;
  final String? autorEmail;
  final String? texto;
  final String? imageUrl;
  final String hora;
  final String? criadoEm;
  final bool isMinha;
  final String? avatarUrl;

  const Mensagem({
    required this.id,
    required this.autor,
    this.autorEmail,
    this.texto,
    this.imageUrl,
    required this.hora,
    this.criadoEm,
    required this.isMinha,
    this.avatarUrl,
  });
}

String _formatarHoraLista(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  final local = d.toLocal();
  final now = DateTime.now();
  final diff = now.difference(local);
  if (diff.inMinutes < 1) return 'Agora';
  if (diff.inDays == 0) {
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
  if (diff.inDays < 7) {
    const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
    return dias[local.weekday - 1];
  }
  return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}';
}

String _formatarHoraMensagem(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  final local = d.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

String _formatarDataLinha(String? iso) {
  if (iso == null || iso.isEmpty) {
    final hoje = DateTime.now();
    return _dataPorExtenso(hoje);
  }
  final d = DateTime.tryParse(iso);
  if (d == null) return 'Conversa';
  return _dataPorExtenso(d.toLocal());
}

String _dataPorExtenso(DateTime d) {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  final hoje = DateTime.now();
  final mesmoDia = d.year == hoje.year && d.month == hoje.month && d.day == hoje.day;
  final prefixo = mesmoDia ? 'Hoje' : d.day.toString();
  if (mesmoDia) {
    return '$prefixo, ${d.day} de ${meses[d.month - 1]}';
  }
  return '${d.day} de ${meses[d.month - 1]} de ${d.year}';
}

// ═══════════════════════════════════════════════════════════════
// TELA LISTA DE CONVERSAS
// ═══════════════════════════════════════════════════════════════

class TelaMensagens extends StatefulWidget {
  const TelaMensagens({super.key});

  @override
  State<TelaMensagens> createState() => _TelaMensagensState();
}

class _TelaMensagensState extends State<TelaMensagens> {
  final _buscaController = TextEditingController();

  UsuarioLogado? _usuario;
  List<Conversa> _conversas = [];
  List<Conversa> _lista = [];
  bool _carregando = true;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _inicializar();
  }

  @override
  void dispose() {
    _buscaController.dispose();
    super.dispose();
  }

  Future<void> _inicializar() async {
    final u = await AuthStorage.lerUsuario();
    if (mounted) setState(() => _usuario = u);
    await _carregarSalas();
  }

  Future<void> _carregarSalas() async {
    setState(() {
      _carregando = true;
      _erro = null;
    });
    try {
      final salas = await ChatApi.listarSalas();
      final conversas = salas
          .whereType<Map<String, dynamic>>()
          .map(Conversa.fromApi)
          .where((c) => c.id > 0)
          .toList();

      if (!mounted) return;
      setState(() {
        _conversas = conversas;
        _lista = conversas;
        _carregando = false;
        _erro = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _carregando = false;
        _erro = 'Não foi possível carregar os canais de mensagens.';
      });
    }
  }

  void _filtrar(String query) {
    final q = query.trim().toLowerCase();
    setState(() {
      _lista = q.isEmpty
          ? _conversas
          : _conversas
              .where((c) =>
                  c.titulo.toLowerCase().contains(q) ||
                  (c.ultimaPreview ?? '').toLowerCase().contains(q))
              .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppHeader(
        title: 'Mensagens',
        subtitle: _carregando
            ? 'Carregando canais…'
            : _conversas.length == 1
                ? '1 canal'
                : '${_conversas.length} canais',
        usuario: _usuario,
        onAvatarTap: () => TelaPrincipal.estadoDe(context)
            ?.selecionarAba(TelaPrincipal.abaPerfil),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: t.surface,
              border: Border(bottom: BorderSide(color: t.border)),
            ),
            child: TextField(
              controller: _buscaController,
              onChanged: _filtrar,
              style: TextStyle(fontSize: 14, color: t.text),
              decoration: InputDecoration(
                hintText: 'Buscar canal ou mensagem…',
                hintStyle: TextStyle(color: t.textMuted, fontSize: 13),
                prefixIcon: Icon(Icons.search_rounded, color: t.textMuted, size: 22),
                filled: true,
                fillColor: t.surfaceMuted,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: BorderSide(color: t.borderSoft),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: BorderSide(color: t.borderSoft),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: BorderSide(color: t.primary, width: 1.5),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.sm,
            ),
            child: Text(
              'CANAIS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: t.textMuted,
                letterSpacing: 0.8,
              ),
            ),
          ),
          Expanded(
            child: _carregando
                ? Center(
                    child: CircularProgressIndicator(
                      color: t.primary,
                      strokeWidth: 2.5,
                    ),
                  )
                : _erro != null
                    ? _buildErro(t)
                    : RefreshIndicator(
                        onRefresh: _carregarSalas,
                        color: t.primary,
                        child: _lista.isEmpty
                            ? ListView(
                                children: [_buildVazio(t)],
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                  AppSpacing.lg,
                                  0,
                                  AppSpacing.lg,
                                  AppSpacing.xxl,
                                ),
                                itemCount: _lista.length,
                                separatorBuilder: (_, __) =>
                                    Divider(height: 1, color: t.borderSoft),
                                itemBuilder: (_, idx) =>
                                    _ItemConversa(conversa: _lista[idx]),
                              ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildErro(AppTokens t) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_rounded, size: 40, color: t.textMuted),
            const SizedBox(height: AppSpacing.md),
            Text(
              _erro!,
              textAlign: TextAlign.center,
              style: TextStyle(color: t.textMuted, fontSize: 14),
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: _carregarSalas,
              style: FilledButton.styleFrom(
                backgroundColor: t.primary,
                foregroundColor: Colors.white,
              ),
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVazio(AppTokens t) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Column(
        children: [
          Icon(Icons.chat_bubble_outline_rounded, size: 48, color: t.textMuted),
          const SizedBox(height: AppSpacing.md),
          Text(
            _buscaController.text.trim().isEmpty
                ? 'Nenhum canal disponível.'
                : 'Nenhum canal corresponde à busca.',
            textAlign: TextAlign.center,
            style: TextStyle(color: t.textMuted, fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _ItemConversa extends StatelessWidget {
  final Conversa conversa;
  const _ItemConversa({required this.conversa});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final preview = conversa.ultimaPreview ?? 'Nenhuma mensagem ainda';
    final hora = _formatarHoraLista(conversa.ultimaEm);

    return InkWell(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => TelaChat(conversa: conversa)),
      ),
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Row(
          children: [
            _AvatarCanal(imagemUrl: conversa.imagemUrl, titulo: conversa.titulo),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          conversa.titulo,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: t.text,
                          ),
                        ),
                      ),
                      if (hora.isNotEmpty) ...[
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          hora,
                          style: TextStyle(fontSize: 11, color: t.textMuted),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    preview,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      color: conversa.ultimaPreview != null ? t.textMuted : t.textMuted.withValues(alpha: 0.75),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Icon(Icons.chevron_right_rounded, color: t.textMuted, size: 22),
          ],
        ),
      ),
    );
  }
}

class _AvatarCanal extends StatelessWidget {
  final String? imagemUrl;
  final String titulo;

  const _AvatarCanal({required this.imagemUrl, required this.titulo});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final url = (imagemUrl ?? '').trim();
    if (url.isNotEmpty) {
      final resolved = resolveApiUrl(url);
      return ClipOval(
        child: Image.network(
          resolved,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _fallback(t),
        ),
      );
    }
    return _fallback(t);
  }

  Widget _fallback(AppTokens t) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: t.primarySoft,
        border: Border.all(color: t.border),
      ),
      child: Icon(Icons.groups_rounded, color: t.primary, size: 24),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// TELA CHAT INDIVIDUAL
// ═══════════════════════════════════════════════════════════════

class TelaChat extends StatefulWidget {
  final Conversa conversa;
  const TelaChat({super.key, required this.conversa});

  @override
  State<TelaChat> createState() => _TelaChatState();
}

class _TelaChatState extends State<TelaChat> {
  final _msgController = TextEditingController();
  final _scrollController = ScrollController();

  UsuarioLogado? _usuario;
  List<Mensagem> _mensagens = [];
  bool _carregando = true;
  bool _enviando = false;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _inicializar();
  }

  @override
  void dispose() {
    _msgController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _inicializar() async {
    final u = await AuthStorage.lerUsuario();
    if (mounted) setState(() => _usuario = u);
    await _carregarMensagens();
  }

  Future<void> _carregarMensagens() async {
    setState(() {
      _carregando = true;
      _erro = null;
    });
    try {
      final mensagensApi = await ChatApi.listarMensagens(widget.conversa.id);
      final meuEmail = _usuario?.email.trim().toLowerCase() ?? '';

      final mensagens = mensagensApi.whereType<Map<String, dynamic>>().map((msg) {
        final autorEmail = msg['autorEmail']?.toString().trim().toLowerCase() ?? '';
        final midia = msg['midiaUrl']?.toString();
        return Mensagem(
          id: msg['id']?.toString() ?? '',
          autor: msg['autorNome']?.toString() ?? 'Usuário',
          autorEmail: autorEmail,
          texto: msg['texto']?.toString(),
          imageUrl: midia != null && midia.isNotEmpty ? resolveApiUrl(midia) : null,
          hora: _formatarHoraMensagem(msg['criadoEm']?.toString()),
          criadoEm: msg['criadoEm']?.toString(),
          isMinha: meuEmail.isNotEmpty && autorEmail == meuEmail,
          avatarUrl: msg['autorFotoUrl']?.toString(),
        );
      }).toList();

      if (!mounted) return;
      setState(() {
        _mensagens = mensagens;
        _carregando = false;
        _erro = null;
      });
      _rolarParaFinal();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _carregando = false;
        _erro = 'Não foi possível carregar as mensagens.';
      });
    }
  }

  void _rolarParaFinal() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _enviar() async {
    final texto = _msgController.text.trim();
    if (texto.isEmpty || _enviando) return;

    setState(() => _enviando = true);
    _msgController.clear();

    try {
      final msg = await ChatApi.enviarMensagem(
        salaId: widget.conversa.id,
        texto: texto,
      );

      final novaMensagem = Mensagem(
        id: msg['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
        autor: msg['autorNome']?.toString() ?? _usuario?.nome ?? 'Você',
        autorEmail: msg['autorEmail']?.toString(),
        texto: msg['texto']?.toString() ?? texto,
        imageUrl: msg['midiaUrl'] != null ? resolveApiUrl(msg['midiaUrl'].toString()) : null,
        hora: _formatarHoraMensagem(msg['criadoEm']?.toString()),
        criadoEm: msg['criadoEm']?.toString(),
        isMinha: true,
        avatarUrl: msg['autorFotoUrl']?.toString() ?? _usuario?.fotoUrl,
      );

      if (!mounted) return;
      setState(() {
        _mensagens.add(novaMensagem);
        _enviando = false;
      });
      _rolarParaFinal();
    } catch (_) {
      if (!mounted) return;
      setState(() => _enviando = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Não foi possível enviar a mensagem.'),
          backgroundColor: AppTokens.of(context).danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final dataLinha = _mensagens.isNotEmpty
        ? _formatarDataLinha(_mensagens.last.criadoEm)
        : _formatarDataLinha(null);

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppHeader(
        title: widget.conversa.titulo,
        subtitle: 'Canal da equipe',
        onBack: () => Navigator.pop(context),
        usuario: _usuario,
        showNotificacoes: false,
      ),
      body: Column(
        children: [
          Expanded(
            child: _carregando
                ? Center(
                    child: CircularProgressIndicator(
                      color: t.primary,
                      strokeWidth: 2.5,
                    ),
                  )
                : _erro != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.xl),
                          child: Text(
                            _erro!,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: t.textMuted),
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _carregarMensagens,
                        color: t.primary,
                        child: _mensagens.isEmpty
                            ? ListView(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.all(AppSpacing.xxl),
                                    child: Center(
                                      child: Text(
                                        'Nenhuma mensagem neste canal.\nEnvie a primeira abaixo.',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(color: t.textMuted),
                                      ),
                                    ),
                                  ),
                                ],
                              )
                            : ListView.builder(
                                controller: _scrollController,
                                padding: const EdgeInsets.fromLTRB(
                                  AppSpacing.lg,
                                  AppSpacing.md,
                                  AppSpacing.lg,
                                  AppSpacing.lg,
                                ),
                                itemCount: _mensagens.length + 1,
                                itemBuilder: (_, idx) {
                                  if (idx == 0) {
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                                      child: Center(
                                        child: Text(
                                          dataLinha.toUpperCase(),
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: t.textMuted,
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ),
                                    );
                                  }
                                  return _BolhaMensagem(mensagem: _mensagens[idx - 1]);
                                },
                              ),
                      ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: t.surface,
              border: Border(top: BorderSide(color: t.border)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _msgController,
                    enabled: !_enviando,
                    minLines: 1,
                    maxLines: 4,
                    style: TextStyle(fontSize: 14, color: t.text),
                    decoration: InputDecoration(
                      hintText: 'Digite uma mensagem',
                      hintStyle: TextStyle(color: t.textMuted, fontSize: 13),
                      filled: true,
                      fillColor: t.surfaceMuted,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg,
                        vertical: 10,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        borderSide: BorderSide(color: t.borderSoft),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        borderSide: BorderSide(color: t.borderSoft),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        borderSide: BorderSide(color: t.primary, width: 1.5),
                      ),
                    ),
                    onSubmitted: (_) => _enviar(),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Material(
                  color: t.primary,
                  shape: const CircleBorder(),
                  child: InkWell(
                    onTap: _enviando ? null : _enviar,
                    customBorder: const CircleBorder(),
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: _enviando
                          ? Padding(
                              padding: const EdgeInsets.all(12),
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BolhaMensagem extends StatelessWidget {
  final Mensagem mensagem;
  const _BolhaMensagem({required this.mensagem});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final minha = mensagem.isMinha;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: minha ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!minha) ...[
            UserAvatar(
              nome: mensagem.autor,
              fotoUrl: mensagem.avatarUrl,
              size: 32,
            ),
            const SizedBox(width: AppSpacing.sm),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment:
                  minha ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!minha)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4, left: 2),
                    child: Text(
                      mensagem.autor,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: t.textMuted,
                      ),
                    ),
                  ),
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.72,
                  ),
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                  decoration: BoxDecoration(
                    color: minha ? t.primary : t.surface,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(AppRadius.lg),
                      topRight: const Radius.circular(AppRadius.lg),
                      bottomLeft: Radius.circular(minha ? AppRadius.lg : AppRadius.sm),
                      bottomRight: Radius.circular(minha ? AppRadius.sm : AppRadius.lg),
                    ),
                    border: minha ? null : Border.all(color: t.borderSoft),
                  ),
                  child: _conteudo(t, minha),
                ),
              ],
            ),
          ),
          if (minha) ...[
            const SizedBox(width: AppSpacing.sm),
            UserAvatar(
              nome: mensagem.autor,
              fotoUrl: mensagem.avatarUrl,
              size: 32,
            ),
          ],
        ],
      ),
    );
  }

  Widget _conteudo(AppTokens t, bool minha) {
    if (mensagem.imageUrl != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: Image.network(
              mensagem.imageUrl!,
              width: 200,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 200,
                height: 120,
                color: t.surfaceMuted,
                alignment: Alignment.center,
                child: Icon(Icons.broken_image_outlined, color: t.textMuted),
              ),
            ),
          ),
          if (mensagem.texto != null && mensagem.texto!.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              mensagem.texto!,
              style: TextStyle(
                fontSize: 14,
                color: minha ? Colors.white : t.text,
                height: 1.4,
              ),
            ),
          ],
          const SizedBox(height: 4),
          Text(
            mensagem.hora,
            style: TextStyle(
              fontSize: 10,
              color: minha ? Colors.white70 : t.textMuted,
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (mensagem.texto != null && mensagem.texto!.trim().isNotEmpty)
          Text(
            mensagem.texto!,
            style: TextStyle(
              fontSize: 14,
              color: minha ? Colors.white : t.text,
              height: 1.4,
            ),
          ),
        const SizedBox(height: 4),
        Text(
          mensagem.hora,
          style: TextStyle(
            fontSize: 10,
            color: minha ? Colors.white70 : t.textMuted,
          ),
        ),
      ],
    );
  }
}
