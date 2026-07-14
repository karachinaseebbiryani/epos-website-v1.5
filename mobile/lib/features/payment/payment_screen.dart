import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import 'payment_models.dart';
import 'payment_repository.dart';

/// Manual-transfer payment screen shown after an order is placed with a bank /
/// Easypaisa / JazzCash method. Shows where to send the money, then collects a
/// transaction reference (required) and an optional proof screenshot.
class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({
    super.key,
    required this.orderId,
    required this.via,
    required this.trackToken,
  });

  /// Order to attach the payment to.
  final String orderId;

  /// One of `easypaisa`, `jazzcash`, `bank`.
  final String via;

  /// Per-order track token, forwarded to the tracking screen afterwards.
  final String trackToken;

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  final _reference = TextEditingController();
  final _payer = TextEditingController();
  String? _screenshotPath;
  bool _busy = false;

  @override
  void dispose() {
    _reference.dispose();
    _payer.dispose();
    super.dispose();
  }

  String get _title => switch (widget.via) {
        'easypaisa' => 'Easypaisa',
        'jazzcash' => 'JazzCash',
        _ => 'Bank transfer',
      };

  Future<void> _pickScreenshot() async {
    try {
      final picked = await ImagePicker()
          .pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (picked != null) setState(() => _screenshotPath = picked.path);
    } catch (_) {
      _snack('Could not open the gallery.');
    }
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  void _goToTracking() {
    context.go('/order/${widget.orderId}?t=${widget.trackToken}');
  }

  Future<void> _submit() async {
    final ref0 = _reference.text.trim();
    if (ref0.isEmpty) {
      _snack('Enter the transaction ID / reference.');
      return;
    }
    setState(() => _busy = true);
    try {
      final repo = ref.read(paymentRepositoryProvider);
      await repo.submitBankPayment(
        orderId: widget.orderId,
        via: widget.via,
        transactionId: ref0,
        payerName: _payer.text.trim(),
      );
      if (_screenshotPath != null) {
        try {
          await repo.uploadScreenshot(
              orderId: widget.orderId, filePath: _screenshotPath!);
        } catch (_) {
          // Reference already submitted; a failed screenshot shouldn't block.
          _snack('Reference saved, but the screenshot upload failed.');
        }
      }
      if (!mounted) return;
      _snack('Payment submitted — awaiting verification.');
      _goToTracking();
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not submit payment. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(paymentSettingsProvider);
    return Scaffold(
      appBar: AppBar(title: Text('Pay with $_title')),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _Body(
          via: widget.via,
          settings: null,
          reference: _reference,
          payer: _payer,
          screenshotPath: _screenshotPath,
          onPick: _pickScreenshot,
        ),
        data: (settings) => _Body(
          via: widget.via,
          settings: settings,
          reference: _reference,
          payer: _payer,
          screenshotPath: _screenshotPath,
          onPick: _pickScreenshot,
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: _busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('I have paid — submit reference'),
                ),
              ),
              TextButton(
                onPressed: _busy ? null : _goToTracking,
                child: const Text("I'll pay later — view order"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.via,
    required this.settings,
    required this.reference,
    required this.payer,
    required this.screenshotPath,
    required this.onPick,
  });

  final String via;
  final PublicPaymentSettings? settings;
  final TextEditingController reference;
  final TextEditingController payer;
  final String? screenshotPath;
  final VoidCallback onPick;

  List<_Field> _accountFields() {
    final s = settings;
    if (s == null) return const [];
    switch (via) {
      case 'easypaisa':
        return [
          _Field('Account title', s.easypaisaAccountTitle),
          _Field('Easypaisa number', s.easypaisaNumber),
        ];
      case 'jazzcash':
        return [
          _Field('Account title', s.jazzcashAccountTitle),
          _Field('JazzCash number', s.jazzcashNumber),
        ];
      default:
        return [
          _Field('Bank', s.bankName),
          _Field('Account title', s.bankAccountTitle),
          _Field('Account number', s.bankAccountNumber),
          _Field('IBAN', s.iban),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fields = _accountFields().where((f) => f.value.isNotEmpty).toList();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: scheme.surfaceContainerHighest,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Send your payment to',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                if (fields.isEmpty)
                  const Text('Payment account details are unavailable right '
                      'now. Please contact the restaurant.')
                else
                  ...fields.map((f) => _AccountRow(field: f)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        Text('Confirm your payment',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        TextField(
          controller: reference,
          maxLength: 60,
          decoration: const InputDecoration(
            labelText: 'Transaction ID / reference',
            border: OutlineInputBorder(),
            counterText: '',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: payer,
          maxLength: 60,
          decoration: const InputDecoration(
            labelText: 'Sender name (optional)',
            border: OutlineInputBorder(),
            counterText: '',
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: onPick,
          icon: const Icon(Icons.attach_file),
          label: Text(screenshotPath == null
              ? 'Attach payment screenshot (optional)'
              : 'Screenshot attached ✓'),
        ),
      ],
    );
  }
}

class _AccountRow extends StatelessWidget {
  const _AccountRow({required this.field});
  final _Field field;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(field.label,
                    style:
                        TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                Text(field.value,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.copy, size: 18),
            tooltip: 'Copy',
            onPressed: () {
              Clipboard.setData(ClipboardData(text: field.value));
              ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${field.label} copied')));
            },
          ),
        ],
      ),
    );
  }
}

class _Field {
  const _Field(this.label, this.value);
  final String label;
  final String value;
}
