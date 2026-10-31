import json,concurrent.futures,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'reports/pose-screening'
rows=json.loads((ROOT/'candidates.json').read_text(encoding='utf-8'))
def get(r):
 p=ROOT/r['缩略图'];p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():return
 for n in range(3):
  try:
   p.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/anhao/ai-pose-gallery-zh/main/'+r['缩略图'],timeout=30).read());return
  except Exception:
   if n==2:raise
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:list(pool.map(get,rows))
print('Screening thumbnails:',len(rows))
