import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'faq_repository.dart';

class FaqScreen extends ConsumerWidget {
  const FaqScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final faqsAsync = ref.watch(faqProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('FAQs')),
      body: faqsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48),
              const SizedBox(height: 12),
              Text('$e', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => ref.invalidate(faqProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (faqs) {
          if (faqs.isEmpty) {
            return const Center(child: Text('No FAQs available yet'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(faqProvider),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: faqs.length,
              itemBuilder: (context, i) {
                final f = faqs[i];
                return ExpansionTile(
                  title: Text(f.question,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  childrenPadding:
                      const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  expandedCrossAxisAlignment: CrossAxisAlignment.start,
                  children: [Text(f.answer)],
                );
              },
            ),
          );
        },
      ),
    );
  }
}
