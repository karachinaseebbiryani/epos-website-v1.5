import 'package:flutter/material.dart';

/// Brand design tokens — the single source of truth for colours, radii and
/// spacing, mirrored 1:1 from the customer website so the app and site read as
/// one product.
///
/// Source of truth on the web:
///   frontend/tailwind.config.js  → colors.brand.*
///   frontend/src/index.css       → :root HSL CSS variables (shadcn theme)
///
/// Do NOT invent new brand colours here — if the website palette changes, update
/// these to match rather than eyeballing a new shade.
class BrandColors {
  BrandColors._();

  // --- Website `colors.brand` (exact hex) ---
  static const Color red = Color(0xFFD92D20); // primary  (--primary 4 79% 51%)
  static const Color redDark = Color(0xFFB91C1C); // primary hover / pressed
  static const Color yellow = Color(0xFFF59E0B); // secondary / accent
  static const Color yellowDark = Color(0xFFD97706);
  static const Color cream = Color(0xFFFFF7ED); // warm surface tint
  static const Color ink = Color(0xFF1F1A19); // near-black text / foreground

  // --- Neutrals derived from the website's shadcn HSL vars ---
  static const Color muted = Color(0xFFF5F5F5); // --muted 0 0% 96%
  static const Color mutedForeground = Color(0xFF585048); // --muted-foreground
  static const Color destructive = Color(0xFFCF1D1D); // --destructive 0 73% 47%
  static const Color border = Color(0x141F1A19); // ink @ 8% (rgba .08)

  // Badge colours used on product cards (match website `Badges`).
  static const Color discountBadge = Color(0xFF16A34A); // green-600 "{n}% OFF"
  static const Color bestsellerBadge = red; // red "Bestseller"
}

/// Radius scale — Tailwind `lg=1rem(16) md=12 sm=8`; cards use rounded-2xl (16),
/// pills/buttons use rounded-full.
class BrandRadii {
  BrandRadii._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double card = 16; // rounded-2xl
  static const double pill = 999;
}
