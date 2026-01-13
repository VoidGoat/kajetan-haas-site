

import re
import sys
import os
from datetime import datetime, timezone
from dataclasses import dataclass
from pathlib import Path
import warnings

@dataclass
class BlogEntry:
  title: str 
  publish_date: datetime
  updated_date: datetime
  html_url: str

output_directory: str

def main():
	global output_directory

	# if len(sys.argv) != 3:
	# 	print("Arguments should be two directories")
	# 	return

	project_root = "../../"

	# posts_directory = sys.argv[1]
	posts_directory = project_root + "blog_source/blueprint/blog"
	output_directory = project_root + "_built_site/blog/" 

	blog_entries = []

	for file_name in os.listdir(posts_directory):
		path = posts_directory + "/" + file_name
		if os.path.isfile(path):
			if file_name == "index.html":
				# Skip index.html since that has to be parse last
				continue

			print(path)
			html_output, entry_data = process_file(path)

			blog_entries.append(entry_data)

			file_output_directory = output_directory + os.path.splitext(file_name)[0]
			if not os.path.isdir(file_output_directory):
				os.makedirs(file_output_directory)

			with open(file_output_directory + "/index.html", "w") as output_file:
				output_file.write(html_output)

	# Handle index.html
	with open(output_directory + "index.html", "w") as output_file:
		html_output, entry_data = process_file(posts_directory + "/index.html")
		output_file.write(html_output)

	print(blog_entries)
	generate_feed_file(blog_entries)


	# with open(markdown_file_path, 'r') as markdown_file:
	# 	markdown_text = markdown_file.read()
	# 	html_output = process_file(markdown_text)

	# with open("../../blog_output/output.html", "w") as output_file:
	# 	output_file.write(html_output)


# rss_item = """
# <item>
# 	<title>{0}</title>
# 	<link>{1}</link>
# 	<guid>{2}</guid>
# 	<description>{3}</description>
# </item>
# """
# rss_channel = """
# <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
# <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
# 	<channel>
# 		<title>Kajetan's Site</title>
# 		<link>https://kajetan.org/</link>
# 		<description>Recent content on Kajetan's blog</description>
# 		<language>en-us</language>
# 		<copyright>&lt;small&gt;Text content © Kajetan Haas. &lt;/small&gt;</copyright>
# 		<atom:link href="https://kajetan.org/atom.xml" rel="self" type="application/rss+xml"/>
# 		{0}
# 	</channel>
# </rss>
# """



def print_red(skk): print("\033[91m{}\033[00m" .format(skk))


def generate_feed_file(entry_list):
	local_time = datetime.now(timezone.utc).astimezone()
	print(local_time.isoformat())

	entries = ""
	for entry in entry_list:
		entries += generate_feed_entry(entry)

	feed_name = "Kajetan's blog"
	homepage_url = "https://kajetan.org/blog"
	feed_url = "https://kajetan.org/blog/atom.xml"
	last_update_time = datetime.now().isoformat() # In RFC3339
	author_name = "Kajetan Haas"

	atom_channel = f"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>{feed_name}</title>
	<id>{homepage_url}</id>
	<link rel="alternate" href="{homepage_url}"/>
	<link rel="self" href="{feed_url}"/>
	<updated>{last_update_time}</updated>
	<author>
		<name>{author_name}</name>
	</author>
	{entries}
</feed>
"""
	with open(output_directory + "atom.xml", "w") as output_file:
		output_file.write(atom_channel)




def generate_feed_entry(entry: BlogEntry):
	# entry_title = entry.
	# entry_permalink = ""
	atom_entry = f"""
	<entry>
		<title>{entry.title}</title>
		<link rel="alternate" type="text/html" href="{entry.html_url}"/>
		<id>{entry.html_url}</id>
		<published>{entry.publish_date}</published>
		<updated>{entry.updated_date}</updated>
		<content type="html">{entry.title}</content>
	</entry>
