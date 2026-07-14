import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import 'auth_controller.dart';

/// Two-step password reset: (1) enter email → backend emails a 6-digit code
/// (same generic response whether or not the account exists), (2) enter the
/// code + a new password. On success returns to sign-in.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _otp = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _codeSent = false;

  @override
  void dispose() {
    _email.dispose();
    _otp.dispose();
    _password.dispose();
    super.dispose();
  }

  void _snack(String msg) => ScaffoldMessenger.of(context)
    ..clearSnackBars()
    ..showSnackBar(SnackBar(content: Text(msg)));

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      _snack('Enter a valid email');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).forgotPassword(email);
      if (!mounted) return;
      setState(() => _codeSent = true);
      _snack('If an account exists for that email, a code has been sent.');
    } on ApiException catch (e) {
      if (mounted) _snack(e.message);
    } catch (_) {
      if (mounted) _snack('Could not send the code. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (_otp.text.trim().length < 4) {
      _snack('Enter the 6-digit code');
      return;
    }
    if (_password.text.length < 6) {
      _snack('Password must be at least 6 characters');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).resetPassword(
            email: _email.text.trim(),
            otp: _otp.text.trim(),
            newPassword: _password.text,
          );
      if (!mounted) return;
      _snack('Password updated — sign in with your new password.');
      context.go('/login');
    } on ApiException catch (e) {
      if (mounted) _snack(e.message);
    } catch (_) {
      if (mounted) _snack('Could not reset the password. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Icon(Icons.lock_reset, size: 56),
          const SizedBox(height: 16),
          Text(
            _codeSent
                ? 'Enter the code we emailed you and choose a new password.'
                : 'Enter your account email and we\'ll send you a reset code.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _email,
            enabled: !_codeSent,
            keyboardType: TextInputType.emailAddress,
            maxLength: 100,
            decoration: const InputDecoration(
              labelText: 'Email',
              border: OutlineInputBorder(),
              counterText: '',
            ),
          ),
          if (_codeSent) ...[
            const SizedBox(height: 16),
            TextField(
              controller: _otp,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(
                  fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 6),
              decoration: const InputDecoration(
                labelText: '6-digit code',
                counterText: '',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _password,
              obscureText: true,
              maxLength: 72,
              decoration: const InputDecoration(
                labelText: 'New password',
                border: OutlineInputBorder(),
                counterText: '',
              ),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : (_codeSent ? _reset : _sendCode),
            child: _busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Text(_codeSent ? 'Set new password' : 'Send code'),
          ),
          if (_codeSent)
            TextButton(
              onPressed: _busy ? null : _sendCode,
              child: const Text('Resend code'),
            ),
          TextButton(
            onPressed: _busy ? null : () => context.go('/login'),
            child: const Text('Back to sign in'),
          ),
        ],
      ),
    );
  }
}
