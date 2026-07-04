import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A list bound to an AsyncValue that:
///  - shows a spinner on first load,
///  - shows a retry view on error,
///  - shows an empty-state when the list is empty,
///  - and supports pull-to-refresh in *every* state (even empty/error), by
///    always wrapping the body in a scrollable + RefreshIndicator.
///
/// [onRefresh] should invalidate/refresh the provider feeding [value].
class AsyncListView<T> extends StatelessWidget {
  const AsyncListView({
    super.key,
    required this.value,
    required this.itemBuilder,
    required this.onRefresh,
    this.emptyMessage = 'Nothing here yet',
    this.padding = const EdgeInsets.all(16),
    this.separator,
  });

  final AsyncValue<List<T>> value;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final Future<void> Function() onRefresh;
  final String emptyMessage;
  final EdgeInsets padding;
  final Widget? separator;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: value.when(
        loading: () => const _CenteredScrollable(
          child: Padding(
            padding: EdgeInsets.only(top: 80),
            child: CircularProgressIndicator(),
          ),
        ),
        error: (err, _) => _CenteredScrollable(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48),
                const SizedBox(height: 12),
                Text('$err', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: onRefresh,
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return _CenteredScrollable(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Text(emptyMessage, textAlign: TextAlign.center),
              ),
            );
          }
          return ListView.separated(
            padding: padding,
            physics: const AlwaysScrollableScrollPhysics(),
            itemCount: items.length,
            separatorBuilder: (_, __) =>
                separator ?? const SizedBox(height: 12),
            itemBuilder: (context, i) => itemBuilder(context, items[i], i),
          );
        },
      ),
    );
  }
}

/// Ensures the child is scrollable (so RefreshIndicator can be pulled) even
/// when there isn't enough content to scroll.
class _CenteredScrollable extends StatelessWidget {
  const _CenteredScrollable({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(child: child),
        ),
      ),
    );
  }
}
