import os
import re

html_files = [f for f in os.listdir("blog") if f.endswith(".html") and f != "index.html"]

for filename in html_files:
    path = os.path.join("blog", filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Remove local article styles that are now global
    # Pattern to find and remove: .article-body img { ... margin: 40px 0; ... }
    content = re.sub(r'\.article-body img\s*\{\s*[^}]*margin:\s*40px\s*0;[^}]*\}', '', content)
    
    # Also remove common layouts if they exactly match the new global ones
    # But let's be careful not to break specific accent colors.
    
    # Fix the background-clip lint everywhere while at it
    content = re.sub(r'(-webkit-background-clip:\s*text;)', r'\1 background-clip: text;', content)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Cleaned {filename}")
