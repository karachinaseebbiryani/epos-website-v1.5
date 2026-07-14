import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/tokens.dart';
import 'loyalty_models.dart';
import 'loyalty_repository.dart';

class DiamondsScreen extends ConsumerWidget {
  const DiamondsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balanceAsync = ref.watch(loyaltyBalanceProvider);
    final txAsync = ref.watch(loyaltyTransactionsProvider);
    final rewardsAsync = ref.watch(loyaltyRewardsProvider);
    final balance = balanceAsync.asData?.value.diamondBalance ?? 0;
    return Scaffold(
      appBar: AppBar(title: const Text('My Diamonds')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(loyaltyBalanceProvider);
          ref.invalidate(loyaltyTransactionsProvider);
          ref.invalidate(loyaltyRewardsProvider);
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
            // Rewards catalog — what diamonds can actually be spent on.
            Text('Spend your diamonds',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            rewardsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => _ErrorBox(
                message: '$e',
                onRetry: () => ref.invalidate(loyaltyRewardsProvider),
              ),
              data: (rewards) => rewards.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(
                          child: Text('No rewards available right now')),
                    )
                  : Column(
                      children: [
                        for (final r in rewards)
                          _RewardCard(reward: r, balance: balance),
                      ],
                    ),
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

/// One redeemable reward. "Use" stages it for the next order (applied at
/// checkout; the BACKEND deducts diamonds + recomputes the price — the app
/// never does the math). Unaffordable rewards are dimmed with "Need N more".
class _RewardCard extends ConsumerWidget {
  const _RewardCard({required this.reward, required this.balance});
  final LoyaltyReward reward;
  final int balance;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final affordable = balance >= reward.costDiamonds;
    final selected = ref.watch(selectedRewardProvider)?.id == reward.id;
    final icon = switch (reward.rewardType) {
      'discount_percent' => Icons.percent,
      'discount_fixed' => Icons.local_offer,
      _ => Icons.card_giftcard,
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
            color: selected ? BrandColors.yellowDark : scheme.outlineVariant,
            width: selected ? 2 : 1),
      ),
      child: Opacity(
        opacity: affordable ? 1 : 0.55,
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          leading: CircleAvatar(
            backgroundColor: BrandColors.yellow.withValues(alpha: 0.25),
            child: Icon(icon, color: BrandColors.yellowDark),
          ),
          title: Text(reward.title,
              style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(reward.benefitLabel,
                  style: const TextStyle(
                      color: BrandColors.red, fontWeight: FontWeight.w700)),
              Text('${reward.costDiamonds} 💎'
                  '${affordable ? '' : ' — need ${reward.costDiamonds - balance} more'}'),
            ],
          ),
          trailing: selected
              ? TextButton(
                  onPressed: () =>
                      ref.read(selectedRewardProvider.notifier).state = null,
                  child: const Text('Remove'),
                )
              : FilledButton(
                  onPressed: !affordable
                      ? null
                      : () {
                          ref.read(selectedRewardProvider.notifier).state =
                              reward;
                          ScaffoldMessenger.of(context)
                            ..clearSnackBars()
                            ..showSnackBar(SnackBar(
                              content: Text(
                                  '${reward.benefitLabel} will apply at checkout'),
                              action: SnackBarAction(
                                label: 'Order now',
                                onPressed: () => context.go('/'),
                              ),
                            ));
                        },
                  style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 16)),
                  child: const Text('Use'),
                ),
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
