/* Offline first install; network-first verified asset updates while online. */
const CACHE="iraqi-imposter-v5-20261023-deep-audit";
const PREFIX="iraqi-imposter-";
const CORE=["./","./index.html","./style.css?v=5","./word-bank.js?v=5","./game-core.js?v=5","./app.js?v=5","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET"||new URL(request.url).origin!==location.origin)return;
 event.respondWith((async()=>{
   // Network-first avoids permanently retaining stale JS, CSS, or HTML when a release changes.
   try{
     const response=await fetch(request);
     if(response.ok){
       const clone=response.clone();
       event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request.mode==="navigate"?"./index.html":request,clone)).catch(()=>{}));
     }
     return response;
   }catch(error){
     return (await caches.match(request))||(request.mode==="navigate"?await caches.match("./index.html"):null)||Response.error();
   }
 })());
});
