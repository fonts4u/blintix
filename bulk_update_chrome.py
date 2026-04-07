import os
import re

CHROME_URL = "https://chromewebstore.google.com/detail/zipit-website-to-zip/ldennagbhdnhchgfllfhnfhcmdlddmkn"
ZIPIT_PRO_URL = "https://zipit.blintix.store"

html_files = [
    "best-free-tools-2026.html",
    "convert-website-to-zip.html",
    "copy-ui-without-coding.html",
    "design-to-figma.html",
    "download-assets-guide.html",
    "download-lottie-animations.html",
    "extract-color-palette.html",
    "extract-css-guide.html",
    "hidden-developer-tools.html",
    "inspect-code-without-devtools.html"
]

for filename in html_files:
    filepath = os.path.join("blog", filename)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Check if Chrome button is already there
    if CHROME_URL in content:
        continue
        
    # Find the ZipIt Pro button and wrap it in a flex container if not already (or just add next to it)
    # The current structure: <a href="https://zipit.blintix.store" target="_blank" class="btn btn-primary" ...>Try ZipIt Pro ↗</a>
    
    # regex to find the button
    btn_pattern = r'(<a href="https://zipit\.blintix\.store" target="_blank" class="btn btn-primary" style="([^"]+)">Try ZipIt Pro ↗</a>)'
    
    match = re.search(btn_pattern, content)
    if match:
        original_btn = match.group(0)
        style = match.group(2)
        
        # New structure with flex gap
        chrome_btn = f'<a href="{CHROME_URL}" target="_blank" class="btn btn-outline" style="border-color: {style.split("background: ")[1].split(";")[0] if "background: " in style else "var(--accent-primary)"}; color: {style.split("background: ")[1].split(";")[0] if "background: " in style else "var(--accent-primary)"};">Add to Chrome</a>'
        
        # In best-free-tools, it already has a flex container, let's be careful
        if "flex" in content[match.start()-100:match.end()+100]:
             # It likely already has a container, just add next to it
             new_content = content.replace(original_btn, f"{original_btn}\n                    {chrome_btn}")
        else:
             # Wrap in a flex div
             new_content = content.replace(original_btn, f'<div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">\n                        {original_btn}\n                        {chrome_btn}\n                    </div>')
             
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {filename}")
    else:
        print(f"No match for {filename}")
