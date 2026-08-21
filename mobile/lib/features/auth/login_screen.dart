import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';

import '../../core/config.dart';

import 'auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    bool ok = false;
    try {
      ok = await ref
          .read(authControllerProvider.notifier)
          .login(_email.text.trim(), _password.text);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;
    if (!ok) {
      final err = ref.read(authControllerProvider).error ?? 'Login failed';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(err)));
    }
  }

  void _showMsg(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  Future<void> _google() async {
    if (AppConfig.googleServerClientId.isEmpty) {
      _showMsg("Google sign-in isn't set up yet.");
      return;
    }
    setState(() => _busy = true);
    try {
      final gsi = GoogleSignIn(
          serverClientId: AppConfig.googleServerClientId,
          scopes: const ['email']);
      final acct = await gsi.signIn();
      if (acct == null) return; // user cancelled
      final tokenAuth = await acct.authentication;
      final idToken = tokenAuth.idToken;
      if (idToken == null) {
        _showMsg('Could not get a Google token.');
        return;
      }
      final ok = await ref
          .read(authControllerProvider.notifier)
          .signInWithGoogle(idToken);
      if (!ok && mounted) {
        _showMsg(ref.read(authControllerProvider).error ?? 'Google sign-in failed');
      }
    } catch (e) {
      _showMsg('Google sign-in failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _facebook() async {
    // Inert until configured: the Facebook Android SDK has auto-init disabled and
    // the app id is a placeholder, so we only attempt a real login when a valid
    // FACEBOOK_APP_ID was supplied at build time.
    if (!AppConfig.facebookConfigured) {
      _showMsg('Facebook sign-in will be enabled once the app is configured.');
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await FacebookAuth.instance.login(permissions: const ['email']);
      if (result.status != LoginStatus.success || result.accessToken == null) {
        if (result.status != LoginStatus.cancelled) {
          _showMsg('Facebook sign-in failed.');
        }
        return;
      }
      final token = result.accessToken!.tokenString;
      final ok = await ref
          .read(authControllerProvider.notifier)
          .signInWithFacebook(token);
      if (!ok && mounted) {
        _showMsg(
            ref.read(authControllerProvider).error ?? 'Facebook sign-in failed');
      }
    } catch (_) {
      _showMsg('Facebook sign-in failed.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Karachi Naseeb',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 4),
                  Text('Sign in to order',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 32),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    maxLength: 100,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                    validator: (v) =>
                        (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    maxLength: 72,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                    validator: (v) =>
                        (v == null || v.length < 6) ? 'Min 6 characters' : null,
                  ),
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed:
                          _busy ? null : () => context.push('/forgot-password'),
                      child: const Text('Forgot password?'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Sign in'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _busy ? null : () => context.go('/register'),
                    child: const Text("New here? Create an account"),
                  ),
                  const SizedBox(height: 8),
                  Row(children: [
                    const Expanded(child: Divider()),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text('or',
                          style: Theme.of(context).textTheme.bodySmall),
                    ),
                    const Expanded(child: Divider()),
                  ]),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _google,
                    icon: const Icon(Icons.g_mobiledata, size: 28),
                    label: const Text('Continue with Google'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _facebook,
                    icon: const Icon(Icons.facebook),
                    label: const Text('Continue with Facebook'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
