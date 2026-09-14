import os
import re

blog_dir = 'blog'
tools_dir = 'zipit/tools'

# Mapping of blog post filename to (tool filename, tool name)
mapping = {
    'extract-color-palette.html': ('color-extractor.html', 'Free Color Extractor Tool'),
    'extract-css-guide.html': ('css-to-tailwind.html', 'Free CSS to Tailwind Tool'),
    'download-lottie-animations.html': ('lottie-previewer.html', 'Free Lottie Previewer Tool'),
    'download-assets-guide.html': ('image-optimizer.html', 'Free Image Optimizer Tool'),
    'inspect-code-without-devtools.html': ('seo-audit.html', 'Free SEO Audit Tool'),
    'best-free-tools-2026.html': ('index.html', 'All Free Tools')
}

# 1. OPTIMIZE ALL BLOG FILES AND ADD TOOL LINK
files = [f for f in os.listdir(blog_dir) if f.endswith('.html')]

for filename in files:
    path = os.path.join(blog_dir, filename)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Optimization
    content = content.replace("window.addEventListener('load',", "document.addEventListener('DOMContentLoaded',")
    content = content.replace('class="post-meta-top reveal"', 'class="post-meta-top"')
    content = content.replace('class="post-title reveal"', 'class="post-title"')
    content = content.replace('class="post-author-box reveal"', 'class="post-author-box"')
    content = content.replace('class="post-hero-visual reveal"', 'class="post-hero-visual"')
    
    pattern = r'(<div class="post-hero-visual">.*?<img src=")(.*?)(" alt="Feature Image">)'
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, r'\1\2\3 width="1000" height="562" fetchpriority="high" loading="eager"', content, flags=re.DOTALL)
    
    if filename == 'index.html':
        content = content.replace('class="hero-title reveal"', 'class="hero-title"')
        content = content.replace('class="hero-subtitle reveal', 'class="hero-subtitle')
        content = content.replace('class="category-pills reveal"', 'class="category-pills"')
        content = content.replace('<img src="/blog/hero.png" alt="Hero Background">', '<img src="/blog/hero.png" alt="Hero Background" width="1200" height="400" fetchpriority="high" loading="eager">')

    # Add free tool banner if mapped
    if filename in mapping:
        tool_file, tool_name = mapping[filename]
        tool_url = f"/zipit/tools/{tool_file}"
        if filename == 'best-free-tools-2026.html':
            tool_url = "/zipit/tools/"
            
        banner_html = f'''
                <div style="background: rgba(167, 139, 250, 0.05); border: 1px solid var(--accent-primary); border-radius: 12px; padding: 24px; margin: 40px 0; text-align: center;">
                    <h3 style="margin-top: 0; font-family: 'Instrument Serif', serif; font-size: 28px;">Try the {tool_name}</h3>
                    <p style="margin-bottom: 20px; font-size: 16px; opacity: 0.8;">We built a free, web-based utility for this exact workflow.</p>
                    <a href="{tool_url}" class="btn btn-primary" style="background: var(--accent-primary); color: #000; border: none;">Launch {tool_name}</a>
                </div>
                '''
        
        # Inject after the problem-section safely without truncating subsequent sections
        if "<!-- TOOL BANNER ADDED -->" not in content and '<div class="article-body">' in content:
            if '<section class="problem-section' in content:
                content = re.sub(
                    r'(<section[^>]*class="[^"]*problem-section[^"]*"[^>]*>.*?</section>)',
                    r'\1\n<!-- TOOL BANNER ADDED -->\n' + banner_html,
                    content,
                    count=1,
                    flags=re.DOTALL
                )
            else:
                content = re.sub(
                    r'(</h1>)',
                    r'\1\n<!-- TOOL BANNER ADDED -->\n' + banner_html,
                    content,
                    count=1
                )

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# 2. ADD REDIRECT IN FREE TOOL PAGE
blog_titles = {
    'extract-color-palette.html': 'Extract Color Palette from Any Website Instantly',
    'extract-css-guide.html': 'How to Extract CSS from Any Website',
    'download-lottie-animations.html': 'How to Download Lottie Animations',
    'download-assets-guide.html': 'Download Website Assets in 1 Click',
    'inspect-code-without-devtools.html': 'Inspect Website Code Without DevTools',
    'best-free-tools-2026.html': 'Best Free Tools for Developers'
}

for blog_file, (tool_file, tool_name) in mapping.items():
    if tool_file == 'index.html': continue
    
    tool_path = os.path.join(tools_dir, tool_file)
    if os.path.exists(tool_path):
        with open(tool_path, 'r', encoding='utf-8') as f:
            t_content = f.read()
            
        blog_title = blog_titles.get(blog_file, 'Read our Guide')
        blog_url = f"../../blog/{blog_file}"
        
        banner_html = f'''
            <div style="max-width: 1000px; margin: 40px auto; padding: 0 20px; text-align: center;">
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 20px; display: inline-block;">
                    <span style="opacity: 0.7; font-size: 14px; margin-right: 12px;">Related Guide:</span>
                    <a href="{blog_url}" style="color: var(--accent); font-weight: 500; text-decoration: none;">{blog_title} →</a>
                </div>
            </div>
            <!-- BLOG LINK ADDED -->
        '''
        
        if "<!-- BLOG LINK ADDED -->" not in t_content and '<main class="extractor-container">' in t_content:
            t_content = t_content.replace('<main class="extractor-container">', '<main class="extractor-container">\n' + banner_html)
            with open(tool_path, 'w', encoding='utf-8') as f:
                f.write(t_content)

print("Done updating blog posts and tools.")
