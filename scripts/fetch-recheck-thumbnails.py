import json,urllib.request,concurrent.futures,shutil
from pathlib import Path
APP=Path(__file__).resolve().parents[1];ROOT=APP/'reports/pose-recheck'
rows=json.loads((ROOT/'candidates.json').read_text(encoding='utf-8'))
def get(r):
 p=ROOT/r['缩略图'];p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():return
 old=APP/'reports/pose-screening'/r['缩略图']
 if old.exists():shutil.copy2(old,p);return
 for attempt in range(3):
  try:p.write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/anhao/ai-pose-gallery-zh/main/'+r['缩略图'],timeout=30).read());return
  except Exception:
   if attempt==2:raise
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:list(pool.map(get,rows))
print('Recheck thumbnails:',len(rows))
