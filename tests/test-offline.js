const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const sw=fs.readFileSync(path.join(__dirname,"../sw.js"),"utf8");
const origin="https://example.test/game/";
const full=key=>new URL(typeof key==="string"?key:key.url,origin).href;
function simulate(){
 const handlers={},store=new Map(),pending=[];
 let revision="A",offline=false,requests=0;
 const response=(id)=>({ok:true,text:async()=>id,revision:id,clone(){return response(id)}});
 async function fetchNetwork(request){
  requests++;
  if(offline)throw new Error("offline");
  return response(revision+" "+full(request));
 }
 const cache={
  addAll:async urls=>{for(const url of urls)store.set(full(url),await fetchNetwork(url))},
  put:async(request,resp)=>{store.set(full(request),resp)}
 };
 const caches={
  open:async()=>cache,match:async request=>store.get(full(request))||null,
  keys:async()=>["iraqi-imposter-v4-20261023","iraqi-imposter-v5-20261023-deep-audit"],
  delete:async key=>true
 };
 const self={
  addEventListener:(type,fn)=>handlers[type]=fn,
  skipWaiting:async()=>{},
  clients:{claim:async()=>{}}
 };
 vm.runInNewContext(sw,{self,caches,fetch:fetchNetwork,location:{origin:new URL(origin).origin},URL,Response:{error:()=>response("error")}});
 return {
  async install(){
   let promise;handlers.install({waitUntil:p=>promise=p});await promise;
  },
  async request(url,mode="cors"){
   const request={url:full(url),method:"GET",mode};
   let promise;const wait=[];
   handlers.fetch({request,respondWith:p=>promise=p,waitUntil:p=>wait.push(p)});
   const value=await promise;await Promise.all(wait);
   return value.revision;
  },
  setRevision:value=>revision=value,setOffline:value=>offline=value,
  get requests(){return requests},
  get cached(){return store.size}
 };
}
test("release B replaces release A scripts online without changing script URL",async()=>{
 const sw=simulate();await sw.install();
 const script="./game-core.js?v=5",a=await sw.request(script);
 sw.setRevision("B");const before=sw.requests,b=await sw.request(script);
 assert.ok(a.startsWith("A "));assert.ok(b.startsWith("B "));assert.equal(sw.requests,before+1);
 sw.setOffline(true);const offline=await sw.request(script);
 assert.ok(offline.startsWith("B "));
});
test("offline navigation serves pre-cached index and CSS",async()=>{
 const sw=simulate();await sw.install();sw.setOffline(true);
 const page=await sw.request("./","navigate");
 const css=await sw.request("./style.css?v=5");
 assert.ok(page.startsWith("A "));assert.ok(css.startsWith("A "));
});
