import re
import sys

def remove_list_characters(text: str) -> str:
	return re.sub(r'(^\s*[-*]\s*)', "", text)

def markdown_to_html(markdown_text):
    html = markdown_text
    
    # Headers (e.g., # Header, ## Header)
    html = re.sub(r'^(#{1,6})\s*(.*)', lambda m: f"<h{len(m.group(1))}>{m.group(2)}</h{len(m.group(1))}>", html, flags=re.MULTILINE)
    
    # Bold (e.g., **bold text**)
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    
    # Italics (e.g., *italic text*)
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)

    # Highlight (e.g., ==highlighted text==)
    html = re.sub(r'==(.*?)==', r'<mark>\1</mark>', html)
    
    # Links (e.g., [text](url))
    html = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', html)
    
    # Unordered Lists (e.g., - item or * item)
    html = re.sub(r'(^\s*[-*]\s+.*(?:\n\s*[-*]\s+.*)*)\n', lambda m: "<ul>" + ''.join(f"<li>{remove_list_characters(item.strip())}</li>" for item in m.group(1).splitlines()) + "</ul>", html, flags=re.MULTILINE)
    # html = re.sub(r'^\s*[-*]\s+.*(?:\n\s*[-*]\s+(.*))*', lambda m: "<ul>" + ''.join(f"<li>{item.strip()}</li>" for item in m.group(1).splitlines()) + "</ul>", html, flags=re.MULTILINE)
    # html = re.sub(r'(^\s*[-*]\s+.*(\n\s*[-*]\s+(?:.*))*)', lambda m: "<ul>" + ''.join(f"<li>{item.strip()}</li>" for item in m.group(1).splitlines()) + "</ul>", html, flags=re.MULTILINE)
    
    # Ordered Lists (e.g., 1. item)
    html = re.sub(r'(^\s*\d+\.\s+.*(?:\n\s*\d+\.\s+.*)*)', lambda m: "<ol>" + ''.join(f"<li>{item.strip()[3:]}</li>" for item in m.group(1).splitlines()) + "</ol>", html, flags=re.MULTILINE)

    # Line breaks for single newlines
    html = html.replace("\n", "<br>")

    return html

# Example usage
markdown_text = """
# Header 1
## Header 2
This is some **bold text** and some *italic text*.

- Item 1
- Item 2
- Item 3

1. First item
2. Second item

Check out [OpenAI](https://www.openai.com).
"""

if len(sys.argv) != 2:
	print("Arguments should be one markdown file")
	exit()

markdown_file_path = sys.argv[1]

with open(markdown_file_path, 'r') as markdown_file:
	markdown_text = markdown_file.read()
	html_output = markdown_to_html(markdown_text)
	print(html_output)
