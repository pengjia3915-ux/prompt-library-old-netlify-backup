import urllib.request,urllib.error,hashlib,json,re,concurrent.futures,datetime
from pathlib import Path
root=Path(__file__).resolve().parents[1]
client=root/'dist/client'
base='https://prompt-library-pengjia3915.netlify.app/'
sw=(client/'service-worker.js').read_text(encoding='utf-8')
section=sw[sw.index('const CORE_ASSETS'):sw.index('const NETWORK_FIRST_PATHS')]
paths=[v.removeprefix('./') for v in re.findall(r'"(\./[^"]*)"',section)]
paths+=['data/pose-reference/catalog.json','data/pose-reference/action-prompts.json','data/pose-reference/img/pair60_P030_diag.png','service-worker.js','data/pose-reference/img/full_single_P001_front.png','data/pose-reference/img/full_single_P049_side.png']
def verify(path):
 name=path.split('?')[0] or 'index.html'
 local=(client/name).read_bytes()
 with urllib.request.urlopen(urllib.request.Request(base+path,headers={'Cache-Control':'no-cache','User-Agent':'PromptLibraryReleaseVerification/1.0'}),timeout=35) as r:
  body=r.read();match=hashlib.sha256(body).digest()==hashlib.sha256(local).digest()
  normalized=False
  if name=='pose-reference.html' and not match:
   original=local.decode('utf-8').replace('\r\n','\n').replace('<a href="index.html">',"<a href='/'>")
   normalized=body.decode('utf-8').replace('\r\n','\n')==original
  return {'path':path,'status':r.status,'bytes':len(body),'sha256Matches':match,'expectedNetlifyLinkRewrite':normalized}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: results=list(pool.map(verify,paths))
try:
 with urllib.request.urlopen(base+'api/sync',timeout=25) as r: status=r.status
except urllib.error.HTTPError as e:status=e.code
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'siteId':'b897359f-4774-462c-96f6-4f5263da9211','deployId':json.loads((root/'reports/release-v4.2-deploy.json').read_text())['deployId'],'results':results,'syncUnauthenticatedStatus':status,'sourceRecords':754,'poseGroups':251,'posePromptGroups':len(json.loads((client/'data/pose-reference/action-prompts.json').read_text(encoding='utf-8'))['entries'])}
(root/'reports/release-v4.2-online-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'verified':len(results),'allMatched':all(x['sha256Matches'] or x['expectedNetlifyLinkRewrite'] for x in results),'syncStatus':status}))
assert all(x['sha256Matches'] or x['expectedNetlifyLinkRewrite'] for x in results),results
assert status in [400,401,403],status
