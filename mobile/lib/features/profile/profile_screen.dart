import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme_controller.dart';
import '../auth/auth_controller.dart';
import 'profile_repository.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customer = ref.watch(authControllerProvider).customer;
    final mode = ref.watch(themeModeControllerProvider);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: scheme.surfaceContainerHighest,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: scheme.primary,
                    child: Text(
                      _initial(customer?.name),
                      style: TextStyle(
                          color: scheme.onPrimary,
                          fontSize: 22,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (customer?.name.isNotEmpty ?? false)
                              ? customer!.name
                              : 'Guest',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        if (customer?.email.isNotEmpty ?? false)
                          Text(customer!.email,
                              style: TextStyle(color: scheme.onSurfaceVariant)),
                        if (customer?.phone.isNotEmpty ?? false)
                          Text(customer!.phone,
                              style: TextStyle(color: scheme.onSurfaceVariant)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Appearance', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SegmentedButton<ThemeMode>(
            segments: const [
              ButtonSegment(
                  value: ThemeMode.system,
                  icon: Icon(Icons.brightness_auto),
                  label: Text('System')),
              ButtonSegment(
                  value: ThemeMode.light,
                  icon: Icon(Icons.light_mode),
                  label: Text('Light')),
              ButtonSegment(
                  value: ThemeMode.dark,
                  icon: Icon(Icons.dark_mode),
                  label: Text('Dark')),
            ],
            selected: {mode},
            onSelectionChanged: (s) =>
                ref.read(themeModeControllerProvider.notifier).set(s.first),
          ),
          const SizedBox(height: 20),
          const _AllergensSection(),
          const SizedBox(height: 20),
          Text('More', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          _NavTile(
              icon: Icons.receipt_long,
              label: 'My Orders',
              onTap: () => context.push('/orders')),
          _NavTile(
              icon: Icons.diamond_outlined,
              label: 'My Diamonds',
              onTap: () => context.push('/diamonds')),
          _NavTile(
              icon: Icons.local_offer_outlined,
              label: 'Offers & Coupons',
              onTap: () => context.push('/offers')),
          _NavTile(
              icon: Icons.help_outline,
              label: 'FAQs',
              onTap: () => context.push('/faqs')),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () =>
                ref.read(authControllerProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
            style: OutlinedButton.styleFrom(
              foregroundColor: scheme.error,
              side: BorderSide(color: scheme.error),
            ),
          ),
        ],
      ),
    );
  }

  static String _initial(String? name) {
    final n = (name ?? '').trim();
    return n.isEmpty ? '?' : n[0].toUpperCase();
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile(
      {required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(label),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}

/// Saved allergen profile. Loads the customer's allergens, lets them toggle
/// common ones (plus a free-text add), and saves via PUT /customer/allergens.
/// The saved list is auto-filled into the checkout note so the kitchen sees it.
class _AllergensSection extends ConsumerStatefulWidget {
  const _AllergensSection();

  @override
  ConsumerState<_AllergensSection> createState() => _AllergensSectionState();
}

class _AllergensSectionState extends ConsumerState<_AllergensSection> {
  final Set<String> _selected = {};
  final _customCtrl = TextEditingController();
  bool _loaded = false;
  bool _saving = false;

  @override
  void dispose() {
    _customCtrl.dispose();
    super.dispose();
  }

  void _toggle(String a) {
    setState(() {
      if (_selected.contains(a)) {
        _selected.remove(a);
      } else {
        _selected.add(a);
      }
    });
  }

  void _addCustom() {
    final v = _customCtrl.text.trim();
    if (v.isEmpty) return;
    setState(() {
      _selected.add(v);
      _customCtrl.clear();
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final saved = await ref
          .read(profileRepositoryProvider)
          .saveAllergens(_selected.toList());
      ref.invalidate(allergensProvider);
      if (!mounted) return;
      setState(() => _selected
        ..clear()
        ..addAll(saved));
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Allergies saved')));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save. Please try again.')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(allergensProvider);
    // Hydrate the local selection once from the loaded list.
    async.whenData((list) {
      if (!_loaded) {
        _loaded = true;
        _selected.addAll(list);
      }
    });

    final custom = _selected.where((a) => !commonAllergens.contains(a)).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Allergies & dietary',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('We add these to your order note so the kitchen is aware.',
            style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 8),
        if (async.isLoading && !_loaded)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: LinearProgressIndicator(),
          ),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final a in commonAllergens)
              FilterChip(
                label: Text(a),
                selected: _selected.contains(a),
                onSelected: (_) => _toggle(a),
              ),
            for (final a in custom)
              InputChip(
                label: Text(a),
                onDeleted: () => _toggle(a),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _customCtrl,
                maxLength: 30,
                decoration: const InputDecoration(
                  labelText: 'Add another allergy',
                  isDense: true,
                  border: OutlineInputBorder(),
                  counterText: '',
                ),
                onSubmitted: (_) => _addCustom(),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              onPressed: _addCustom,
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save allergies'),
          ),
        ),
      ],
    );
  }
}
