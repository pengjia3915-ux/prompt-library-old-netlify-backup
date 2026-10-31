import json, urllib.request, concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'data/pose-reference'
data=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))
paths=[r[k] for r in data['records'] for k in ['缩略图','原图']]
def get(p):
 target=ROOT/p
 if target.exists() and target.stat().st_size>100:return
 target.parent.mkdir(parents=True,exist_ok=True)
 for attempt in range(3):
  try:
   blob=urllib.request.urlopen('https://raw.githubusercontent.com/anhao/ai-pose-gallery-zh/main/'+p,timeout=35).read()
   if len(blob)<100:raise ValueError('empty image')
   target.write_bytes(blob);return
  except Exception:
   if attempt==2:raise
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 list(pool.map(get,paths))
print('Downloaded',len(paths),'assets; bytes',sum((ROOT/p).stat().st_size for p in paths))
