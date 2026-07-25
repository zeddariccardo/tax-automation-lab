#!/usr/bin/env python3
"""Static regression checks for the Tax Automation Lab site package."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from bs4 import BeautifulSoup
import re, sys, hashlib, json

ROOT=Path(__file__).resolve().parents[1]
BASE='https://taxautomationlab.com'
IGNORE_PREFIXES=('/assets/','/favicon.ico','/site.webmanifest','/browserconfig.xml','/cdn-cgi/')
issues=[]
html_files=sorted(ROOT.rglob('*.html'))

def local_target(path):
    if path=='/': return ROOT/'index.html'
    p=ROOT/path.lstrip('/')
    if path.endswith('/'): p=p/'index.html'
    return p

for p in html_files:
    rel=p.relative_to(ROOT).as_posix()
    text=p.read_text(encoding='utf-8')
    if re.match(r'^\s*html\s*(?:<!doctype|<html)',text,re.I): issues.append(f'{rel}: stray html text before root element')
    if re.search(r'[\u200b\u200c\u200d\ufeff]{20,}',text): issues.append(f'{rel}: suspicious long zero-width sequence')
    soup=BeautifulSoup(text,'html.parser')
    if not soup.html: issues.append(f'{rel}: missing html root')
    for x in soup.select('[data-lang],[data-tal-lang]'):
        if x.name!='a' or not x.get('href'): issues.append(f'{rel}: language control is not a real link')
    canonical=soup.find('link',rel=lambda v:v and 'canonical' in v)
    og=soup.find('meta',property='og:url')
    if canonical and og and canonical.get('href')!=og.get('content'):
        issues.append(f'{rel}: canonical and og:url differ')
    if rel not in ('404.html','it/index.html','guide/index.html'):
        for selector,label in [('meta[name="author"]','author'),('meta[property="og:image"]','og:image'),('meta[name="twitter:card"]','twitter card')]:
            if not soup.select_one(selector): issues.append(f'{rel}: missing {label}')
    for a in soup.find_all(['a','link','script','img'],href=True)+soup.find_all(['img','script'],src=True):
        u=a.get('href') or a.get('src')
        if not u or u.startswith(('#','mailto:','tel:','data:','javascript:')): continue
        parsed=urlsplit(u)
        if parsed.scheme in ('http','https'):
            if parsed.netloc not in ('taxautomationlab.com','www.taxautomationlab.com'): continue
            path=unquote(parsed.path)
        elif parsed.scheme: continue
        else: path=unquote(parsed.path)
        if not path.startswith('/'):
            target=(p.parent/path).resolve()
            try: target.relative_to(ROOT.resolve())
            except ValueError: issues.append(f'{rel}: path escapes package: {u}'); continue
        else:
            if path.startswith(IGNORE_PREFIXES): continue
            target=local_target(path)
        if not target.exists(): issues.append(f'{rel}: missing internal target {u}')

# Ensure operational scripts in the tool pages have not been unexpectedly removed.
for rel in ('tools/financial-statement/index.html','tools/tfa-client-file/index.html','tools/lipe/index.html'):
    p=ROOT/rel; soup=BeautifulSoup(p.read_text(encoding='utf-8'),'html.parser')
    js=sum(len((x.string or x.get_text() or '')) for x in soup.find_all('script') if (x.get('type') or '').lower()!='application/ld+json')
    if js<500_000: issues.append(f'{rel}: operational JavaScript unexpectedly small ({js} bytes)')


# v6.12.0: reject suspicious long zero-width watermark sequences.
ZERO_WIDTH_FORBIDDEN = re.compile(r'[\u200b\u200c\ufeff]{20,}')
for _p in ROOT.rglob('*.html'):
    _t = _p.read_text(encoding='utf-8', errors='replace')
    if ZERO_WIDTH_FORBIDDEN.search(_t):
        issues.append(f'{_p.relative_to(ROOT)}: suspicious long zero-width sequence')

if issues:
    print(f'FAILED: {len(issues)} issue(s)')
    for x in issues: print('-',x)
    sys.exit(1)
print(f'OK: {len(html_files)} HTML files checked; no structural regressions detected.')
