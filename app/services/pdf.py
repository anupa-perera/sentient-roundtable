from datetime import datetime, timezone

import markdown
from playwright.async_api import async_playwright


async def render_findings_pdf(*, session_id: str, question: str, findings_markdown: str) -> bytes:
    """Render markdown findings into a printable HTML template and return PDF bytes."""
    findings_html = markdown.markdown(findings_markdown, extensions=["fenced_code", "tables"])
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    html = f"""
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Sentient Roundtable Findings</title>
    <style>
      body {{
        font-family: "Source Serif 4", Georgia, serif;
        color: #1f2937;
        margin: 0;
        padding: 32px;
        line-height: 1.6;
      }}
      h1, h2, h3 {{
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        line-height: 1.2;
        margin: 20px 0 10px;
      }}
      h1 {{
        font-size: 24px;
        margin-top: 0;
      }}
      h2 {{
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 6px;
      }}
      .meta {{
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        color: #4b5563;
        font-size: 12px;
        margin-bottom: 24px;
      }}
      table {{
        border-collapse: collapse;
        width: 100%;
      }}
      th, td {{
        border: 1px solid #e5e7eb;
        padding: 8px;
        text-align: left;
      }}
      code {{
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }}
    </style>
  </head>
  <body>
    <h1>Sentient Roundtable Findings</h1>
    <div class="meta">
      <div><strong>Session:</strong> {session_id}</div>
      <div><strong>Question:</strong> {question}</div>
      <div><strong>Generated:</strong> {generated_at}</div>
    </div>
    <article>{findings_html}</article>
  </body>
</html>
"""
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page()
        await page.set_content(html, wait_until="networkidle")
        pdf = await page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "16mm", "right": "12mm", "bottom": "16mm", "left": "12mm"},
        )
        await browser.close()
    return pdf
