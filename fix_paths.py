import glob
import os

files = glob.glob('blog/*.html')
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # CSS Fixes (Root Relative)
    content = content.replace('href="../style.css"', 'href="/style.css"')
    content = content.replace('href="blog.css"', 'href="/blog/blog.css"')
    
    # Asset Fixes (Root Relative)
    content = content.replace('src="../logo2.png', 'src="/logo2.png')
    content = content.replace('src="../favicon.png', 'src="/favicon.png')
    content = content.replace('href="../index.html"', 'href="/"')
    content = content.replace('href="index.html"', 'href="/blog/"')
    
    # Internal Blog Assets Fix
    blog_assets = [
        'hero.png', 'css-extract.png', 'inspect-visual.png', 
        'copy-ui.png', 'color-palette.png', 'figma-convert.png', 
        'assets-download.png', 'lottie.png', 'zip-offline.png', 
        'hidden-tools.png', 'tools.png', 'inspect-code.png'
    ]
    for img in blog_assets:
        content = content.replace(f'src="{img}"', f'src="/blog/{img}"')
    
    # Fix potentially already modified version params
    content = content.replace('.css?v=1.4"', '.css"')
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print(f"Updated {len(files)} blog files with root-relative paths.")
