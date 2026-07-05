import 'package:flutter/material.dart';
import '../main.dart';
import 'cadastro_screen.dart';
import '../app_colors.dart';
import '../services/api_service.dart';
import '../services/theme_controller.dart';
import '../widgets/agrolink_logo.dart';

class TelaLogin extends StatefulWidget {
  const TelaLogin({super.key});

  @override
  State<TelaLogin> createState() => _TelaLoginState();
}

class _TelaLoginState extends State<TelaLogin> {
  bool _obscurePassword = true;
  bool _isLoading = false;

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String? _validar() {
    final email = _emailController.text.trim();
    final senha = _passwordController.text;
    if (email.isEmpty) return 'Informe seu e-mail.';
    final emailRegex = RegExp(r'^[\w\.-]+@[\w\.-]+\.\w{2,}$');
    if (!emailRegex.hasMatch(email)) return 'E-mail inválido.';
    if (senha.isEmpty) return 'Informe sua senha.';
    return null;
  }

  Future<void> _entrar() async {
    final erro = _validar();
    if (erro != null) {
      _snack(erro, isError: true);
      return;
    }

    setState(() => _isLoading = true);

    try {
      await ApiService.login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const TelaPrincipal()),
      );
    } on ApiException catch (e) {
      _snack(e.mensagem, isError: true);
    } catch (_) {
      _snack('Não foi possível conectar ao servidor.', isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _irParaCadastro() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const TelaCadastro()),
    );
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red.shade700 : AppColors.green,
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 3),
      ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final textPrimary = theme.colorScheme.onSurface;
    final textSecondary = theme.colorScheme.onSurfaceVariant;
    final fieldFill = theme.colorScheme.surface;
    final fieldBorder = theme.dividerColor;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: const EdgeInsets.only(top: 12.0),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => ThemeController.instance.toggle(),
                      customBorder: const CircleBorder(),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: fieldBorder, width: 1.5),
                        ),
                        child: Icon(
                          isDark
                              ? Icons.light_mode_outlined
                              : Icons.dark_mode_outlined,
                          size: 20,
                          color: textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              const AgrolinkLogo(size: 80),

              const SizedBox(height: 16),

              Text(
                'Agrolink',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: textPrimary,
                  letterSpacing: 0.5,
                ),
              ),

              const SizedBox(height: 6),

              Text(
                'Conectando a gestão rural à realidade do dia a dia.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: textSecondary),
              ),

              const SizedBox(height: 32),

              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'E-mail',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: textPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              _OutlineField(
                controller: _emailController,
                hint: 'exemplo@fazenda.com',
                keyboardType: TextInputType.emailAddress,
                prefixIcon: Icons.mail_outline,
                fillColor: fieldFill,
                textColor: textPrimary,
                hintColor: textSecondary,
                borderColor: fieldBorder,
              ),

              const SizedBox(height: 16),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Senha',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: textPrimary,
                    ),
                  ),
                  GestureDetector(
                    onTap: () {},
                    child: const Text(
                      'Esqueci a senha',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.linkText,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _OutlineField(
                controller: _passwordController,
                hint: '••••••••',
                obscureText: _obscurePassword,
                prefixIcon: Icons.lock_outline,
                fillColor: fieldFill,
                textColor: textPrimary,
                hintColor: textSecondary,
                borderColor: fieldBorder,
                suffixIcon: GestureDetector(
                  onTap: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                  child: Icon(
                    _obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    color: textSecondary,
                    size: 20,
                  ),
                ),
              ),

              const SizedBox(height: 28),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _entrar,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.green,
                    disabledBackgroundColor: AppColors.green.withValues(alpha: 0.65),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2.5),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Text(
                              'Entrar',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                            SizedBox(width: 8),
                            Icon(Icons.arrow_forward,
                                color: Colors.white, size: 18),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 20),

              Row(
                children: [
                  Expanded(child: Divider(color: fieldBorder)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('ou',
                        style: TextStyle(color: textSecondary, fontSize: 13)),
                  ),
                  Expanded(child: Divider(color: fieldBorder)),
                ],
              ),

              const SizedBox(height: 20),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton(
                  onPressed: _isLoading ? null : _irParaCadastro,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.green, width: 1.5),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Criar nova conta',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.green,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: TextStyle(fontSize: 12, color: textSecondary),
                  children: [
                    const TextSpan(text: 'Ao entrar, você concorda com nossos\n'),
                    TextSpan(
                      text: 'Termos de Uso',
                      style: TextStyle(
                        color: textPrimary,
                        fontWeight: FontWeight.w500,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                    const TextSpan(text: ' e '),
                    TextSpan(
                      text: 'Privacidade',
                      style: TextStyle(
                        color: textPrimary,
                        fontWeight: FontWeight.w500,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                    const TextSpan(text: '.'),
                  ],
                ),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
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
  final Color fillColor;
  final Color textColor;
  final Color hintColor;
  final Color borderColor;

  const _OutlineField({
    required this.controller,
    required this.hint,
    this.keyboardType,
    this.obscureText = false,
    this.prefixIcon,
    this.suffixIcon,
    required this.fillColor,
    required this.textColor,
    required this.hintColor,
    required this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      style: TextStyle(fontSize: 14, color: textColor),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: hintColor, fontSize: 14),
        prefixIcon: prefixIcon != null
            ? Icon(prefixIcon, color: hintColor, size: 20)
            : null,
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: fillColor,
        contentPadding:
            const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: borderColor, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.green, width: 1.5),
        ),
      ),
    );
  }
}
