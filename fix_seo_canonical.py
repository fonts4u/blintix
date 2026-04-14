"""
Fix SEO canonical URLs in all blog posts.
Vercel cleanUrls:true + trailingSlash:true means:
  /blog/best-free-tools-2026.html -> /blog/best-free-tools-2026/
So canonical and og:url must use the clean URL (no .html, with trailing slash).
Also fixes sitemap-main.xml blog URLs to match.
"""

import os
import re

BASE_URL = "https://blintix.store"
BLOG_DIR = os.path.dirname(os.path.abspath(__file__)) + "\\blog"

# Map of old URL pattern -> new clean URL
SLUGS = [
    "best-free-tools-2026",
    "convert-website-to-zip",
    "copy-ui-without-coding",
    "design-to-figma",
    "download-assets-guide",
    "download-lottie-animations",
    "extract-color-palette",
    "extract-css-guide",
    "hidden-developer-tools",
    "inspect-code-without-devtools",
]

def fix_file(slug):
    filepath = os.path.join(BLOG_DIR, f"{slug}.html")
    if not os.path.exists(filepath):
        print(f"  [MISSING] {slug}.html")
        return

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    old_url = f"{BASE_URL}/blog/{slug}.html"
    new_url = f"{BASE_URL}/blog/{slug}/"

    # Replace all occurrences of old URL with new clean URL
    if old_url in content:
        content = content.replace(old_url, new_url)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  [FIXED] {slug}.html — URLs updated to clean format")
    else:
        print(f"  [OK] {slug}.html — already clean or not found")

def fix_sitemap():
    sitemap_path = os.path.dirname(os.path.abspath(__file__)) + "\\sitemap-main.xml"
    with open(sitemap_path, "r", encoding="utf-8") as f:
        content = f.read()

    changed = False
    for slug in SLUGS:
        old_url = f"{BASE_URL}/blog/{slug}.html"
        new_url = f"{BASE_URL}/blog/{slug}/"
        if old_url in content:
            content = content.replace(old_url, new_url)
            changed = True

    # Also update lastmod to today for blog pages
    # Update the sitemap date to today
    content = content.replace(
        "<lastmod>2026-04-07</lastmod>",
        "<lastmod>2026-04-14</lastmod>"
    )

    if changed:
        with open(sitemap_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"\n  [FIXED] sitemap-main.xml — clean URLs applied")
    else:
        print(f"\n  [OK] sitemap-main.xml — already using clean URLs")

def main():
    print(f"\n{'='*60}")
    print("Blintix SEO Canonical URL Fixer")
    print(f"{'='*60}\n")

    for slug in SLUGS:
        fix_file(slug)

    fix_sitemap()

    print(f"\n{'='*60}")
    print("Done!")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
