import 'package:flutter/material.dart';
import '../main.dart';
import '../app_colors.dart';
import '../config/api_config.dart';
import '../services/api_service.dart';
import '../widgets/agrolink_logo.dart';

class TelaCadastro extends StatefulWidget {
  const TelaCadastro({super.key});

  @override
  State<TelaCadastro> createState() => _TelaCadastroState();
}

class _TelaCadastroState extends State<TelaCadastro> {
  UserProfile _selectedProfile = UserProfile.produtor;
  bool _obscurePassword = true;
  bool _obscureConfirm  = true;
  bool _geolocalizacao  = false;
  bool _alertas         = false;
  bool _isLoading       = false;

  final _nomeController      = TextEditingController();
  final _emailController     = TextEditingController();
  final _senhaController     = TextEditingController();
  final _confirmarController = TextEditingController();
  final _fazendaController   = TextEditingController();
  final _telefoneController  = TextEditingController();

  @override
  void dispose() {
    _nomeController.dispose();
    _emailController.dispose();
    _senhaController.dispose();
    _confirmarController.dispose();
    _fazendaController.dispose();
    _telefoneController.dispose();
    super.dispose();
  }

  void _voltarLogin() => Navigator.pop(context);

  // ── Validação local ───────────────────────────────────────────────────────
  String? _validarCampos() {
    final nome  = _nomeController.text.trim();
    final email = _emailController.text.trim();
    final senha = _senhaController.text;
    final conf  = _confirmarController.text;

    if (nome.isEmpty)  return 'Informe seu nome completo.';
    if (email.isEmpty) return 'Informe seu e-mail.';

    final emailRegex = RegExp(r'^[\w\.-]+@[\w\.-]+\.\w{2,}$');
    if (!emailRegex.hasMatch(email)) return 'E-mail inválido.';

    if (senha.length < 6) return 'A senha deve ter ao menos 6 caracteres.';
    if (senha != conf)    return 'As senhas não coincidem.';

    return null;
  }

