import 'package:in_app_review/in_app_review.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Wraps the Google Play in-app review flow.
///
/// Play policy notes honoured here:
///   * We do NOT pre-screen for happy customers — the prompt is offered after a
///     *completed* (delivered) order regardless of sentiment.
///   * The prompt is never shown during checkout, and at most once per order.
///   * `requestReview()` may show nothing (Play quota); we fall back to opening
///     the store listing only when the customer explicitly asks to rate.
class ReviewPrompt {
  ReviewPrompt._();

  static final InAppReview _inApp = InAppReview.instance;

  /// Marks that we've already offered a review for [orderId], so we never nag
  /// the same customer about the same order twice.
  static const _promptedPrefix = 'reviewed_prompt_';

  static Future<bool> _alreadyPrompted(String orderId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('$_promptedPrefix$orderId') ?? false;
  }

  static Future<void> _markPrompted(String orderId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_promptedPrefix$orderId', true);
  }

  /// Offer the Play in-app review once for a delivered [orderId]. Safe to call
  /// on every tracking-screen build — it self-gates on the persisted flag and
  /// on platform availability, and silently no-ops if anything is unavailable
  /// (e.g. emulator without Play Services).
  static Future<void> maybeRequest(String orderId) async {
    try {
      if (orderId.isEmpty) return;
      if (await _alreadyPrompted(orderId)) return;
      if (!await _inApp.isAvailable()) return;
      // Mark first: requestReview() gives no callback on whether the sheet
      // showed, and we must not risk a loop re-requesting on the next rebuild.
      await _markPrompted(orderId);
      await _inApp.requestReview();
    } catch (_) {
      // Never let a review prompt disrupt the order flow.
    }
  }

  /// Explicit "Rate us" action → open the Play Store listing.
  static Future<void> openStoreListing() async {
    try {
      await _inApp.openStoreListing();
    } catch (_) {}
  }
}
