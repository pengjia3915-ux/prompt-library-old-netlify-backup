const button=document.querySelector('#back-to-top');
let scheduled=false;
function place(){
 scheduled=false;
 if(window.scrollY<480||document.querySelector('dialog[open]')){button.hidden=true;return}
 button.hidden=false;
 const size=44,gap=8,right=16;
 const left=innerWidth-right-size;
 const obstacles=[...document.querySelectorAll('button,a,input,select,textarea,[role="button"],.builder-actions,.studio-nav')]
  .filter(el=>el!==button&&!el.closest('[hidden]'))
  .map(el=>el.getBoundingClientRect())
  .filter(r=>r.width&&r.height&&r.bottom>0&&r.top<innerHeight&&r.right>left-gap&&r.left<left+size+gap);
 const mobile=matchMedia('(max-width:760px)').matches;
 const nav=document.querySelector('.studio-nav')?.getBoundingClientRect();
 let bottom=mobile&&nav&&nav.top<innerHeight?innerHeight-nav.top+12:24;
 for(;bottom<innerHeight-64-size;bottom+=8){
  const top=innerHeight-bottom-size;
  if(!obstacles.some(r=>r.bottom>top-gap&&r.top<top+size+gap)){
   button.style.bottom=bottom+'px';return;
  }
 }
 button.hidden=true;
}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(place)}}
button.addEventListener('click',()=>{
 window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
});
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','data-workspace']});
place();
