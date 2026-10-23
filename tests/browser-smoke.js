/* Optional real Chromium smoke tests. Run: npm i --no-save playwright@1.56.1 && npx playwright install chromium && node tests/browser-smoke.js */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium,webkit}=require("playwright");
const browserName=process.env.TEST_BROWSER||"chromium";
const root=path.join(__dirname,"..");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".webmanifest":"application/manifest+json"};
const server=http.createServer((req,res)=>{
 const requested=decodeURIComponent((req.url||"/").split("?")[0]);
 const target=requested==="/"?"/index.html":requested;
 const absolute=path.resolve(root,"."+target);
 if(!absolute.startsWith(root+path.sep)){res.writeHead(403).end();return}
 try{
  const data=fs.readFileSync(absolute);
  res.setHeader("Content-Type",types[path.extname(absolute)]||"application/octet-stream");
  res.setHeader("Cache-Control","no-cache");
  res.writeHead(200);res.end(data);
 }catch(e){res.writeHead(404);res.end("Not found")}
});
async function launch(){
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const port=server.address().port;
 const engine={chromium,webkit}[browserName];
 if(!engine)throw Error("Unknown engine "+browserName);
 const browser=await engine.launch({headless:true,args:browserName==="chromium"?["--no-sandbox"]:[]});
 return {browser,url:"http://127.0.0.1:"+port+"/"};
}
const waitFor=async(page)=>{await page.locator('[data-action="start"]').waitFor({timeout:10000})};
async function setupPlayerCount(page,count){
 for(let i=5;i<count;i++)await page.locator('[data-action="increase"]').click();
 for(let i=5;i>count;i--)await page.locator('[data-action="decrease"]').click();
}
async function playOneRound(page,count){
 await page.locator('[data-action="start"]').click();
 assert.match(await page.locator("#app").innerText(),/سلّم التلفون/);
 let spyCards=0,regular=0;
 for(let i=0;i<count;i++){
  await page.locator('[data-action="reveal"]').click();
  const txt=await page.locator("#app").innerText();
  if(txt.includes("إنت الدخيل!"))spyCards++;else regular++;
  await page.locator('[data-action="next"]').click();
 }
 assert.equal(spyCards,1);
 assert.equal(regular,count-1);
 assert.match(await page.locator("#app").innerText(),/منو يسأل من/);
 for(let i=1;i<count;i++)await page.locator('[data-action="nextQuestion"]').click();
 await page.locator('[data-action="endDiscussion"]').click();
 await page.locator('[data-action="showGuess"]').click();
 assert.equal(await page.locator('[data-action="guess"]').count(),6);
 await page.locator('[data-action="guess"]').first().click();
 assert.match(await page.locator("#app").innerText(),/نهاية الجولة/);
 await page.locator('[data-action="newRound"]').click();
 assert.match(await page.locator("#app").innerText(),/جاهزين للسالفة/);
}
(async()=>{
 let browser;
 try{
  const started=await launch();browser=started.browser;const url=started.url;
  for(const width of [320,375,430,1280]){
   const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:"allow"});
   const page=await context.newPage(),errors=[];
   page.on("dialog",dialog=>dialog.accept());
   page.on("pageerror",err=>errors.push(err.message));
   await page.goto(url,{waitUntil:"networkidle"});
   await waitFor(page);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert.ok(overflow<=2,"Horizontal overflow "+overflow+"px at "+width);
   await setupPlayerCount(page,width===320?3:width===375?5:width===430?7:10);
   await playOneRound(page,width===320?3:width===375?5:width===430?7:10);
   assert.equal(errors.length,0,"Page errors: "+JSON.stringify(errors));
   console.log("PASS viewport "+width+"px (gameplay, no overflow)");
   await context.close();
  }
  {
   const context=await browser.newContext({viewport:{width:375,height:720},serviceWorkers:"allow"});
   const page=await context.newPage();page.on("dialog",dialog=>dialog.accept());
   await page.goto(url,{waitUntil:"networkidle"});await waitFor(page);
   await page.locator('[data-action="start"]').click();
   await page.locator('[data-action="reveal"]').click();
   await page.reload({waitUntil:"networkidle"});
   assert.equal(await page.locator('[data-action="reveal"]').count(),1,"Restored card must be hidden");
   console.log("PASS interrupted card recovery");
   const ready=await page.evaluate(async()=>{if(!("serviceWorker" in navigator))return false;await navigator.serviceWorker.ready;return true});
   assert.ok(ready,"Service worker did not register");
   await context.setOffline(true);
   await page.reload({waitUntil:"domcontentloaded"});
   await page.locator("#app").getByText("سلّم التلفون", {exact:false}).waitFor({timeout:15000});
   console.log("PASS offline reload after pre-cache");
   await context.close();
  }
  // Exercise real browser JSON backup/restore, including persisted scores and used words.
  {
   const context=await browser.newContext({viewport:{width:390,height:840},acceptDownloads:true});
   const page=await context.newPage();
   page.on("dialog",d=>d.accept());
   await page.goto(url,{waitUntil:"networkidle"});await waitFor(page);
   const [download]=await Promise.all([
     page.waitForEvent("download"),
     page.locator('[data-action="export"]').click()
   ]);
   const original=JSON.parse(fs.readFileSync(await download.path(),"utf8"));
   assert.equal(original.format,"iraqi-imposter-v4-save");
   assert.ok(original.state.roster.length>=3);
   await page.locator('[data-action="start"]').click();
   const afterStart=await page.evaluate(()=>JSON.parse(localStorage.getItem("imposterGameV4")));
   assert.equal(afterStart.used.length,original.state.used.length+1);
   for(let i=0;i<5;i++){await page.locator('[data-action="reveal"]').click();await page.locator('[data-action="next"]').click();}
   await page.locator('[data-action="forceEnd"]').click();
   await page.locator('[data-action="showGuess"]').click();
   await page.locator('[data-action="guess"]').first().click();
   await page.locator('[data-action="newRound"]').click();
   await page.locator('#backupFile').setInputFiles({name:"restore.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(original))});
   await page.waitForTimeout(200);
   const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem("imposterGameV4")));
   assert.equal(restored.used.length,original.state.used.length);
   assert.equal(restored.active,null);
   console.log("PASS JSON save/export and restore");
   await context.close();
  }
  {
   const context=await browser.newContext({viewport:{width:390,height:840}});
   const a=await context.newPage();a.on("dialog",d=>d.accept());
   await a.goto(url,{waitUntil:"networkidle"});await waitFor(a);
   await a.locator('[data-action="start"]').click();
   const before=await a.evaluate(()=>JSON.parse(localStorage.getItem("imposterGameV4")));
   const b=await context.newPage();b.on("dialog",d=>d.accept());
   await b.goto(url,{waitUntil:"networkidle"});
   assert.ok((await b.locator("#app").innerText()).includes("اللعبة مفتوحة بتبويب ثاني"));
   await b.locator('[data-action="takeLock"]').click();
   const after=await b.evaluate(()=>JSON.parse(localStorage.getItem("imposterGameV4")));
   assert.ok(after.used.includes(before.active.word));
   console.log("PASS second-tab ownership and safe takeover");
   await context.close();
  }
  console.log("ALL "+browserName.toUpperCase()+" SMOKE TESTS PASSED");
 }catch(e){
  console.error(e.stack||e);process.exitCode=1;
 }finally{
  if(browser)await browser.close();
  server.close();
 }
})();
