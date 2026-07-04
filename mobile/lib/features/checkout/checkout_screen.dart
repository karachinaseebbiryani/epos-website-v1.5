import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/format.dart';
import '../auth/auth_controller.dart';
import '../cart/cart_controller.dart';
import '../orders/order_repository.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _notes = TextEditingController();
  String _paymentMethod = 'cod';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    // Prefill from the signed-in customer.
    final c = ref.read(authControllerProvider).customer;
    if (c != null) {
      _name.text = c.name;
      _phone.text = c.phone;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    if (!_formKey.currentState!.validate()) return;
    final lines = ref.read(cartProvider);
    if (lines.isEmpty) return;
    setState(() => _busy = true);
    try {
      final order = await ref.read(orderRepositoryProvider).placeOrder(
            lines: lines,
            subtotal: ref.read(cartSubtotalProvider),
            customerName: _name.text.trim(),
            phone: _phone.text.trim(),
            address: _address.text.trim(),
            notes: _notes.text.trim(),
            paymentMethod: _paymentMethod,
          );
      ref.read(cartProvider.notifier).clear();
      if (!mounted) return;
      context.go('/order/${order.id}?t=${order.trackToken ?? ''}');
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final subtotal = ref.watch(cartSubtotalProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(
                  labelText: 'Name', border: OutlineInputBorder()),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                  labelText: 'Phone', border: OutlineInputBorder()),
              validator: (v) =>
                  (v == null || v.trim().length < 7) ? 'Enter your phone' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _address,
              maxLines: 2,
              decoration: const InputDecoration(
                  labelText: 'Delivery address', border: OutlineInputBorder()),
              validator: (v) =>
                  (v == null || v.trim().length < 6) ? 'Enter your address' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              decoration: const InputDecoration(
                  labelText: 'Notes (optional)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 20),
            Text('Payment method',
                style: Theme.of(context).textTheme.titleMedium),
            RadioGroup<String>(
              groupValue: _paymentMethod,
              onChanged: (v) => setState(() => _paymentMethod = v!),
              child: const Column(
                children: [
                  RadioListTile<String>(
                    value: 'cod',
                    title: Text('Cash on delivery'),
                    contentPadding: EdgeInsets.zero,
                  ),
                  RadioListTile<String>(
                    value: 'pay_at_restaurant',
                    title: Text('Pay at restaurant'),
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            ),
            const ListTile(
              enabled: false,
              contentPadding: EdgeInsets.zero,
              title: Text('JazzCash / Easypaisa / Wallet'),
              subtitle: Text('Coming soon'),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _busy ? null : _placeOrder,
            child: _busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Text('Place order · ${money(subtotal)}'),
          ),
        ),
      ),
    );
  }
}
