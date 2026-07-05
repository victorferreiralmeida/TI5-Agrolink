import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../models/ocorrencia_model.dart';
import '../services/api_service.dart';
import '../services/auth_storage.dart';
import '../services/equipe_api.dart';
import '../services/ocorrencias_api.dart';
import '../services/theme_controller.dart';
import '../services/usuario_api.dart';
import '../theme/app_tokens.dart';
import '../widgets/app_header.dart';
import '../widgets/user_avatar.dart';
import 'login_screen.dart';

class TelaPerfil extends StatefulWidget {
  const TelaPerfil({super.key});

  @override
  State<TelaPerfil> createState() => _TelaPerfilState();
}

class _TelaPerfilState extends State<TelaPerfil> {
  final _picker = ImagePicker();
  final _nomeCtrl = TextEditingController();
  final _telCtrl = TextEditingController();

  UsuarioLogado? _usuario;
  int _totalOcorrencias = 0;
  int _totalEquipe = 0;

  bool _loading = true;
  bool _salvando = false;
  bool _enviandoFoto = false;
  bool _saindo = false;
  String? _erro;
  String? _ok;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  @override
  void dispose() {
    _nomeCtrl.dispose();
    _telCtrl.dispose();
    super.dispose();
  }

  Future<void> _carregar() async {
    setState(() {
      _loading = true;
      _erro = null;
    });
    try {
      final stored = await AuthStorage.lerUsuario();
      UsuarioLogado? usuario = stored;
      try {
        usuario = await UsuarioApi.me();
      } catch (_) {
        // mantém o que está no storage local
      }
      final ocorrencias =
          await OcorrenciasApi.listar().catchError((_) => <Ocorrencia>[]);
      final equipe = await EquipeApi.carregarResumo();
      if (!mounted) return;
      setState(() {
        _usuario = usuario;
        _nomeCtrl.text = usuario?.nome ?? '';
        _telCtrl.text = usuario?.telefone ?? '';
        _totalOcorrencias = ocorrencias.length;
        _totalEquipe = equipe?.totalMembros ?? 0;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _erro = 'Não foi possível carregar o perfil.';
        _loading = false;
      });
    }
  }

  Future<void> _salvar() async {
    final nome = _nomeCtrl.text.trim();
    final tel = _telCtrl.text.trim();
    if (nome.isEmpty) {
      setState(() {
        _erro = 'Informe seu nome.';
        _ok = null;
      });
      return;
    }
    setState(() {
      _salvando = true;
      _erro = null;
      _ok = null;
    });
    try {
      final atualizado =
          await UsuarioApi.atualizar(nome: nome, telefone: tel);
      if (!mounted) return;
      setState(() {
        _usuario = atualizado;
        _ok = 'Dados salvos.';
      });
    } on ApiException catch (e) {
      setState(() => _erro = e.mensagem);
    } catch (_) {
      setState(() => _erro = 'Não foi possível salvar.');
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  Future<void> _trocarFoto() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 1024,
        maxHeight: 1024,
      );
      if (picked == null) return;
      setState(() {
        _enviandoFoto = true;
        _erro = null;
        _ok = null;
      });
      final bytes = await picked.readAsBytes();
      final atualizado = await UsuarioApi.uploadFoto(
        bytes: bytes,
        filename: picked.name,
      );
      if (!mounted) return;
      setState(() {
        _usuario = atualizado;
        _ok = 'Foto atualizada.';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _erro = e.mensagem);
    } catch (_) {
      if (mounted) {
        setState(() => _erro = 'Não foi possível enviar a foto.');
      }
    } finally {
      if (mounted) setState(() => _enviandoFoto = false);
    }
  }