  // ── Integração com o back-end ─────────────────────────────────────────────
  Future<void> _finalizarCadastro() async {
    final erro = _validarCampos();
    if (erro != null) {
      _mostrarSnack(erro, isError: true);
      return;
    }

    setState(() => _isLoading = true);

    try {
      await ApiService.register(
        nome: _nomeController.text.trim(),
        email: _emailController.text.trim(),
        password: _senhaController.text,
        papel: papelParaCadastro(_selectedProfile),
      );

      if (!mounted) return;

      _mostrarSnack('Conta criada com sucesso!');

      await Future.delayed(const Duration(milliseconds: 800));
      if (!mounted) return;

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const TelaPrincipal()),
        (route) => false,
      );
    } on ApiException catch (e) {
      _mostrarSnack(e.mensagem, isError: true);
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('Failed to fetch') ||
          msg.contains('Connection refused') ||
          msg.contains('SocketException')) {
        _mostrarSnack(
          'Não foi possível conectar à API em $kApiBaseUrl.\n'
          'Suba o back-end (npm run dev:api) e tente de novo.',
          isError: true,
        );
      } else {
        _mostrarSnack(
          msg.replaceAll('Exception: ', '').replaceAll('ClientException: ', ''),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Snackbar de feedback ──────────────────────────────────────────────────
  void _mostrarSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: isError ? Colors.red.shade700 : AppColors.green,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 4),
        ),
      );
  }

  // ── Helpers de UI (idênticos ao original) ────────────────────────────────
  Widget _fieldLabel(String label, IconData icon, {String? badge}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.darkText),
          const SizedBox(width: 6),
          Text(label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.darkText,
              )),
          if (badge != null) ...[
            const Spacer(),
            Text(badge,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textGrey,
                  letterSpacing: 0.5,
                )),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ────────────────────────────────────────
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: _voltarLogin,
                    child: const Icon(Icons.chevron_left,
                        size: 28, color: AppColors.darkText),
                  ),
                  const Spacer(),
                  const AgrolinkLogo(size: 28),
                  const SizedBox(width: 8),
                  const Text('Agrolink',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.darkText,
                        letterSpacing: 0.3,
                      )),
                  const Spacer(),
                  const SizedBox(width: 28),
                ],
              ),
            ),

            const Divider(height: 1, color: Color(0xFFEEEEEE)),

            // ── Corpo ──────────────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 24),

                    const Text('Criar Conta',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          color: AppColors.darkText,
                        )),
                    const SizedBox(height: 6),
                    const Text(
                      'Junte-se à maior rede de gestão agrícola conectada.',
                      style:
                          TextStyle(fontSize: 13, color: AppColors.textGrey),
                    ),

                    const SizedBox(height: 24),

                    _fieldLabel('Nome Completo', Icons.person_outline),
                    _OutlineField(
                        controller: _nomeController,
                        hint: 'Ex: João Silva'),

                    const SizedBox(height: 18),

                    _fieldLabel('E-mail', Icons.mail_outline),
                    _OutlineField(
                      controller: _emailController,
                      hint: 'seu@email.com',
                      keyboardType: TextInputType.emailAddress,
                    ),

                    const SizedBox(height: 18),

                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _fieldLabel('Senha', Icons.lock_outline),
                              _OutlineField(
                                controller: _senhaController,
                                hint: '••••••••',
                                obscureText: _obscurePassword,
                                suffixIcon: GestureDetector(
                                  onTap: () => setState(() =>
                                      _obscurePassword = !_obscurePassword),
                                  child: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    color: AppColors.textGrey,
                                    size: 18,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _fieldLabel('Confirmar', Icons.shield_outlined),
                              _OutlineField(
                                controller: _confirmarController,
                                hint: '••••••••',
                                obscureText: _obscureConfirm,
                                suffixIcon: GestureDetector(
                                  onTap: () => setState(() =>
                                      _obscureConfirm = !_obscureConfirm),
                                  child: Icon(
                                    _obscureConfirm
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    color: AppColors.textGrey,
                                    size: 18,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),

                    const Text('Perfil de Acesso',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.darkText,
                        )),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _ProfileTab(
                          label: 'Produtor',
                          icon: Icons.agriculture_outlined,
                          isSelected:
                              _selectedProfile == UserProfile.produtor,
                          onTap: () => setState(
                              () => _selectedProfile = UserProfile.produtor),
                        ),
                        const SizedBox(width: 8),
                        _ProfileTab(
                          label: 'Gerente',
                          icon: Icons.security_outlined,
                          isSelected:
                              _selectedProfile == UserProfile.gerente,
                          onTap: () => setState(
                              () => _selectedProfile = UserProfile.gerente),
                        ),
                        const SizedBox(width: 8),
                        _ProfileTab(
                          label: 'Funcionário',
                          icon: Icons.person_outline,
                          isSelected:
                              _selectedProfile == UserProfile.funcionario,
                          onTap: () => setState(() =>
                              _selectedProfile = UserProfile.funcionario),
                        ),
                      ],
                    ),

                  

                    const SizedBox(height: 22),

                    Row(
                      children: const [
                        Icon(Icons.info_outline,
                            size: 14, color: AppColors.green),
                        SizedBox(width: 6),
                        Text(
                          'PRIVACIDADE E PERMISSÕES',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.green,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    _PermissionTile(
                      icon: Icons.location_on_outlined,
                      title: 'Geolocalização Ativa',
                      subtitle:
                          'Utilizamos o GPS para marcar a posição exata das ocorrências em campo, mesmo sem sinal de internet.',
                      value: _geolocalizacao,
                      onChanged: (v) => setState(() => _geolocalizacao = v),
                    ),

                    const SizedBox(height: 10),

                    _PermissionTile(
                      icon: Icons.notifications_outlined,
                      title: 'Alertas de Notificação',
                      subtitle:
                          'Receba avisos em tempo real sobre atualizações de status e mensagens urgentes da sua equipe.',
                      value: _alertas,
                      onChanged: (v) => setState(() => _alertas = v),
                    ),

                    const SizedBox(height: 28),

                    // ── Botão Finalizar com loading ───────────────────────
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _finalizarCadastro,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.green,
                          disabledBackgroundColor:
                              AppColors.green.withOpacity(0.65),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2.5,
                                ),
                              )
                            : const Text(
                                'Finalizar Cadastro',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),

                    const SizedBox(height: 14),

                    Center(
                      child: GestureDetector(
                        onTap: _isLoading ? null : _voltarLogin,
                        child: const Text(
                          'Voltar ao Login',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: AppColors.darkText,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 28),

                    Center(
                      child: RichText(
                        textAlign: TextAlign.center,
                        text: const TextSpan(
                          style: TextStyle(
                              fontSize: 12, color: AppColors.textGrey),
                          children: [
                            TextSpan(
                                text:
                                    'Ao cadastrar-se, você concorda com nossos '),
                            TextSpan(
                              text: 'Termos de Uso',
                              style: TextStyle(
                                color: AppColors.darkText,
                                fontWeight: FontWeight.w500,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                            TextSpan(text: ' e\n'),
                            TextSpan(
                              text: 'Política de Privacidade',
                              style: TextStyle(
                                color: AppColors.darkText,
                                fontWeight: FontWeight.w500,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                            TextSpan(text: '.'),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Widgets privados (idênticos ao original) ─────────────────────────────────

class _ProfileTab extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _ProfileTab({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.green : AppColors.bgGrey,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? AppColors.green : AppColors.borderGrey,
              width: 1.2,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon,
                  color: isSelected ? Colors.white : AppColors.textGrey,
                  size: 22),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight:
                      isSelected ? FontWeight.w700 : FontWeight.w400,
                  color: isSelected ? Colors.white : AppColors.textGrey,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PermissionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _PermissionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.bgGrey,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: AppColors.green),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.darkText,
                    )),
                const SizedBox(height: 4),
                Text(subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textGrey,
                      height: 1.4,
                    )),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: AppColors.green,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ],
      ),
    );
  }
}

class _OutlineField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final TextInputType? keyboardType;
  final bool obscureText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;

  const _OutlineField({
    required this.controller,
    required this.hint,
    this.keyboardType,
    this.obscureText = false,
    this.prefixIcon,
    this.suffixIcon,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      style: const TextStyle(fontSize: 14, color: AppColors.darkText),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle:
            const TextStyle(color: AppColors.textGrey, fontSize: 14),
        prefixIcon: prefixIcon != null
            ? Icon(prefixIcon, color: AppColors.textGrey, size: 20)
            : null,
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide:
              const BorderSide(color: AppColors.borderGrey, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide:
              const BorderSide(color: AppColors.green, width: 1.5),
        ),
      ),
    );
  }
}