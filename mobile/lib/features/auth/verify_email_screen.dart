import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_controller.dart';

/// Email OTP verification. Shown after email/password signup (and reachable from
/// checkout when an unverified account tries to order). The customer enters the
/// 6-digit code emailed by the backend; on success they're returned to where
/// they came from. Google/Facebook accounts never see this (already verified).
class VerifyEmailScreen extends ConsumerStatefulWidget {
  const VerifyEmailScreen({super.key, this.redirectTo = '/'});

  /// Where to go once verified (e.g. back to '/checkout').
  final String redirectTo;

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  final _otp = TextEditingController();
  bool _busy = false;
  int _cooldown = 0;
  Timer? _cooldownTimer;

  @override
  void dispose() {
    _otp.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _cooldown = 60);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _cooldown--);
      if (_cooldown <= 0) t.cancel();
    });
  }

  Future<void> _verify() async {
    final code = _otp.text.trim();
    if (code.length < 4) return;
    setState(() => _busy = true);
    final ok = await ref.read(authControllerProvider.notifier).verifyEmail(code);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Email verified — you\'re all set!')));
      context.go(widget.redirectTo);
    } else {
      final err = ref.read(authControllerProvider).error ?? 'Verification failed';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(err)));
    }
  }

  Future<void> _resend() async {
    setState(() => _busy = true);
    final ok = await ref.read(authControllerProvider.notifier).resendOtp();
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      _startCooldown();
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('A new code has been sent to your email.')));
    } else {
      final err = ref.read(authControllerProvider).error ?? 'Could not resend';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(err)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = ref.watch(authControllerProvider).customer?.email ?? '';
    return Scaffold(
      appBar: AppBar(title: const Text('Verify your email')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Icon(Icons.mark_email_read_outlined, size: 56),
          const SizedBox(height: 16),
          Text(
            email.isEmpty
                ? 'Enter the 6-digit code we emailed you.'
                : 'Enter the 6-digit code we emailed to $email.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _otp,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: const TextStyle(
                fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 8),
            decoration: const InputDecoration(
              counterText: '',
              hintText: '••••••',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) {
              if (v.length == 6 && !_busy) _verify();
            },
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _verify,
            child: _busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Verify'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: (_busy || _cooldown > 0) ? null : _resend,
            child: Text(_cooldown > 0
                ? 'Resend code in ${_cooldown}s'
                : 'Resend code'),
          ),
          TextButton(
            onPressed: () => context.go('/'),
            child: const Text('Verify later'),
          ),
        ],
      ),
    );
  }
}
