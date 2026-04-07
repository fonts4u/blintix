import glob
import re
import os

files = glob.glob('blog/*.html')
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Aggressively fix styles with root-relative paths
    content = re.sub(r'href=["\']\.\./style\.css(?:\?v=[\d\.]*)?["\']', 'href="/style.css"', content)
    content = re.sub(r'href=["\']blog\.css(?:\?v=[\d\.]*)?["\']', 'href="/blog/blog.css"', content)
    
    # Fix common logo and favicon
    content = re.sub(r'src=["\']\.\./logo2\.png(?:\?v=[\d\.]*)?["\']', 'src="/logo2.png?v=1.3"', content)
    content = re.sub(r'src=["\']\.\./favicon\.png(?:\?v=[\d\.]*)?["\']', 'src="/favicon.png?v=5"', content)
    content = re.sub(r'href=["\']\.\./index\.html["\']', 'href="/"', content)
    content = re.sub(r'href=["\']index\.html["\']', 'href="/blog/"', content)

    # Blog images
    blog_assets = [
        'hero.png', 'css-extract.png', 'inspect-visual.png', 
        'copy-ui.png', 'color-palette.png', 'figma-convert.png', 
        'assets-download.png', 'lottie.png', 'zip-offline.png', 
        'hidden-tools.png', 'tools.png', 'inspect-code.png'
    ]
    for img in blog_assets:
        content = content.replace(f'src="{img}"', f'src="/blog/{img}"')
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print(f"Aggressively updated {len(files)} blog files to root-relative paths.")
