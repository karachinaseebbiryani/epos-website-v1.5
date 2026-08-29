import 'dart:async';

import 'package:flutter/material.dart';

import '../offers_models.dart';

/// Live countdown for a limited-time offer. Ticks every second off the offer's
/// server-clock-based [Offer.timeLeft], so a customer can't extend a deal by
/// changing their device clock. Shows "Expired" once elapsed. Renders nothing
/// for offers with no expiry.
class OfferCountdown extends StatefulWidget {
  const OfferCountdown({super.key, required this.offer, this.onLight = false});

  final Offer offer;

  /// True when placed on a dark/coloured card (uses light text).
  final bool onLight;

  @override
  State<OfferCountdown> createState() => _OfferCountdownState();
}

class _OfferCountdownState extends State<OfferCountdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (widget.offer.hasExpiry) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _fmt(Duration d) {
    if (d.isNegative) return 'Expired';
    final days = d.inDays;
    final h = d.inHours % 24;
    final m = d.inMinutes % 60;
    final s = d.inSeconds % 60;
    if (days > 0) return '${days}d ${h}h left';
    // Show seconds for anything under 24 hours
    if (h > 0) return '${h}h ${m}m ${s}s left';
    return '${m}m ${s}s left';
  }

  @override
  Widget build(BuildContext context) {
    final left = widget.offer.timeLeft;
    if (left == null) return const SizedBox.shrink();
    final expired = left.isNegative;
    final color = widget.onLight
        ? Colors.white
        : (expired ? Theme.of(context).colorScheme.error : Theme.of(context).colorScheme.onSurface);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(expired ? Icons.timer_off : Icons.timer,
            size: 12, color: color.withValues(alpha: 0.9)),
        const SizedBox(width: 4),
        Text(
          _fmt(left),
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
