const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const core=require("../game-core.js");
const appScript=fs.readFileSync(path.join(__dirname,"../app.js"),"utf8");
const bankWindow={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../word-bank.js"),"utf8"),{window:bankWindow});
const bank=bankWindow.IMPOSTER_BANK;
function memory(init={}){
 const db=new Map(Object.entries(init));
 return {getItem:k=>db.has(k)?db.get(k):null,setItem:(k,v)=>db.set(k,String(v)),removeItem:k=>db.delete(k),dump:()=>Object.fromEntries(db)};
}
function launch(options={}){
 const localStorage=options.localStorage||memory(),sessionStorage=options.sessionStorage||memory(),listeners={},docEvents={},time={now:options.now||1000000};
 const listenersOnApp={},fields={},timerCallbacks=[];
 let html="";
 const app={
  get innerHTML(){return html},
  set innerHTML(text){
   html=text;
   const matches=[...text.matchAll(/id="player-(\d+)"[^>]*value="([^"]*)"/g)];
   for(const m of matches)fields["player-"+m[1]]={value:m[2]};
   if(text.includes('id="cat"'))fields.cat={value:options.category||"عشوائي"};
  },
  querySelector:()=>({focus:()=>{}}),
  addEventListener:(type,callback)=>{listenersOnApp[type]=callback},
  fireAction:(action,extra={})=>{
   const target={getAttribute:key=>key==="data-action"?action:extra[key]||null,closest:()=>target};
   listenersOnApp.click({target});
  },
  setPlayer:(index,value)=>{fields["player-"+index].value=value},
  setCat:value=>{fields.cat.value=value;listenersOnApp.change({target:{id:"cat",value}})},
  triggerFocusOut:index=>listenersOnApp.focusout({target:{matches:()=>true}}),
  get html(){return html}
 };
 const doc={
  getElementById:key=>key==="app"?app:(fields[key]||null),
  addEventListener:(name,fn)=>{docEvents[name]=fn},
  hidden:false
 };
 const window={
  ImposterCore:options.noCore?null:core,IMPOSTER_BANK:options.noBank?null:bank,
  crypto:{getRandomValues:a=>{a[0]=Math.floor(Math.random()*4294967296);return a}},
  confirm:(message)=>{options.confirmations?.push(message);return options.confirm!==false},
  addEventListener:(name,fn)=>{listeners[name]=fn},
  setInterval:fn=>{timerCallbacks.push(fn);return timerCallbacks.length}
 };
 const navigator={};
 const fakeDate={now:()=>time.now};
 vm.runInNewContext(appScript,{window,document:doc,navigator,localStorage,sessionStorage,
   Date:fakeDate,Math,Uint32Array,JSON,String,Number,Array,Set,Object,Error,console});
 return {app,localStorage,sessionStorage,window,fields,now:t=>{time.now=t},tick:()=>timerCallbacks.forEach(fn=>fn()),sendWindowEvent:(name,obj)=>listeners[name]?.(obj),getState:()=>JSON.parse(localStorage.getItem("imposterGameV4")||"null")};
}
function roleIndex(state){return state.roster.findIndex(p=>p.id===state.active.spyId)}
test("initial screen and 3-10 player variants render",()=>{
 for(let n=3;n<=10;n++){
  const h=launch();
  for(let i=5;i<n;i++)h.app.fireAction("increase");
  for(let i=5;i>n;i--)h.app.fireAction("decrease");
  assert.equal(h.getState().roster.length,n);
  assert.ok(h.app.html.includes("جاهزين للسالفة؟"));
  h.app.fireAction("start");
  assert.equal(h.getState().active.phase,"pass");
 }
});
test("pass/reveal strictly hides impostor hints from ordinary players",()=>{
 const h=launch(),secretExpected="أسئلة ممكن تساعدك:";
 h.app.fireAction("start");
 const selected=h.getState().active,spy=roleIndex(h.getState());
 for(let i=0;i<5;i++){
  h.app.fireAction("reveal");
  assert.equal(h.app.html.includes(secretExpected),i===spy);
  assert.equal(h.app.html.includes(selected.word),i!==spy);
  h.app.fireAction("next");
 }
 assert.equal(h.getState().active.phase,"talk");
 assert.ok(h.app.html.includes("السؤال 1"));
 assert.equal(h.app.html.includes("إنهاء مبكر"),true);
 for(let i=1;i<5;i++)h.app.fireAction("nextQuestion");
 h.app.fireAction("endDiscussion");
 assert.equal(h.getState().active.phase,"guess-pass");
 h.app.fireAction("showGuess");
 assert.equal(h.getState().active.phase,"guess");
 h.app.fireAction("guess",{"data-index":"0"});
 assert.equal(h.getState().active.phase,"result");
 const total=Object.values(h.getState().scores).reduce((a,b)=>a+b,0);
 assert.ok([3,8].includes(total));
 h.app.fireAction("newRound");
 assert.equal(h.getState().active,null);
});
test("refresh recovers active game but never displays the previously revealed card",()=>{
 const shared=memory(),tab=memory(),h=launch({localStorage:shared,sessionStorage:tab});
 h.app.fireAction("start");
 const word=h.getState().active.word;
 h.app.fireAction("reveal");
 assert.equal(h.getState().active.phase,"reveal");
 h.sendWindowEvent("pagehide"); // Reload releases the old document's lease.
 const after=launch({localStorage:shared,sessionStorage:tab});
 assert.equal(after.getState().active.phase,"pass");
 assert.equal(after.getState().active.word,word);
 assert.equal(after.getState().used.length,1);
 assert.ok(!after.app.html.includes(word));
});
test("other tab blocked, explicit takeover transfers ownership",()=>{
 const storage=memory(),a=launch({localStorage:storage}),b=launch({localStorage:storage,confirmations:[]});
 assert.ok(b.app.html.includes("اللعبة مفتوحة بتبويب ثاني"));
 b.app.fireAction("start");assert.equal(b.getState().round,0);
 b.app.fireAction("takeLock");
 assert.ok(b.app.html.includes("جاهزين للسالفة؟"));
 a.tick();
 assert.ok(a.app.html.includes("اللعبة مفتوحة بتبويب ثاني"));
});
test("duplicate names reject start; reserved names persist by player id",()=>{
 const h=launch();
 h.app.setPlayer(0,"علي");h.app.setPlayer(1,"علي");
 h.app.fireAction("start");assert.equal(h.getState().active,null);
 assert.ok(h.app.html.includes("Duplicate player name"));
 const j=launch();
 ["constructor","__proto__","toString"].forEach((name,i)=>j.app.setPlayer(i,name));
 j.app.fireAction("start");
 assert.ok(j.getState().active);
 assert.equal(j.getState().roster[0].name,"constructor");
});
test("leaving before seeing a card restores the word; after reveal consumes it",()=>{
 const h=launch();
 h.app.fireAction("start");const word=h.getState().active.word;
 h.app.fireAction("abandon");assert.ok(!h.getState().used.includes(word));
 h.app.fireAction("start");const exposed=h.getState().active.word;
 h.app.fireAction("reveal");h.app.fireAction("next");
 h.app.fireAction("abandon");assert.ok(h.getState().used.includes(exposed));
});
test("corrupted old score JSON and missing word bank provide usable states",()=>{
 const h=launch({localStorage:memory({imposterScores:"null"})});
 assert.ok(h.app.html.includes("جاهزين للسالفة؟"));
 const missing=launch({noBank:true});
 assert.ok(missing.app.html.includes("تعذّر تحميل اللعبة"));
});
test("word editor turns off words without invalid guessing pools",()=>{
 const h=launch();
 h.app.fireAction("review");
 assert.ok(h.app.html.includes("مراجعة الكلمات"));
 h.app.fireAction("toggleWord",{"data-word":"قطو"});
 assert.ok(h.getState().blocked.includes("قطو"));
 h.app.fireAction("backSetup");
 h.app.fireAction("start");
 assert.notEqual(h.getState().active.word,"قطو");
});
test("clock uses saved deadline and expire/extend flow",()=>{
 const h=launch({now:1000000});
 h.app.fireAction("start");
 for(let i=0;i<5;i++){h.app.fireAction("reveal");h.app.fireAction("next")}
 const deadline=h.getState().active.deadline;
 assert.equal(deadline,1000000+180000);
 h.now(deadline+1000);h.tick();
 assert.ok(h.app.html.includes("خلص الوقت"));
 h.app.fireAction("extend");
 assert.equal(h.getState().active.deadline,deadline+61000);
});
