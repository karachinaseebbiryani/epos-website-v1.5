import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../app/tokens.dart';
import 'config.dart';

/// Resolve a product image URL to an absolute, loadable URL — a 1:1 port of the
/// website's `resolveImageUrl` (frontend/src/lib/api.js) so the app loads images
/// from the exact same approved origin the site uses:
///   `${API_BASE}/api/uploads/{kind}/<sha16>.<ext>`
///
/// Rules (match the web):
///   * empty / null            → '' (render the placeholder, no network request)
///   * data: / blob:           → returned unchanged (legacy inline images)
///   * absolute http(s)://      → returned unchanged
///   * starts with '/api/…'    → prefixed with the backend origin
///   * any other relative path → prefixed with the backend origin
String resolveImageUrl(String? url) {
  final u = (url ?? '').trim();
  if (u.isEmpty) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('/')) return '${AppConfig.apiBaseUrl}$u';
  return '${AppConfig.apiBaseUrl}/$u';
}

/// A product image that mirrors the website: cached network load from the
/// approved origin, with a brand-gradient placeholder for missing/failed images
/// (the site uses `from-brand-yellow/30 to-brand-red/20`).
class ProductImage extends StatelessWidget {
  const ProductImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.iconSize = 24,
  });

  final String imageUrl;
  final BoxFit fit;
  final double iconSize;

  Widget _placeholder() => DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0x4DF59E0B), Color(0x33D92D20)], // yellow/30 → red/20
          ),
        ),
        child: Center(
          child: Icon(Icons.restaurant,
              size: iconSize, color: BrandColors.red.withValues(alpha: 0.55)),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final resolved = resolveImageUrl(imageUrl);
    if (resolved.isEmpty) return _placeholder();
    return CachedNetworkImage(
      imageUrl: resolved,
      fit: fit,
      placeholder: (_, __) => _placeholder(),
      errorWidget: (_, __, ___) => _placeholder(),
    );
  }
}
