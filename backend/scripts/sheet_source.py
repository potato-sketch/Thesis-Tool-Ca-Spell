"""Reads one tab of the CA-SPELL validation sheet as CSV text, from a Google Sheets link or a CSV file.

The sheet must be viewable by anyone with the link; otherwise download the tab with
File > Download > Comma-separated values and pass the file instead.
"""

import csv
import io
import re
import urllib.parse
import urllib.request
from pathlib import Path

SHEET_URL = re.compile(r"docs\.google\.com/spreadsheets/d/([\w-]+)")
GID = re.compile(r"gid=(\d+)")


def is_sheet_link(source):
    return SHEET_URL.search(source) is not None


def export_url(link, tab=None):
    """CSV address of a tab: the one named `tab`, else the one the link's gid points to."""
    sheet = SHEET_URL.search(link).group(1)
    if tab:
        query = urllib.parse.urlencode({"tqx": "out:csv", "sheet": tab})
        return f"https://docs.google.com/spreadsheets/d/{sheet}/gviz/tq?{query}"
    gid = GID.search(link)
    return f"https://docs.google.com/spreadsheets/d/{sheet}/export?format=csv" + (f"&gid={gid.group(1)}" if gid else "")


def read_source(source, tab=None):
    if is_sheet_link(source):
        with urllib.request.urlopen(export_url(source, tab), timeout=60) as response:
            return response.read().decode("utf-8")
    return Path(source).read_text(encoding="utf-8-sig")


def table_rows(text, first_header, required):
    """Rows below the header row (the one whose first cell is `first_header`), as dicts."""
    rows = csv.reader(io.StringIO(text))
    for header in rows:
        if header and header[0].strip() == first_header:
            break
    else:
        raise ValueError(f'No header row starting with "{first_header}" found. Is this the right tab?')
    header = [cell.strip() for cell in header]
    missing = [column for column in required if column not in header]
    if missing:
        raise ValueError(f"Missing column(s): {', '.join(missing)}")
    for row in rows:
        record = {column: (row[i].strip() if i < len(row) else "") for i, column in enumerate(header)}
        if record[first_header]:
            yield record
