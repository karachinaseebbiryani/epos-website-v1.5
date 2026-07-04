import 'package:flutter_test/flutter_test.dart';
import 'package:knb_customer/core/loading_controller.dart';

void main() {
  test('LoadingController ref-counts overlapping operations', () {
    final c = LoadingController();
    expect(c.isLoading, isFalse);

    c.start();
    c.start();
    expect(c.isLoading, isTrue);

    c.stop();
    expect(c.isLoading, isTrue, reason: 'still one op in flight');

    c.stop();
    expect(c.isLoading, isFalse);

    c.stop(); // underflow must not go negative
    expect(c.value, 0);
  });
}
