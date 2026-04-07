import os
import re

html_files = [f for f in os.listdir("blog") if f.endswith(".html") and f != "index.html"]

CHROME_URL = "https://chromewebstore.google.com/detail/zipit-website-to-zip/ldennagbhdnhchgfllfhnfhcmdlddmkn"
ZIPIT_URL = "https://zipit.blintix.store"

def update_cta(content, filename):
    # Standardize colors based on filename or existing style
    color = "#a78bfa" # default violet
    if "extract-css" in filename or "copy-ui" in filename:
        color = "#3b82f6" # blue
    elif "best-free-tools" in filename or "hidden-dev" in filename:
        color = "#8b5cf6" # purple/violet
    elif "convert-website-to-zip" in filename:
        color = "#f59e0b" # amber
    elif "download-assets" in filename:
        color = "#10b981" # green
        
    # Check if dual CTA is already there
    if CHROME_URL in content:
        return content

    # Find the zipit-pro-cta block
    # We want to replace the button or button-group
    btn_pattern = r'<a href="https://zipit\.blintix\.store"[^>]*>([^<]+)</a>'
    
    # We'll just find the content inside zipit-pro-cta and replace the buttons
    new_btn_group = f"""<div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
                        <a href="{ZIPIT_URL}" target="_blank" class="btn btn-primary" style="background: {color}; border-color: {color}; padding: 16px 40px;">Try ZipIt Pro ↗</a>
                        <a href="{CHROME_URL}" target="_blank" class="btn btn-outline" style="border-color: {color}; color: {color}; padding: 16px 40px;">Add to Chrome</a>
                    </div>"""
    
    # Simple replacement if we find the block
    if '<div class="zipit-pro-cta reveal">' in content:
        # locate the buttons inside the cta
        cta_start = content.find('<div class="zipit-pro-cta reveal">')
        cta_end = content.find('</div>', cta_start + 50)
        
        # We need a more careful end search if nested
        # But for these files it's flat
        
        # Let's just regex the buttons inside the CTA
        content = re.sub(r'(<div class="zipit-pro-cta reveal">.*?<p[^>]*>.*?</p>)\s*(?:<a href="https://zipit\.blintix\.store"[^>]*>.*?</a>|<div style="display: flex;[^>]*>.*?</div>)', 
                         r'\1\n                    ' + new_btn_group, content, flags=re.DOTALL)
        
    return content

for filename in html_files:
    path = os.path.join("blog", filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update CTAs
    content = update_cta(content, filename)
    
    # 2. Fix Image Filling Space & Spacing
    # Ensure images have 100% width and display block
    # The global blog.css handles .article-body img now, but let's make sure the HTML is clean
    
    # 3. Clean local hero styles that conflict with global blur hero
    content = re.sub(r'\.post-hero-bg img\s*\{\s*[^}]*object-fit:\s*contain;[^}]*\}', '', content)
    
    # 4. Standardize font scaling and padding
    # Remove large redundant style blocks that are now global
    # (Matches common article body setup)
    content = re.sub(r'\.article-body\s*\{\s*font-size:\s*1.15rem;[^}]*\}', '', content)
    content = re.sub(r'\.article-body h2\s*\{\s*font-size:\s*2.2rem;[^}]*\}', '', content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Propagated updates to {filename}")