"""
	return atom_entry

def process_file(file_path: str) -> tuple[str, BlogEntry]:
	with open(file_path, 'r') as file:
		text = file.read()
		return process_html(text, file_path)

def parse_attribute(m):
	global page_attributes
	identifer = m.group(1)
	value = m.group(2)
	if identifer == "publish_date" or identifer == "update_date":
		value = datetime.strptime(value, "%m/%d/%Y")

	page_attributes[identifer] = value
	return ""


page_attributes = {}
def process_html(html: str, file_path: str) -> tuple[str, BlogEntry]:
	global page_attributes
	page_attributes.clear()

	html = re.sub(r'!include\((.*)\)', lambda m: (include_html(m.group(1))), html, flags=re.MULTILINE)

	html = re.sub(r'!include_md\((.*)\)', lambda m: (include_markdown(m.group(1))), html, flags=re.MULTILINE)

	html = re.sub(r'!blog_list\((.*)\)', lambda m: (blog_list(m.group(1))), html, flags=re.MULTILINE)

	html = re.sub(r'^@([a-zA-Z_]+)\s*=\s*(.*)\n', parse_attribute, html, flags=re.MULTILINE)
	html = re.sub(r'@([a-zA-Z_]+)', lambda m: page_attributes.get(m.group(1)), html, flags=re.MULTILINE)

	base_url = "https://www.kajetan.org/blog/"
	print(page_attributes)
	page_url = os.path.splitext(os.path.basename(file_path))[0]

	if "title" not in page_attributes:
		print_red("No title provided for page: " + file_path)
		quit()

	entry = BlogEntry(page_attributes["title"], page_attributes["publish_date"], page_attributes["update_date"], base_url + page_url)

	# print(html)
	return html, entry

def include_html(component_name: str) -> str:
	with open("../components/" + component_name + ".html", 'r') as file:
		return file.read()

def include_markdown(markdown_path: str) -> str:
	with open("../../" + markdown_path, 'r') as file:
		return markdown_to_html(file.read())

def blog_list(blog_count):
	# Use '.' for the current directory
	# Use Path('/path/to/directory') for a specific directory
	directory_path = Path('../blueprint/blog/') 

	files = [p.name for p in directory_path.iterdir() if p.is_file()]
	print("TEST")

	list_result = ""
	count = 0
	for file in files:
		if file == "index.html":
			continue
		count += 1
		post_name = file.split(".")[0]
		list_result += f"""
		<a class="blog-link" href="/blog/{post_name}/">
			<p class="blog-number">no. {count}</p>
			<p class="blog-name">{post_name.replace('-', ' ')}</p>
		</a>
