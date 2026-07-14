int _toInt(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

/// A single FAQ entry from GET /api/faqs (public, pre-sorted by the server).
class Faq {
  const Faq({
    required this.id,
    required this.question,
    required this.answer,
    this.sortOrder = 0,
  });

  final String id;
  final String question;
  final String answer;
  final int sortOrder;

  factory Faq.fromJson(Map<String, dynamic> j) => Faq(
        id: (j['id'] ?? '').toString(),
        question: (j['question'] ?? '').toString(),
        answer: (j['answer'] ?? '').toString(),
        sortOrder: _toInt(j['sort_order']),
      );
}
