import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function createPreviewServer({root=appRoot,syncEndpoint='https://prompt-library-pengjia3915.netlify.app/api/sync'}={}) {
  return createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/api/sync') {
      if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end();return;}
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
      try {
        const chunks=[];let length=0;
        for await(const chunk of req){length+=chunk.length;if(length>1_600_000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
        const headers={};
        for(const key of ['authorization','content-type','x-sync-id','x-sync-auth'])if(req.headers[key])headers[key]=req.headers[key];
        const target=new URL(syncEndpoint);target.search=url.search;
        const upstream=await fetch(target,{method:req.method,headers,body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:AbortSignal.timeout(25000)});
        res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'});
        res.end(Buffer.from(await upstream.arrayBuffer()));
      } catch {res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'无法连接原同步服务，请检查网络后重试；本机数据仍保留。'}));}
      return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    try {
      const rel=decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const resolved=path.resolve(root,rel||'index.html');
      if(!resolved.startsWith(root+path.sep)||rel.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end();return;}
      const info=await stat(resolved);const file=info.isDirectory()?path.join(resolved,'index.html'):resolved;
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
      const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PROMPT_PREVIEW_PORT||4312);
  createPreviewServer().listen(port,'127.0.0.1',()=>console.log(`Prompt Library v4: http://127.0.0.1:${port}/`));
}