"""
	print(files)
	return list_result

def remove_list_characters(text: str) -> str:
	return re.sub(r'(^\s*[-*]\s*)', "", text)

def markdown_to_html(markdown_text):
    html = markdown_text

    
    # Headers (e.g., # Header, ## Header)
    html = re.sub(r'^(#{1,6})\s*(.*)\n*', lambda m: f"<h{len(m.group(1))}>{m.group(2)}</h{len(m.group(1))}>\n", html, flags=re.MULTILINE)
    
    # Bold (e.g., **bold text**)
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    
    # Italics (e.g., *italic text*)
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)

    # Highlight (e.g., ==highlighted text==)
    html = re.sub(r'==(.*?)==', r'<mark>\1</mark>', html)
    
    
    # Unordered Lists (e.g., - item or * item)
    # html = re.sub(r'(^\s*[-*]\s+.*(?:\n\s*[-*]\s+.*)*)\n*', lambda m: "<ul>" + ''.join(f"<li>{remove_list_characters(item.strip())}</li>" for item in m.group(1).splitlines()) + "</ul>", html, flags=re.MULTILINE)
    html = re.sub(r'(^\s*[-*]\s+.*(?:\n\s*[-*]\s+.*)*)\n*', lambda m: "<ul>" + ''.join(f"<li>{remove_list_characters(item.strip())}</li>" for item in m.group(1).splitlines()) + "</ul>", html, flags=re.MULTILINE)
    # html = re.sub(r'^\s*[-*]\s+.*(?:\n\s*[-*]\s+(.*))*', lambda m: "<ul>" + ''.join(f"<li>{item.strip()}</li>" for item in m.group(1).splitlines()) + "</ul>", html, flags=re.MULTILINE)
    # html = re.sub(r'(^\s*[-*]\s+.*(\n\s*[-*]\s+(?:.*))*)', lambda m: "<ul>" + ''.join(f"<li>{item.strip()}</li>" for item in m.group(1).splitlines()) + "</ul>", html, flags=re.MULTILINE)
    
    # Ordered Lists (e.g., 1. item)
    html = re.sub(r'(^\s*\d+\.\s+.*(?:\n\s*\d+\.\s+.*)*)', lambda m: "<ol>" + ''.join(f"<li>{item.strip()[3:]}</li>" for item in m.group(1).splitlines()) + "</ol>", html, flags=re.MULTILINE)

    # Links (e.g., [text](url))
    html = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', html)

    # Horizontal rule
    html = re.sub(r'---', "<hr>", html)

    # Line breaks for single newlines
    # html = re.sub(r'\n$', "<br>", html, flags=re.MULTILINE)
    # html = html.replace("\n", "\n<br>\n")

	# Step 7: Split paragraphs by double newlines and wrap in <p> tags
    paragraphs = re.split(r'\n', html.strip())
    html_paragraphs = [f"<p>{p.strip()}</p>" for p in paragraphs]
    
    # Step 8: Join paragraphs into a single HTML string
    html = "\n".join(html_paragraphs)


    return html

# AI generated version
# def markdown_to_html(markdown_text):
#     html = markdown_text

#     # Headers (e.g., # Header, ## Header)
#     html = re.sub(r'^(#{1,6})\s*(.*)\n*', lambda m: f"<h{len(m.group(1))}>{m.group(2)}</h{len(m.group(1))}>\n", html, flags=re.MULTILINE)
    
#     # Bold (e.g., **bold text**)
#     html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    
#     # Italics (e.g., *italic text*)
#     html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)

#     # Highlight (e.g., ==highlighted text==)
#     html = re.sub(r'==(.*?)==', r'<mark>\1</mark>', html)

#     # Horizontal rule
#     html = re.sub(r'---', "<hr>", html)
    
    
#     # Unordered Lists (e.g., - item or * item)
#     html = re.sub(r'(^\s*[-*]\s+.*(?:\n\s*[-*]\s*.*)*)\n*', lambda m: "<ul>" + ''.join(f"<li>{remove_list_characters(item.strip())}</li>" for item in m.group(1).splitlines()) + "</ul>", html, flags=re.MULTILINE)
    
#     # Ordered Lists (e.g., 1. item)
#     html = re.sub(r'(^\s*\d+\.\s+.*(?:\n\s*\d+\.\s+.*)*)', lambda m: "<ol>" + ''.join(f"<li>{item.strip()[3:]}</li>" for item in m.group(1).splitlines()) + "</ol>", html, flags=re.MULTILINE)

#     # Links (e.g., [text](url))
#     html = re.sub(r'$(.*?)$$(.*?)$', r'<a href="\2">\1</a>', html)


#     # Line breaks for single newlines
#     html = re.sub(r'\n(?=\s*\n)', "\n", html)
    
#     # Split paragraphs properly, only on actual paragraph breaks
#     html_paragraphs = re.split(r'\n(?=\s*\n|$)', html.strip())
    
#     # Line breaks for single newlines and split paragraphs correctly
#     # Use a more precise regex to avoid breaking within inline content like links
#     lines = [line for line in re.split(r'\n+', html) if line.strip()]
#     paragraph_html = [f"<p>{line}</p>" for line in lines]
    
#     # Join all parts into the final HTML structure without top-level p tags
#     html = "\n".join(paragraph_html)
#     return html

main()

