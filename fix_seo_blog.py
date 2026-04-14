"""
SEO Fix Script for Blintix Blog Posts
Adds: canonical URL, Open Graph, Twitter Cards, JSON-LD Article schema
to all blog post HTML files that are missing them.
"""

import os
import re

BASE_URL = "https://blintix.store"
BLOG_DIR = os.path.dirname(os.path.abspath(__file__)) + "\\blog"
OG_IMAGE = "https://blintix.store/og-image.png"

# Blog post metadata map
POSTS = {
    "best-free-tools-2026.html": {
        "title": "Best Free Tools for Developers & Designers (2026 Edition)",
        "description": "Discover the best free tools for developers and designers in 2026. Boost productivity with SEO, CSS, JSON, and UI tools in one place.",
        "date": "2026-04-07",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/tools.png",
        "author": "Blintix Labs",
        "category": "Tools",
    },
    "convert-website-to-zip.html": {
        "title": "Convert Website to Offline ZIP (Full Guide + 1 Click Method)",
        "description": "Download complete websites as ZIP files with HTML, CSS, and assets. Learn how to run websites offline with this full step-by-step guide.",
        "date": "2026-03-05",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/zip-offline.png",
        "author": "Blintix Labs",
        "category": "Engineering",
    },
    "copy-ui-without-coding.html": {
        "title": "How to Copy UI from Any Website (Without Coding)",
        "description": "Discover techniques to replicate stunning user interfaces for study or prototyping without touching a single line of code.",
        "date": "2026-03-28",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/copy-ui.png",
        "author": "Blintix Labs",
        "category": "Inside Blintix",
    },
    "design-to-figma.html": {
        "title": "Convert Website Design to Figma in Minutes (2026 Guide)",
        "description": "Convert any website into editable Figma designs in minutes. Extract layout, typography, and components easily. Perfect for designers.",
        "date": "2026-03-25",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/figma-convert.png",
        "author": "Blintix Labs",
        "category": "Tools",
    },
    "download-assets-guide.html": {
        "title": "Download Website Assets (Images, Fonts, SVGs) in 1 Click",
        "description": "Stop manually saving images. Bundle every asset on a page into a clean ZIP folder instantly using ZipIt Pro.",
        "date": "2026-04-01",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/assets-download.png",
        "author": "Blintix Labs",
        "category": "Assets",
    },
    "download-lottie-animations.html": {
        "title": "How to Download Lottie Animations from Any Website",
        "description": "Found a cool animation? Learn how to locate and download JSON-based Lottie animations to use in your own prototypes.",
        "date": "2026-03-15",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/lottie.png",
        "author": "Blintix Labs",
        "category": "Assets",
    },
    "extract-color-palette.html": {
        "title": "Extract Color Palette from Any Website Instantly",
        "description": "Identify every color in any design with 1:1 precision. Extract hex codes, CSS variables, and design tokens instantly.",
        "date": "2026-03-20",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/color-palette-new.png",
        "author": "Blintix Labs",
        "category": "Assets",
    },
    "extract-css-guide.html": {
        "title": "How to Extract CSS from Any Website (2026 Guide)",
        "description": "Learn the most efficient ways to grab production-ready CSS styles, variables, and animations from any modern website without getting lost in DevTools.",
        "date": "2026-04-07",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/css-extract.png",
        "author": "Blintix Labs",
        "category": "Guides",
    },
    "hidden-developer-tools.html": {
        "title": "10 Hidden Gems of Developer Tools You Must Know (2026)",
        "description": "Discover 10 essential hidden developer tools that will supercharge your workflow in 2026. Extract CSS, download assets, audit SEO, and more.",
        "date": "2026-02-28",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/hidden-tools.png",
        "author": "Blintix Labs",
        "category": "Tools",
    },
    "inspect-code-without-devtools.html": {
        "title": "How to Inspect Website Code Without DevTools",
        "description": "A deep dive into alternative methods for analyzing website structure and behavior when the right-click menu is disabled or restricted.",
        "date": "2026-03-10",
        "modified": "2026-04-07",
        "image": f"{BASE_URL}/blog/inspect-visual-v2.jpg",
        "author": "Blintix Labs",
        "category": "Guides",
    },
}


def build_seo_head(slug, post):
    url = f"{BASE_URL}/blog/{slug}"
    title = post["title"]
    description = post["description"]
    image = post.get("image", OG_IMAGE)
    date = post["date"]
    modified = post["modified"]
    author = post["author"]
    category = post["category"]

    return f"""    <!-- Canonical URL -->
    <link rel="canonical" href="{url}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="{url}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{image}">
    <meta property="article:published_time" content="{date}T00:00:00+00:00">
    <meta property="article:modified_time" content="{modified}T00:00:00+00:00">
    <meta property="article:author" content="{author}">
    <meta property="article:section" content="{category}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="{url}">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image}">
    <meta name="twitter:creator" content="@bharatmodi2014">

    <!-- JSON-LD Article Schema -->
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "{title}",
      "description": "{description}",
      "image": "{image}",
      "datePublished": "{date}T00:00:00+00:00",
      "dateModified": "{modified}T00:00:00+00:00",
      "author": {{
        "@type": "Organization",
        "name": "{author}",
        "url": "https://blintix.store"
      }},
      "publisher": {{
        "@type": "Organization",
        "name": "Blintix Studio",
        "logo": {{
          "@type": "ImageObject",
          "url": "https://blintix.store/favicon.png"
        }}
      }},
      "mainEntityOfPage": {{
        "@type": "WebPage",
        "@id": "{url}"
      }}
    }}
    </script>"""


def process_file(filepath, slug, post):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Check if canonical already present
    if 'rel="canonical"' in content or "rel='canonical'" in content:
        print(f"  [SKIP] {slug} — canonical already exists")
        return False

    # Build SEO block
    seo_block = build_seo_head(slug, post)

    # Inject after <meta name="keywords" ...> or after <meta name="description" ...>
    # Find insertion point: after keywords meta or description meta
    patterns_to_find = [
        r'(<meta name="keywords"[^>]+>)',
        r'(<meta name="description"[^>]+>)',
    ]

    injected = False
    for pattern in patterns_to_find:
        match = re.search(pattern, content)
        if match:
            insert_after = match.end()
            content = content[:insert_after] + "\n" + seo_block + content[insert_after:]
            injected = True
            break

    if not injected:
        # Fallback: inject before </head>
        content = content.replace("</head>", seo_block + "\n</head>")
        print(f"  [FALLBACK] {slug} — injected before </head>")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"  [FIXED] {slug} — SEO tags added")
    return True


def main():
    fixed = 0
    skipped = 0

    print(f"\n{'='*60}")
    print("Blintix Blog SEO Fixer")
    print(f"{'='*60}\n")

    for slug, post_meta in POSTS.items():
        filepath = os.path.join(BLOG_DIR, slug)
        if not os.path.exists(filepath):
            print(f"  [MISSING] {slug} — file not found")
            continue
        result = process_file(filepath, slug, post_meta)
        if result:
            fixed += 1
        else:
            skipped += 1

    print(f"\n{'='*60}")
    print(f"Done! Fixed: {fixed} | Skipped (already had canonical): {skipped}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
