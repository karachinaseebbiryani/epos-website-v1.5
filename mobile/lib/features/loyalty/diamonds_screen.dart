import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'loyalty_models.dart';
import 'loyalty_repository.dart';

class DiamondsScreen extends ConsumerWidget {
  const DiamondsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balanceAsync = ref.watch(loyaltyBalanceProvider);
    final txAsync = ref.watch(loyaltyTransactionsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Diamonds')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(loyaltyBalanceProvider);
          ref.invalidate(loyaltyTransactionsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            balanceAsync.when(
              loading: () => const SizedBox(
                  height: 120, child: Center(child: CircularProgressIndicator())),
              error: (e, _) => _ErrorBox(
                message: '$e',
                onRetry: () => ref.invalidate(loyaltyBalanceProvider),
              ),
              data: (b) => _BalanceCard(balance: b),
            ),
            const SizedBox(height: 20),
            Text('History', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            txAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => _ErrorBox(
                message: '$e',
                onRetry: () => ref.invalidate(loyaltyTransactionsProvider),
              ),
              data: (txns) {
                if (txns.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text('No diamond activity yet')),
                  );
                }
                return Column(
                  children: [for (final t in txns) _TxTile(tx: t)],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance});
  final LoyaltyBalance balance;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.primaryContainer,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Text('Balance',
                style: TextStyle(color: scheme.onPrimaryContainer)),
            const SizedBox(height: 4),
            Text('${balance.diamondBalance} 💎',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                    color: scheme.onPrimaryContainer,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _Stat(label: 'Earned', value: balance.lifetimeEarned),
                _Stat(label: 'Spent', value: balance.lifetimeSpent),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Text('$value',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        Text(label, style: TextStyle(color: scheme.onPrimaryContainer)),
      ],
    );
  }
}

class _TxTile extends StatelessWidget {
  const _TxTile({required this.tx});
  final LoyaltyTransaction tx;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = tx.isCredit ? scheme.primary : scheme.error;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
          tx.isCredit ? Icons.add_circle_outline : Icons.remove_circle_outline,
          color: color),
      title: Text(tx.notes.isNotEmpty ? tx.notes : tx.type),
      subtitle: tx.createdAt.isEmpty ? null : Text(_shortDate(tx.createdAt)),
      trailing: Text('${tx.isCredit ? '+' : ''}${tx.diamonds} 💎',
          style: TextStyle(fontWeight: FontWeight.w700, color: color)),
    );
  }

  static String _shortDate(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    final l = d.toLocal();
    final mm = l.month.toString().padLeft(2, '0');
    final dd = l.day.toString().padLeft(2, '0');
    return '$dd/$mm/${l.year}';
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