  Future<void> _confirmarLogout() async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (_) {
        final t = AppTokens.of(context);
        return AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          backgroundColor: t.surface,
          title: Text('Sair da conta',
              style: TextStyle(fontWeight: FontWeight.bold, color: t.text)),
          content: Text('Tem certeza que deseja sair da sua conta?',
              style: TextStyle(color: t.textMuted)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text('Cancelar',
                  style: TextStyle(color: t.textMuted)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: t.danger,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: const Text('Sair'),
            ),
          ],
        );
      },
    );
    if (confirmar != true) return;

    setState(() => _saindo = true);
    await ApiService.logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const TelaLogin()),
      (_) => false,
    );
  }

  String get _papelLabel {
    switch (_usuario?.papel.toLowerCase()) {
      case 'gerente':
        return 'Gerente de operações';
      case 'funcionario':
      case 'funcionario_campo':
        return 'Funcionário de campo';
      case 'produtor':
      default:
        return 'Produtor rural';
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppHeader(
        title: 'Meu perfil',
        subtitle: _usuario?.email,
        usuario: _usuario,
        showAvatar: false,
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(color: t.primary),
            )
          : RefreshIndicator(
              onRefresh: _carregar,
              color: t.primary,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 32),
                children: [
                  _CardIdentidade(
                    usuario: _usuario,
                    papel: _papelLabel,
                    totalOcorrencias: _totalOcorrencias,
                    totalEquipe: _totalEquipe,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _CardSecao(
                    titulo: 'Foto de perfil',
                    child: Row(
                      children: [
                        UserAvatar(
                          nome: _usuario?.nome ?? '?',
                          fotoUrl: _usuario?.fotoUrl,
                          size: 64,
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ElevatedButton.icon(
                                onPressed: _enviandoFoto ? null : _trocarFoto,
                                icon: _enviandoFoto
                                    ? const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Icon(Icons.upload_rounded,
                                        size: 16),
                                label: Text(
                                  _enviandoFoto
                                      ? 'Enviando…'
                                      : (_usuario?.fotoUrl.isEmpty ?? true
                                          ? 'Enviar foto'
                                          : 'Trocar foto'),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: t.primary,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 10),
                                  shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.sm),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'JPEG/PNG/WebP até 5MB. Aparece na equipe e nos comentários.',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: t.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _CardSecao(
                    titulo: 'Dados básicos',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Campo(
                          label: 'Nome completo',
                          child: TextField(
                            controller: _nomeCtrl,
                            textCapitalization: TextCapitalization.words,
                            decoration: const InputDecoration(
                              hintText: 'Seu nome',
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _Campo(
                          label: 'Telefone',
                          child: TextField(
                            controller: _telCtrl,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              hintText: 'Opcional',
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _Campo(
                          label: 'E-mail',
                          child: TextField(
                            controller:
                                TextEditingController(text: _usuario?.email),
                            enabled: false,
                            style: TextStyle(color: t.textMuted),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'O e-mail não pode ser alterado por aqui.',
                          style:
                              TextStyle(fontSize: 11, color: t.textMuted),
                        ),
                        if (_erro != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            _erro!,
                            style: TextStyle(
                              fontSize: 12,
                              color: t.danger,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                        if (_ok != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            _ok!,
                            style: TextStyle(
                              fontSize: 12,
                              color: t.success,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.md),
                        Align(
                          alignment: Alignment.centerRight,
                          child: ElevatedButton.icon(
                            onPressed: _salvando ? null : _salvar,
                            icon: _salvando
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.save_rounded, size: 16),
                            label: Text(
                              _salvando ? 'Salvando…' : 'Salvar alterações',
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: t.primary,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 18, vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(AppRadius.sm),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _CardSecao(
                    titulo: 'Aparência',
                    child: ListenableBuilder(
                      listenable: ThemeController.instance,
                      builder: (context, _) {
                        final isDark = ThemeController.instance.isDark;
                        return Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: t.primarySoft,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                isDark
                                    ? Icons.dark_mode_outlined
                                    : Icons.light_mode_outlined,
                                color: t.primary,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Modo escuro',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: t.text,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    isDark
                                        ? 'Tema escuro ativado.'
                                        : 'Tema claro ativado.',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: t.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Switch(
                              value: isDark,
                              onChanged: (v) =>
                                  ThemeController.instance.setDark(v),
                              activeThumbColor: t.primary,
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _CardSecao(
                    titulo: 'Conta',
                    child: SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _saindo ? null : _confirmarLogout,
                        icon: _saindo
                            ? SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: t.danger,
                                ),
                              )
                            : Icon(Icons.logout_rounded,
                                color: t.danger, size: 18),
                        label: Text(
                          _saindo ? 'Saindo…' : 'Sair da conta',
                          style: TextStyle(
                            color: t.danger,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: t.dangerSoft,
                          side: BorderSide(color: t.danger, width: 1),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppRadius.md),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _CardIdentidade extends StatelessWidget {
  final UsuarioLogado? usuario;
  final String papel;
  final int totalOcorrencias;
  final int totalEquipe;

  const _CardIdentidade({
    required this.usuario,
    required this.papel,
    required this.totalOcorrencias,
    required this.totalEquipe,
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
        children: [
          UserAvatar(
            nome: usuario?.nome ?? '?',
            fotoUrl: usuario?.fotoUrl,
            size: 84,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            usuario?.nome ?? '—',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: t.text,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            usuario?.email ?? '',
            style: TextStyle(fontSize: 12, color: t.textMuted),
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: t.primarySoft,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: t.primary.withValues(alpha: 0.3)),
            ),
            child: Text(
              papel,
              style: TextStyle(
                fontSize: 12,
                color: t.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: _StatBox(
                  label: 'Ocorrências',
                  valor: totalOcorrencias.toString(),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _StatBox(
                  label: 'Equipe',
                  valor: totalEquipe.toString(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label;
  final String valor;
  const _StatBox({required this.label, required this.valor});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: t.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: t.borderSoft),
      ),
      child: Column(
        children: [
          Text(
            valor,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: t.primary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              color: t.textMuted,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _CardSecao extends StatelessWidget {
  final String titulo;
  final Widget child;
  const _CardSecao({required this.titulo, required this.child});

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
          Text(
            titulo,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: t.text,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _Campo extends StatelessWidget {
  final String label;
  final Widget child;
  const _Campo({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: t.textMuted,
          ),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}
