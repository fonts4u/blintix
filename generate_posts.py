import os

# Updated Template with standardized header/footer
post_template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} — Blintix Journal</title>
    <meta name="description" content="{excerpt}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
    <link rel="stylesheet" href="blog.css">
    <link rel="icon" type="image/png" href="../favicon.png?v=5">
    <script src="https://cdn.jsdelivr.net/npm/motion@11.11.13/dist/motion.js" defer></script>
    <style>
        .post-hero {{ padding: 180px 0 100px; position: relative; min-height: 60vh; display: flex; align-items: center; justify-content: center; }}
        .post-hero-bg {{ position: absolute; inset: 0; z-index: -1; background: #000; }}
        .post-hero-bg img {{ width: 100%; height: 100%; object-fit: contain; opacity: 0.5; filter: blur(30px) brightness(0.6); }}
        .post-hero-content {{ max-width: 900px; margin: 0 auto; padding: 0 20px; }}
        .post-meta-top {{ color: var(--accent-primary); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.1em; margin-bottom: 20px; }}
        .post-title {{ font-size: clamp(2.5rem, 6vw, 4rem); line-height: 1.1; margin-bottom: 32px; font-weight: 800; letter-spacing: -0.03em; }}
        .article-container {{ max-width: 800px; margin: -100px auto 120px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 80px; position: relative; z-index: 10; box-shadow: 0 40px 100px rgba(0,0,0,0.5); }}
        .article-body {{ font-size: 1.15rem; line-height: 1.8; color: rgba(255,255,255,0.8); }}
        .article-body h2 {{ font-size: 2rem; margin: 60px 0 24px; color: white; }}
        .article-body p {{ margin-bottom: 24px; }}
        .article-body img {{ width: 100%; border-radius: var(--radius-md); margin: 40px 0; border: 1px solid var(--border-subtle); object-fit: cover; }}
        .article-body blockquote {{ border-left: 4px solid var(--accent-primary); padding: 20px 40px; background: rgba(167, 139, 250, 0.05); border-radius: 0 var(--radius-md) var(--radius-md) 0; font-style: italic; font-size: 1.25rem; margin: 40px 0; }}
        .article-body .code-block {{ background: #050505; padding: 24px; border-radius: var(--radius-md); font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; margin: 40px 0; border: 1px solid var(--border-subtle); overflow-x: auto; }}
        .zipit-pro-cta {{ background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(255, 140, 0, 0.1)); border: 1px solid var(--border-hover); padding: 50px; border-radius: var(--radius-lg); text-align: center; margin-top: 80px; }}
        @media (max-width: 768px) {{ .article-container {{ margin: -40px 15px 80px; padding: 40px 24px; }} .post-title {{ font-size: 2.5rem; }} }}
    </style>
</head>
<body class="blog-body">
    <nav class="navbar">
        <div class="container">
            <a href="../index.html" class="logo"><img src="../logo2.png?v=1.3" alt="Blintix Logo"></a>
            <div class="nav-content">
                <ul class="nav-links">
                    <li><a href="../index.html">Studio</a></li>
                    <li><a href="index.html">Journal</a></li>
                </ul>
                <a href="#subscribe" class="btn btn-outline nav-cta">Join Lab</a>
            </div>
        </div>
    </nav>
    <main>
        <header class="post-hero">
            <div class="post-hero-bg"><img src="{image}" alt="Background"></div>
            <div class="container text-center post-hero-content">
                <div class="post-meta-top reveal"><span>{category}</span> <span>•</span> <span>{date}</span></div>
                <h1 class="post-title reveal">{title}</h1>
                <div class="post-author-box reveal" style="display:flex; align-items:center; justify-content:center; gap:12px; margin-top:40px;">
                    <div style="width:40px; height:40px; border-radius:50%; background:var(--accent-gradient); padding:2px;"><img src="../favicon.png" alt="Blintix" style="width:100%; border-radius:50%; background:#000;"></div>
                    <div style="text-align:left;"><div style="font-weight:600;">Blintix Labs</div><div style="font-size:0.8rem; opacity:0.5;">Product Engineering</div></div>
                </div>
            </div>
        </header>
        <article class="article-container reveal">
            <div class="article-body">
                {content}
                <div class="zipit-pro-cta reveal">
                    <h3 style="font-size:1.8rem; margin-bottom:20px;">Streamline your workflow with ZipIt.</h3>
                    <p style="margin-bottom:32px; opacity:0.8;">Extract CSS, fonts, and full UI components instantly from any website.</p>
                    <a href="https://zipit.blintix.store" target="_blank" class="btn btn-primary">Try it for Free ↗</a>
                </div>
            </div>
        </article>
        <section id="subscribe" class="section subscribe-section" style="margin-top:0;">
            <div class="container reveal"><div class="subscribe-card"><h2 class="section-title">The Blintix Newsletter.</h2><p class="section-desc mx-auto" style="margin-bottom:24px;">Deep dives into modern web tech. No spam, ever.</p>
            <form class="subscribe-form"><input type="email" placeholder="you@example.com" required><button class="btn btn-primary">Subscribe</button></form></div></div>
        </section>
    </main>
    <footer class="footer"><div class="container"><div class="footer-bottom reveal"><div>&copy; 2026 Blintix Studio.</div><div style="display:flex; gap:24px;"><a href="../index.html">Home</a><a href="index.html">Journal</a><a href="https://x.com/bharatmodi2014">Twitter</a></div></div></div></footer>
    <script>window.addEventListener('load', () => {{ const {{ animate, inView }} = Motion; inView(".reveal", ({{ target }}) => {{ animate(target, {{ opacity: [0, 1], y: [30, 0] }}, {{ duration: 0.8 }}); }}); }});</script>
</body>
</html>
"""

posts = [
    {
        "filename": "extract-css-guide.html",
        "title": "How to Extract CSS from Any Website (2026 Guide)",
        "excerpt": "Extract design tokens and stylesheets like a pro in 2026.",
        "image": "css-extract.png",
        "category": "Engineering",
        "date": "April 07, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">In 2026, the art of style extraction has moved beyond simple inspection to intelligent token identification.</p>
            <p>Modern CSS is complicated. With the rise of deeply nested SCSS, functional utility frameworks, and complex shadow DOMs, locating a single style definition can take forever. This guide explains how to skip the manual search and extract fully mapped design systems in seconds.</p>
            <img src="css-extract.png" alt="Extraction Visual">
            <h2>The Shadow DOM Challenge</h2>
            <p>Many modern frameworks use the Shadow DOM to encapsulate styles. Traditional inspect tools often fail to drill through these layers accurately. Our latest workflow utilizes a 'Computed Root Analysis' that flattens these encapsulations, giving you the actual production-ready CSS that renders on the screen.</p>
            <div class="code-block"><pre><code>/* Extracted with ZipIt */
.hero-glass {{
    backdrop-filter: blur(20px);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 40px 80px -10px rgba(0, 0, 0, 0.6);
}}</code></pre></div>
            <h2>Exporting Variables</h2>
            <p>Don't just copy the hex codes. Identify the variables. By analyzing the global scope, you can extract the full color palette and spacing system, allowing you to replicate the design with proper tokenization.</p>
        """
    },
    {
        "filename": "download-assets-guide.html",
        "title": "Download Website Assets (Images, Fonts, SVGs) in 1 Click",
        "excerpt": "How to bundle a full site's assets into a single ZIP instantly.",
        "image": "assets-download.png",
        "category": "Assets",
        "date": "April 01, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">Stop 'Right-Clicking' and Start Bundling.</p>
            <p>Manually saving images and locating font files hidden behind complex `@font-face` rules is tedious and error-prone. In 2026, asset extraction should be a single-click event that results in a perfectly organized directory.</p>
            <img src="assets-download.png" alt="Assets Bundle">
            <h2>Automatic Font Locating</h2>
            <p>Fonts are often hosted on separate CDNs with obfuscated filenames. High-end extraction tools now automatically resolve these URLS, download the original WOFF2/TTF files, and even generate a local CSS file so they work immediately in your project.</p>
            <h2>SVG Source Cleaning</h2>
            <p>When you grab an SVG from a website, it often contains redundant metadata, IDs, and hidden groups. Our recommended workflow includes an 'SVG Purge' during the download process, giving you clean, optimized paths ready for your next design.</p>
        """
    },
    {
        "filename": "copy-ui-without-coding.html",
        "title": "How to Copy UI from Any Website (Without Coding)",
        "excerpt": "Learn how to replicate stunning user interfaces for rapid prototyping.",
        "image": "copy-ui.png",
        "category": "Design",
        "date": "March 28, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">The no-code bridge between inspiration and implementation.</p>
            <p>Imitation is where great innovation begins. Designers often see a layout or a unique interaction they want to study. But without front-end knowledge, 'copying' that UI was impossible—until now.</p>
            <img src="copy-ui.png" alt="UI Mapping">
            <h2>Holographic Scaffolding</h2>
            <p>By mapping the spatial coordinates of every element on a page, modern tools can generate a pixel-perfect scaffold. This isn't just an image—it's a structured layout with buttons, divs, and navigations already in their correct containers.</p>
            <blockquote>"The best way to understand a design system is to literally take it apart and put it back together."</blockquote>
            <h2>Speed Over Slogging</h2>
            <p>Why rebuild a standard navbar or a footer when you can extract a high-fidelity scaffold in seconds? This allows designers to focus 100% of their energy on the unique creative aspects of their project.</p>
        """
    },
    {
        "filename": "design-to-figma.html",
        "title": "Convert Website Design to Figma in Minutes",
        "excerpt": "Porting production websites back to your design canvas.",
        "image": "figma-convert.png",
        "category": "Productivity",
        "date": "March 25, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">Bridging the gap between the Browser and the Canvas.</p>
            <p>One of the biggest frustrations for design teams is when the 'Live' site diverges from the original Figma files. 'Branch Mapping' allows you to extract the current live state of a website and port it directly into Figma as editable layers.</p>
            <img src="figma-convert.png" alt="Figma Bridge">
            <h2>Maintaining Layer Fidelity</h2>
            <p>This isn't a screenshot import. This process converts DOM elements into Figma Frames, Groups, and Shapes. Rectangle divs become vector rectangles, and text spans become editable text layers with their original styling preserved.</p>
            <div class="code-block"><pre><code>// Figma Conversion Logic
DOM.Group(elements) => Figma.Frame(options)
DOM.Text(span) => Figma.Text(fontTokens)</code></pre></div>
            <h2>Workflow Speed</h2>
            <p>Regaining lost design files or analyzing competitor layouts becomes a matter of minutes, allowing your team to move faster and stay in sync with what's actually being shipped.</p>
        """
    },
    {
        "filename": "extract-color-palette.html",
        "title": "Extract Color Palette from Any Website Instantly",
        "excerpt": "Master the art of color extraction with 1:1 precision.",
        "image": "color-palette.png",
        "category": "Design",
        "date": "March 20, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">Color extraction is more than just Hex codes; it's about identifying the soul of a design system.</p>
            <p>Every premium brand spends hundreds of hours refining their color scales. Identifying the primary accents is easy; identifying the semantic tokens for shadows, borders, and glassmorphic blurs is the real secret.</p>
            <img src="color-palette.png" alt="Color Palette Visual">
            <h2>Neon Scales and Glassmorphism</h2>
            <p>Modern 'dark-mode' designs rely on vibrant neon accents and translucent overlays. These colors change based on their backdrop. Our palette extraction system identifies the exact rgba/hsla tokens, even within complex CSS filter stacks.</p>
            <div class="code-block"><pre><code>/* Extracted Palette */
--accent-neon: #E6007E;
--glass-overlay: rgba(242, 242, 242, 0.05);
--primary-shadow: #1A1A1A;</code></pre></div>
            <h2>Exporting To Production</h2>
            <p>Once extracted, you can export these scales as CSS Variables, Figma Styles, or even JSON files for your design system documentation. Use these to bring 2026 visual standards to your next build.</p>
        """
    },
    {
        "filename": "download-lottie-animations.html",
        "title": "How to Download Lottie Animations from Any Website",
        "excerpt": "Extract beautiful web animations and use them in your prototypes.",
        "image": "lottie.png",
        "category": "Assets",
        "date": "March 15, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">Capture the motion of the web.</p>
            <p>Lottie animations (JSON-based) are the gold standard for high-performance web motion. But they are often hard to find in the source code as they are injected via JS players. This guide explains how to sniff out these JSON files and save them for your own use.</p>
            <img src="lottie.png" alt="Lottie Motion">
            <h2>Player Identification</h2>
            <p>Most sites use the dotLottie or LottieFiles player. By monitoring the 'Network' tab (or using the ZipItSniffer), you can identify the exact `.json` or `.lottie` payload being delivered to the browser.</p>
            <h2>Preview and Re-use</h2>
            <p>Once you have the JSON file, you can upload it to the Lottie player or directly into Figma using an animation plugin. This allows you to verify it works exactly as it did on the original site before integrating it into your project.</p>
        """
    },
    {
        "filename": "best-free-tools-2026.html",
        "title": "Best Free Tools for Developers & Designers (2026)",
        "excerpt": "Our hand-picked list of the must-have utilities for digital creators.",
        "image": "tools.png",
        "category": "Tools",
        "date": "March 10, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">Building a high-end product doesn't have to cost a fortune.</p>
            <p>The 2026 toolscape is dominated by small, focused utilities that do one thing perfectly. We've compiled the ultimate list of free tools being used inside Blintix Studio to ship MicroSaaS faster than ever.</p>
            <img src="tools.png" alt="Tool Kit">
            <h2>1. ZipIt (Standard Edition)</h2>
            <p>The core utility for asset and code extraction. The free tier remains the most powerful way to grab clean SVGs and CSS chunks from any site.</p>
            <h2>2. VectorPurge</h2>
            <p>A web-based optimizer that strips metadata from Figma exports, reducing SVG sizes by up to 80% without losing quality.</p>
            <h2>3. Motion-Snippet</h2>
            <p>A lightweight library of Framer Motion presets that we use to get that signature Blintix 'smooth-flow' interaction on every page.</p>
        """
    },
    {
        "filename": "inspect-code-without-devtools.html",
        "title": "How to Inspect Website Code Without DevTools",
        "excerpt": "Alternative methods for analyzing web structure and logic.",
        "image": "inspect-code.png",
        "category": "Engineering",
        "date": "March 05, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">Sometimes right-click is disabled. Sometimes you're on a mobile device. Here's how to see 'under the hood' anyway.</p>
            <p>Website security and 'anti-copy' scripts are becoming more common. If you encounter a site that restricts your access to DevTools, there are still several ethical ways to analyze its construction.</p>
            <img src="inspect-code.png" alt="Inspection">
            <h2>Mobile Inspection Proxies</h2>
            <p>By using a mobile proxy or a 'Sniffer' extension, you can intercept the traffic between the server and the browser, viewing the raw HTML, CSS, and JS before the browser-side restriction scripts can even fire.</p>
            <h2>The 'Source Mirror' Technique</h2>
            <p>Using a headless browser (like Playwright or Puppeteer) to locally render and mirror the site allows you full inspection control in a safe, restricted-free environment.</p>
        """
    },
    {
        "filename": "convert-website-to-zip.html",
        "title": "How to Convert Website to Offline ZIP (Full Guide)",
        "excerpt": "Full archiving and mirroring for your web references.",
        "image": "zip-offline.png",
        "category": "Productivity",
        "date": "March 01, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">Take the web offline with perfect fidelity.</p>
            <p>Whether it's for offline reference, client presentation without internet, or historical archiving, 'Site Mirroring' into a ZIP file is a powerful skill. We'll show you how to ensure the files remain functional when opened locally.</p>
            <img src="zip-offline.png" alt="Offline Container">
            <h2>Relative Path Mapping</h2>
            <p>The hardest part of site conversion is fixing the links. A 'Hard Mirror' tool like ZipIt Ultra rewrites all absolute URLs to relative paths, ensuring that a link to `/style.css` on the server points to the local `./style.css` within the zip.</p>
            <h2>Media Optimization</h2>
            <p>To keep ZIP sizes manageable, our process includes 'Down-Sampling' large images and videos, ensuring the offline version is fast and responsive while maintaining visual integrity.</p>
        """
    },
    {
        "filename": "hidden-developer-tools.html",
        "title": "Top 10 Hidden Developer Tools You Should Know",
        "excerpt": "Exclusive look at secret tools the top developers use daily.",
        "image": "hidden-tools.png",
        "category": "Tools",
        "date": "February 28, 2026",
        "content": """
            <p class="lead" style="font-size:1.3rem; color:white;">The secret arsenal of elite product engineers.</p>
            <p>Beyond Chrome and VS Code, there is a hidden layer of utilities that separate the seniors from the juniors. At Blintix, we use these to maintain our speed-of-ship and code quality.</p>
            <img src="hidden-tools.png" alt="Secret Tools">
            <h2>JSON Re-Mapper</h2>
            <p>A tool that takes messy API responses and automatically generates TypeScript interfaces and Zod schemas, saving hours of manual data-type definition.</p>
            <h2>CSS Grid-to-Flex Bridge</h2>
            <p>An amazing hidden tool that converts complex CSS Grid layouts into Flexbox-fallback compatible code, ensuring your 2026 designs work on 2018 browsers.</p>
            <h2>The 'Ghost Inspector'</h2>
            <p>A Chrome experiment that visually highlights 'Invisible layout shifts' (CLS) before they happen, allowing you to fix jitter before it affects your SEO scores.</p>
        """
    }
]

def generate_blog():
    blog_dir = "blog"
    if not os.path.exists(blog_dir):
        os.makedirs(blog_dir)
        
    for post in posts:
        # Construct the final HTML
        html_content = post_template.format(
            title=post["title"],
            excerpt=post["excerpt"],
            image=post["image"],
            category=post["category"],
            date=post["date"],
            content=post["content"]
        )
        
        # Save the file
        filepath = os.path.join(blog_dir, post["filename"])
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Generated: {filepath}")

if __name__ == "__main__":
    generate_blog()
