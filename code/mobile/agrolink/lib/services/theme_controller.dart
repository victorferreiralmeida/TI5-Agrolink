import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferência de tema persistida localmente (SharedPreferences).
class ThemeController extends ChangeNotifier {
  ThemeController._();

  static final ThemeController instance = ThemeController._();

  static const _key = 'dark_mode';

  ThemeMode _mode = ThemeMode.light;

  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _mode = prefs.getBool(_key) == true ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }

  Future<void> setDark(bool dark) async {
    final next = dark ? ThemeMode.dark : ThemeMode.light;
    if (_mode == next) return;
    _mode = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, dark);
    notifyListeners();
  }

  Future<void> toggle() => setDark(!isDark);
}
