/* منو الدخيل؟ | accessible single-phone UI and durable local game session */
(function(root){
"use strict";
const APP_VERSION="1.5.0",KEY="imposterGameV4",LOCK_KEY="imposterOwnerV4";
const core=root.ImposterCore,bank=root.IMPOSTER_BANK,app=document.getElementById("app");
const safeParse=x=>{try{return JSON.parse(x)}catch{return null}};
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const htmlButton=(text,action,cls,more)=>'<button type="button" class="'+(cls||"")+'" data-action="'+action+'" '+(more||"")+'>'+text+'</button>';
const activeName=id=>state.roster.find(p=>p.id===id)?.name||"اللاعب";
const rand=()=>{
  if(root.crypto?.getRandomValues){
    const a=new Uint32Array(1);root.crypto.getRandomValues(a);
    return a[0]/4294967296;
  }
  return Math.random();
};
let state,locked=false,mode="setup",notice="",storageOk=true,remainingPrev=-1,savedRevision=0;
// A duplicated browser tab may clone sessionStorage, so this identifier must NEVER be stored there.
const tabId="document-"+(root.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+"-"+Date.now());
function lockInfo(){try{return safeParse(localStorage.getItem(LOCK_KEY))}catch{return null}}
function takeOwnership(force){
 const prev=lockInfo(),now=Date.now();
 if(prev&&prev.tab!==tabId&&now-prev.at<18000&&!force){locked=true;return false}
 try{
   localStorage.setItem(LOCK_KEY,JSON.stringify({tab:tabId,at:now}));
   const own=lockInfo();locked=!!(own&&own.tab!==tabId);
 }catch(e){locked=false;storageOk=false}
 return !locked;
}
function heartbeat(){
 if(!core||!bank||locked)return;
 const prev=lockInfo();
 if(prev&&prev.tab!==tabId&&Date.now()-prev.at<18000){
   locked=true;notice="اللعبة مفتوحة بتبويب ثاني";render();return;
 }
 takeOwnership(false);
}
function persist(){
 if(locked)throw Error("اللعبة مفتوحة بتبويب ثاني. لا تحفظ من نسخة قديمة.");
 const owner=lockInfo();
 if(owner&&owner.tab!==tabId){locked=true;throw Error("تم نقل اللعبة لتبويب آخر. حدث الصفحة للمتابعة.");}
 let previous;
 try{previous=safeParse(localStorage.getItem(KEY))}
 catch(e){storageOk=false;throw Error("حفظ المتصفح مو متاح؛ ما نكدر نبدأ جولة جديدة بأمان.")}
 const actual=previous&&Number.isSafeInteger(previous.revision)?previous.revision:0;
 if(actual!==savedRevision){
   locked=true;throw Error("اللعبة اتغيّرت من تبويب ثاني. حتى ما نضيّع الكلمات وقفنا الحفظ.");
 }
 const nextRevision=actual+1;
 state.revision=nextRevision;
 try{
   localStorage.setItem(KEY,JSON.stringify(state));
   const checked=safeParse(localStorage.getItem(KEY));
   const ownerAfter=lockInfo();
   if(!checked||checked.revision!==nextRevision||ownerAfter&&ownerAfter.tab!==tabId){
     locked=true;throw Error("صار تضارب بالحفظ؛ افتح آخر نسخة محفوظة قبل ما تكمل.");
   }
   savedRevision=nextRevision;storageOk=true;
 }catch(e){storageOk=false;throw Error("تعذّر حفظ اللعبة: "+(e.message||"مساحة المتصفح ممتلئة"))}
}
function legacyCycle(){try{return safeParse(localStorage.getItem("imposterCycleV3"))}catch{return null}}
function legacyScores(){try{return safeParse(localStorage.getItem("imposterScores"))}catch{return null}}
function load(){
 const saved=(()=>{try{return safeParse(localStorage.getItem(KEY))}catch{return null}})();
 savedRevision=saved&&Number.isSafeInteger(saved.revision)?saved.revision:0;
 state=core.initial(bank,saved,legacyCycle(),legacyScores());
 if(!locked)persist(); // Migrate once, and re-hide a revealed card before anyone sees the screen.
 mode=state.active?"game":"setup";
}
function rootError(msg){
 if(!app)return;
 app.innerHTML='<div class="panel"><h2 tabindex="-1">تعذّر تحميل اللعبة</h2><p>'+esc(msg||"ملفات اللعبة ما تحمّلت بشكل صحيح")+'</p><button type="button" onclick="location.reload()">إعادة المحاولة</button></div>';
}
if(!app)return;
if(!core||!bank){rootError("افحص الاتصال بالإنترنت وحاول تحدث الصفحة. إذا كنت تستعملها أول مرة، افتحها مع الإنترنت.");return}
try{core.catalogue(bank);takeOwnership(false);load()}
catch(e){rootError("معلومات اللعبة المحفوظة غير صالحة. جرّب إعادة التحميل. "+e.message);return}
function show(text){notice=text;render()}
function commit(next){
 const old=state;state=next;
 try{persist()}catch(e){state=old;throw e}
 mode=state.active?"game":"setup";remainingPrev=-1;render();
}
function commitError(fn){
 try{fn()}catch(e){show(e.message||"صار خطأ غير متوقع")}
}
function formatSeconds(s){
 const min=Math.floor(s/60),sec=s%60;
 return String(min).padStart(2,"0")+":"+String(sec).padStart(2,"0");
}
function countFor(category){return core.remaining(state,bank,category)}
function panel(html){
 app.innerHTML='<div class="panel">'+(notice?'<p class="notice" role="status">'+esc(notice)+'</p>':"")+html+'</div>';
 notice="";
 const heading=app.querySelector("h2");
 if(heading&&typeof heading.focus==="function")heading.focus({preventScroll:true});
}
function rosterInput(){
 return state.roster.map((p,i)=>'<label for="player-'+i+'">اللاعب '+(i+1)+'</label><input id="player-'+i+'" data-player="'+i+'" maxlength="28" autocomplete="off" value="'+esc(p.name)+'">').join("");
}
function scoreBoard(){
 return '<div class="stack scoreboard"><h3>لوحة النقاط</h3>'+state.roster.map(p=>'<div class="scoreline"><span>'+esc(p.name)+'</span><strong>'+Number(state.scores[p.id]||0)+' نقطة</strong></div>').join("")+'</div>';
}
function setupView(){
 let categories=bank.categories.map(c=>'<option value="'+esc(c.name)+'" '+(state.category===c.name?"selected":"")+'>'+esc(c.name)+'</option>').join("");
 panel('<span class="pill">لعبة عراقية • '+APP_VERSION+'</span><h2 tabindex="-1">جاهزين للسالفة؟</h2><p>الكل يعرف الكلمة إلا الدخيل. سلّموا التلفون لشخص واحد كل مرة.</p>'+
 '<label for="cat">موضوع الجولة</label><select id="cat"><option value="عشوائي" '+(state.category==="عشوائي"?"selected":"")+'>عشوائي</option>'+categories+'</select>'+
 '<p class="muted" id="counter">باقي '+countFor(state.category)+' كلمة جديدة بدون تكرار</p>'+
 '<label>عدد اللاعبين</label><div class="choices">'+htmlButton("− احذف لاعب","decrease","secondary")+htmlButton("+ أضف لاعب","increase")+'</div>'+
 '<span class="pill">'+state.roster.length+' لاعبين</span><div class="stack">'+rosterInput()+'</div>'+
 htmlButton("يلا نبدأ","start")+
 htmlButton("مراجعة الكلمات","review","secondary")+
 htmlButton("تصفير النقاط","clearScores","secondary")+
 scoreBoard()+
 '<p class="muted">ماكو حساب. الحفظ على جهازك فقط. الدخيل +٣ إذا عرف الكلمة، وبقية اللاعبين +٢ إذا ما عرفها.</p>');
}
function passView(a){
 panel('<span class="pill">الجولة '+state.round+' • '+(a.index+1)+' من '+state.roster.length+'</span>'+
 '<h2 tabindex="-1">سلّم التلفون إلى</h2><div class="name">'+esc(state.roster[a.index].name)+'</div>'+
 '<p>لا تخلي أحد يشوف البطاقة، إلا صاحب الدور.</p>'+
 htmlButton("اكشف بطاقتي","reveal")+
 htmlButton("إلغاء الجولة","abandon","secondary"));
}
function revealView(a){
 const isSpy=state.roster[a.index].id===a.spyId;
 let details=isSpy
 ? '<div class="secret">إنت الدخيل!</div><p>ما تعرف الكلمة. المعلومة الجاية إلك وحدك:</p><div class="hint">'+esc(a.hint)+'</div><p>أسئلة ممكن تساعدك:</p><div class="stack">'+a.questions.map(q=>'<div class="pill wrap">'+esc(q)+'</div>').join("")+'</div>'
 : '<p>الكلمة السرية:</p><div class="secret">'+esc(a.word)+'</div><p>اسأل وجاوب بشكل طبيعي. لا تفضح الكلمة!</p>';
 panel('<span class="pill">'+esc(state.roster[a.index].name)+'</span><h2 tabindex="-1">بطاقتك الخاصة</h2>'+
 details+htmlButton("خفي البطاقة ومرّر التلفون","next"));
}
function talkView(a){
 const left=core.secondsLeft(state,Date.now()),expired=left===0;
 let content='<span class="pill">وقت السوالف • السؤال '+a.askTurn+'</span><h2 tabindex="-1">منو يسأل من؟</h2>'+
 '<div class="ask-pair"><strong>'+esc(activeName(a.asker))+'</strong><span>يسأل</span><strong>'+esc(activeName(a.target))+'</strong></div>'+
 '<p>اسأله عن الكلمة بدون ما تنطقها. انتبه للإجابات!</p>'+
 '<div id="clock" class="secret timer" aria-label="الوقت المتبقي">'+formatSeconds(left)+'</div>';
 if(expired)content+='<p class="notice">خلص الوقت. اختاروا إذا تكملون دقيقة أو تروحون للتخمين.</p>'+
 htmlButton("نكمل دقيقة","extend","secondary");
 else content+=htmlButton("السؤال التالي","nextQuestion");
 content+=htmlButton("إنهاء السوالف والتخمين","endDiscussion","secondary")+
 htmlButton("إلغاء الجولة","abandon","quiet");
 panel(content);
}
function guessPassView(a){
 panel('<span class="pill">دور الدخيل</span><h2 tabindex="-1">سلّم التلفون إلى</h2><div class="name">'+esc(activeName(a.spyId))+
 '</div><p>الدخيل عنده محاولة وحدة من ٦ كلمات. البقية لا يساعدوه.</p>'+
 htmlButton("شوف خيارات التخمين","showGuess"));
}
function guessView(a){
 panel('<span class="pill">تحدي الدخيل</span><h2 tabindex="-1">شنو الكلمة السرية؟</h2><p>اختار وحدة من الكلمات الستة.</p>'+
 '<div class="choices">'+a.options.map((w,i)=>htmlButton(esc(w),"guess","secondary",'data-index="'+i+'"')).join("")+'</div>');
}
function resultView(a){
 panel('<span class="pill">نهاية الجولة '+state.round+'</span><h2 tabindex="-1">'+(a.correct?"الدخيل خمّنها صح!":"الفريق فاز!")+'</h2>'+
 '<p>الكلمة كانت:</p><div class="secret">'+esc(a.word)+'</div>'+
 '<p>'+(a.correct?"الدخيل +٣ نقاط":"كل لاعب مو دخيل +٢ نقاط")+'</p>'+scoreBoard()+
 htmlButton("جولة جديدة","newRound"));
}
function reviewView(){
 const byCat=bank.categories.map(c=>{
 const body=c.groups.map(group=>'<div class="word-grid">'+group.words.map(word=>{
 const excluded=state.blocked.includes(word);
 return '<button type="button" class="word-chip '+(excluded?"excluded":"")+'" data-action="toggleWord" data-word="'+esc(word)+'" aria-pressed="'+excluded+'">'+esc(word)+(excluded?" ×":" ✓")+'</button>';
 }).join("")+'</div>').join("");
 return '<details><summary>'+esc(c.name)+' ('+c.groups.reduce((n,g)=>n+g.words.length,0)+')</summary>'+body+'</details>';
 }).join("");
 panel('<h2 tabindex="-1">مراجعة الكلمات</h2><p>اضغط أي كلمة حتى توقف ظهورها، واضغط مرة ثانية حتى ترجع. المجموعة تحتاج ٦ كلمات على الأقل حتى تدخل بالاختيار.</p>'+
 '<p class="muted">متبقي '+countFor("عشوائي")+' كلمة قابلة للاستخدام</p>'+byCat+
 htmlButton("رجوع للإعدادات","backSetup","secondary"));
}
function exhaustedView(){
 panel('<h2 tabindex="-1">خلصت الكلمات الجديدة!</h2><p>ما راح نكرر الكلمات بدون موافقتك. اختاروا موضوع ثاني أو رجّعوا الكلمات للبداية.</p>'+
 htmlButton("اختار موضوع ثاني","backSetup")+
 htmlButton("إعادة جميع الكلمات","resetWords","secondary"));
}
function lockedView(){
 panel('<h2 tabindex="-1">اللعبة مفتوحة بتبويب ثاني</h2><p>حتى ما تنعاد الكلمات أو ينخرب الحفظ، استخدموا تبويب واحد.</p>'+
 htmlButton("المحاولة مرة ثانية","retryLock")+
 htmlButton("نقل اللعبة لهنا","takeLock","secondary"));
}
function render(){
 if(locked){lockedView();return}
 if(!storageOk)notice=notice||"الحفظ المحلي غير متاح. لا تحدث الصفحة.";
 if(mode==="review"){reviewView();return}
 if(mode==="exhausted"){exhaustedView();return}
 const a=state.active;
 if(!a){setupView();return}
 if(a.phase==="pass")passView(a);
 else if(a.phase==="reveal")revealView(a);
 else if(a.phase==="talk")talkView(a);
 else if(a.phase==="guess-pass")guessPassView(a);
 else if(a.phase==="guess")guessView(a);
 else if(a.phase==="result")resultView(a);
}
function readNames(){
 return state.roster.map((p,i)=>document.getElementById("player-"+i)?.value??p.name);
}
function saveRoster(){
 if(state.active)return true;
 const list=readNames(),previous=state;
 try{
  state=core.updateRoster(state,list);
  // Legacy migration happens ONLY on the initial V4 load, never on a zero score.
  persist();return true;
 }catch(e){state=previous;notice=e.message;render();return false}
}
function handle(action,target){
 if(locked){
  if(action==="retryLock"||action==="takeLock"){
   if(action==="takeLock"&&!root.confirm("تنقل اللعبة لهالتبويب؟ التبويب الثاني راح يتوقف."))return;
   if(takeOwnership(action==="takeLock")){load();render()}else show("بعدها اللعبة مفتوحة بتبويب ثاني");
  }
  return;
 }
 switch(action){
  case "start":{
    if(!saveRoster())return;
    const result=core.start(state,bank,rand);
    if(result.exhausted){mode="exhausted";render();return}
    commit(result.state);break;
  }
  case "increase":case "decrease":{
    const list=readNames();
    const next=Math.max(3,Math.min(10,list.length+(action==="increase"?1:-1)));
    if(next===list.length)return;
    if(next>list.length)list.push("اللاعب "+next);else list.pop();
    // Preserve valid input edits and existing player IDs.
    commit(core.updateRoster(state,list));break;
  }
  case "reveal":commit(core.reveal(state));break;
  case "next":commit(core.concealNext(state,Date.now(),rand));break;
  case "nextQuestion":{
    if(core.secondsLeft(state,Date.now())===0){render();return}
    commit(core.nextQuestion(state,rand));break;
  }
  case "endDiscussion":{
    if(!root.confirm("متأكد تريدون تنهّون السوالف وتسلّمون التلفون للدخيل؟"))return;
    commit(core.endDiscussion(state,true,Date.now()));break;
  }
  case "extend":{
    if(state.active?.phase==="talk"){
      const s=JSON.parse(JSON.stringify(state));
      s.active.deadline=Date.now()+60000;
      commit(s);
    }break;
  }
  case "showGuess":commit(core.showGuess(state));break;
  case "guess":{
    const index=Number(target.getAttribute("data-index"));
    commit(core.score(state,index));break;
  }
  case "newRound":commit(core.abandon(state));break;
  case "abandon":{
    if(!root.confirm("إلغاء الجولة الحالية؟ ما راح نرجع الكلمة إذا أحد شافها."))return;
    commit(core.abandon(state));break;
  }
  case "clearScores":{
    if(!saveRoster()||!root.confirm("متأكد تريد تصفّر النقاط؟"))return;
    state.scores=Object.fromEntries(state.roster.map(p=>[p.id,0]));persist();render();break;
  }
  case "review":if(!saveRoster())return;mode="review";render();break;
  case "toggleWord":{
    const word=target.getAttribute("data-word");
    commit(core.filterWord(state,bank,word,!state.blocked.includes(word)));
    mode="review";render();break;
  }
  case "backSetup":mode="setup";render();break;
  case "resetWords":{
    if(!root.confirm("ترجع كل الكلمات للبداية؟ راح تبدي دورة جديدة ويمكن تشوف كلمات لعبتوها قبل."))return;
    commit(core.resetWords(state));break;
  }
 }
}
app.addEventListener("click",event=>{
 const target=event.target.closest("[data-action]");
 if(!target)return;
 commitError(()=>handle(target.getAttribute("data-action"),target));
});
app.addEventListener("change",event=>{
 if(locked||state.active)return;
 if(event.target.id==="cat"){
  state.category=event.target.value;persist();render();
 }else if(event.target.matches("[data-player]"))saveRoster();
});
app.addEventListener("focusout",event=>{
 if(!locked&&!state.active&&event.target.matches("[data-player]"))saveRoster();
});
root.addEventListener("storage",event=>{
 if(event.key===LOCK_KEY){
  const owner=lockInfo();
  if(owner&&owner.tab!==tabId&&Date.now()-owner.at<18000){locked=true;render()}
 }else if(event.key===KEY&&!locked&&event.newValue){
  // The single writer owns this session; never silently overwrite state from another tab.
  const owner=lockInfo();
  if(owner&&owner.tab!==tabId){locked=true;render()}
 }
});
root.addEventListener("pageshow",()=>{if(!locked)takeOwnership(false);render()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state?.active?.phase==="talk")render()});
root.setInterval(()=>{
 if(locked)return;
 heartbeat();
 if(state?.active?.phase==="talk"){
  const s=core.secondsLeft(state,Date.now());
  if(s!==remainingPrev){
    const el=document.getElementById("clock");
    if(el)el.textContent=formatSeconds(s);
    if(s===0&&remainingPrev!==0)render(); // Handles phone sleep that skips directly to zero.
    remainingPrev=s;
  }
 }
},1000);
if("serviceWorker" in navigator){
 root.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
render();
})(window);
