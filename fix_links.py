import os
import re

def fix_file(path, replacements):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new)
    
    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Fixed: {path}")
    else:
        print(f"No changes: {path}")

# Fix Blog Files (use absolute paths from root /)
blog_dir = "blog"
blog_replacements = [
    ("../zipit/tools/", "/zipit/tools/"),
    ("../zipit/index.html", "/zipit/"),
    ("../index.html", "/"),
    ("../favicon.png", "/favicon.png"),
]

for filename in os.listdir(blog_dir):
    if filename.endswith(".html"):
        fix_file(os.path.join(blog_dir, filename), blog_replacements)

# Fix Root Files (use absolute paths from root /)
for filename in ["index.html", "privacy.html"]:
    if os.path.exists(filename):
        fix_file(filename, [("blog/index.html", "/blog/"), ("index.html", "/")])

# Fix ZipIt Tools (use double dots to account for trailing slash)
zipit_tools_dir = os.path.join("zipit", "tools")
if os.path.exists(zipit_tools_dir):
    zipit_replacements = [
        ('href="../style.css"', 'href="../../style.css"'),
        ('src="../logo.png"', 'src="../../logo.png"'),
        ('href="../tools.html"', 'href="../../tools.html"'),
        ('href="../index.html"', 'href="../../index.html"'),
        ('href="../favicon.png"', 'href="../../favicon.png"'),
        ('src="../', 'src="../../'),
    ]
    for filename in os.listdir(zipit_tools_dir):
        if filename.endswith(".html"):
            fix_file(os.path.join(zipit_tools_dir, filename), zipit_replacements)
