import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Centralized Material 3 theme, matched to the customer website
/// (frontend/tailwind.config.js + index.css). Brand colours come from
/// [BrandColors]; fonts are Outfit (display/headings) + Manrope (body) to
/// mirror the site's `font-display` / `font-sans`.
class AppTheme {
  /// Kept for backward-compat; brand red now lives in [BrandColors.red].
  static const Color seed = BrandColors.red;

  static ThemeData light() => _base(Brightness.light);
  static ThemeData dark() => _base(Brightness.dark);

  static ThemeData _base(Brightness brightness) {
    final isLight = brightness == Brightness.light;
    // Anchor the generated palette on the website red, then pin the key roles to
    // the exact website hex so primary/secondary don't drift to a tonal shade.
    final scheme = ColorScheme.fromSeed(
      seedColor: BrandColors.red,
      brightness: brightness,
    ).copyWith(
      primary: BrandColors.red,
      onPrimary: Colors.white,
      secondary: BrandColors.yellow,
      onSecondary: BrandColors.ink,
      tertiary: BrandColors.yellow,
      error: BrandColors.destructive,
      surface: isLight ? Colors.white : null,
    );

    // Manrope body / Outfit display, layered onto the M3 text theme.
    final baseText = ThemeData(brightness: brightness).textTheme;
    final textTheme = GoogleFonts.manropeTextTheme(baseText).copyWith(
      displayLarge: GoogleFonts.outfit(textStyle: baseText.displayLarge, fontWeight: FontWeight.w900, letterSpacing: -0.5),
      displayMedium: GoogleFonts.outfit(textStyle: baseText.displayMedium, fontWeight: FontWeight.w900, letterSpacing: -0.5),
      displaySmall: GoogleFonts.outfit(textStyle: baseText.displaySmall, fontWeight: FontWeight.w800, letterSpacing: -0.3),
      headlineLarge: GoogleFonts.outfit(textStyle: baseText.headlineLarge, fontWeight: FontWeight.w800, letterSpacing: -0.3),
      headlineMedium: GoogleFonts.outfit(textStyle: baseText.headlineMedium, fontWeight: FontWeight.w800, letterSpacing: -0.3),
      headlineSmall: GoogleFonts.outfit(textStyle: baseText.headlineSmall, fontWeight: FontWeight.w800),
      titleLarge: GoogleFonts.outfit(textStyle: baseText.titleLarge, fontWeight: FontWeight.w700),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      textTheme: textTheme,
      scaffoldBackgroundColor: scheme.surface,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 2,
        titleTextStyle: GoogleFonts.outfit(
          textStyle: textTheme.titleLarge,
          fontWeight: FontWeight.w800,
          color: scheme.onSurface,
          fontSize: 20,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(BrandRadii.md),
        ),
      ),
      // Primary CTA = website's red pill: filled brand red, white, rounded-full,
      // bold. minimumSize height-only (Size(0,48)) — never infinite width, or a
      // FilledButton inside a Row crashes with unbounded-width constraints.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 50),
          backgroundColor: BrandColors.red,
          foregroundColor: Colors.white,
          textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w800, letterSpacing: 0.3),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(BrandRadii.pill),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(BrandRadii.pill),
          ),
        ),
      ),
      // NOTE: card styling intentionally omitted here — the `cardTheme` field's
      // type changed (CardTheme -> CardThemeData) across Flutter versions.
      // Style cards per-widget to stay version-agnostic.
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
