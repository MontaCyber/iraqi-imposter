/* Run: node --test tests/test-game.js */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const core=require("../game-core.js");
const bankContext={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../word-bank.js"),"utf8"),bankContext);
const bank=bankContext.window.IMPOSTER_BANK;
function rng(seed=123456){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
}
const fresh=()=>core.initial(bank,null,null,null);
const wordSet=new Set(bank.categories.flatMap(c=>c.groups.flatMap(g=>g.words)));
const groupFor=word=>bank.categories.flatMap(c=>c.groups).find(g=>g.words.includes(word));
const next=(s,r)=>core.start(s,bank,r);
test("word bank is valid, unique and guesses are drawable",()=>{
 const c=core.catalogue(bank);
 assert.equal(c.words.length,363);
 assert.equal(c.words.length,wordSet.size);
 for(const category of bank.categories)for(const g of category.groups){
  assert.ok(g.words.length>=6);
  assert.ok(g.hints.length>=2);
  assert.ok(g.discussion.length>=2);
  assert.ok(g.words.every(w=>typeof w==="string"&&w.length>0));
  assert.ok(g.discussion.every(q=>typeof q==="string"&&q.length>0));
 }
});
test("all 363 words drawn once, then explicit reset; 100 independent full decks",()=>{
 for(let seed=1;seed<=100;seed++){
  let state=fresh(),seen=new Set(),r=rng(seed);
  for(let i=0;i<363;i++){
   const out=next(state,r);
   assert.equal(out.exhausted,false);
   state=out.state;
   assert.ok(wordSet.has(state.active.word));
   assert.ok(!seen.has(state.active.word));
   assert.equal(state.active.options.length,6);
   assert.equal(new Set(state.active.options).size,6);
   assert.ok(state.active.options.includes(state.active.word));
   assert.ok(state.active.options.every(w=>groupFor(state.active.word).words.includes(w)));
   seen.add(state.active.word);
   state=core.abandon({...state,active:{...state.active,viewed:1}});
  }
  assert.equal(seen.size,363);
  assert.equal(core.remaining(state,bank,"عشوائي"),0);
  assert.equal(next(state,r).exhausted,true);
  state=core.resetWords(state);
  assert.equal(core.remaining(state,bank,"عشوائي"),363);
 }
});
test("category variety remains high late in the deck",()=>{
 for(let seed=50;seed<=75;seed++){
  let state=fresh(),r=rng(seed),last50=[];
  for(let i=0;i<363;i++){
   const out=next(state,r);state=out.state;
   if(i>=313)last50.push(state.active.category);
   state=core.abandon({...state,active:{...state.active,viewed:1}});
  }
  assert.ok(new Set(last50).size>=6,"Late-deck category collapse for seed "+seed);
 }
});
test("3–10 players: all cards, questions, guesses, scores and result",()=>{
 for(let n=3;n<=10;n++){
  let r=rng(n),state=core.updateRoster(fresh(),Array.from({length:n},(_,i)=>"لاعب "+(i+1)));
  state=next(state,r).state;const word=state.active.word;
  const seen=[];
  for(let i=0;i<n;i++){
   state=core.reveal(state);seen.push(state.roster[state.active.index].id===state.active.spyId);
   state=core.concealNext(state,1000,r);
  }
  assert.equal(seen.filter(Boolean).length,1);
  assert.equal(state.active.phase,"talk");
  assert.equal(state.active.askTurn,1);
  assert.equal(core.secondsLeft(state,1000),180);
  for(let i=0;i<n;i++){
   const a=state.active;
   assert.notEqual(a.asker,a.target);
   state=core.nextQuestion(state,r);
  }
  state=core.endDiscussion(state,true,2000);
  assert.equal(state.active.phase,"guess-pass");
  state=core.showGuess(state);
  state=core.score(state,state.active.options.indexOf(word));
  assert.equal(state.active.phase,"result");
  assert.equal(state.scores[state.active.spyId],3);
  assert.throws(()=>core.score(state,0));
  state=core.abandon(state);
  assert.equal(state.active,null);
 }
});
test("score identities stay separate, duplicate names and reserved words are safe",()=>{
 let s=fresh();
 assert.throws(()=>core.updateRoster(s,["علي","علي","سارة"]),/Duplicate/);
 s=core.updateRoster(s,["constructor","__proto__","toString"]);
 s=next(s,rng(33)).state;
 for(let i=0;i<3;i++)s=core.concealNext(core.reveal(s),1000,rng(99+i));
 s=core.endDiscussion(s,true,2000);s=core.showGuess(s);
 s=core.score(s,s.active.options.findIndex(w=>w!==s.active.word));
 assert.ok(Object.values(s.scores).every(x=>Number.isFinite(x)));
 assert.equal(Object.values(s.scores).reduce((a,b)=>a+b,0),4);
});
test("recovery never reveals a secret card after refresh",()=>{
 let state=next(fresh(),rng(17)).state;
 state=core.reveal(state);
 let restored=core.initial(bank,JSON.parse(JSON.stringify(state)),null,null);
 assert.equal(restored.active.phase,"pass");
 assert.equal(restored.active.word,state.active.word);
 assert.equal(restored.active.spyId,state.active.spyId);
 assert.equal(restored.used.length,1);
 restored=core.reveal(restored);
 assert.equal(restored.active.phase,"reveal");
 const after=core.concealNext(restored,1000,rng(20));
 assert.equal(after.active.index,1);
 const again=core.initial(bank,JSON.parse(JSON.stringify(after)),null,null);
 assert.equal(again.active.index,1);
});
test("timing obeys wall clock and discussion ending requires confirmation",()=>{
 let state=next(fresh(),rng(12)).state;
 for(let i=0;i<5;i++)state=core.concealNext(core.reveal(state),1000,rng(i+1));
 assert.equal(core.secondsLeft(state,1000+5000),175);
 assert.equal(core.secondsLeft(state,1000+180000),0);
 assert.throws(()=>core.endDiscussion(state,false,1000),/confirmation/);
 assert.equal(core.endDiscussion(state,false,1000+180000).active.phase,"guess-pass");
});
test("abandon unseen card returns word; revealed card remains counted",()=>{
 let s=next(fresh(),rng(10)).state;
 s=core.abandon(s);
 assert.equal(s.used.length,0);
 assert.equal(s.round,0);
 let t=next(s,rng(11)).state;
 t=core.abandon(core.reveal(t));
 assert.equal(t.used.length,1);
});
test("malformed storage, legacy values, invalid groups and active phase sanitize",()=>{
 const c=core.initial(bank,{version:4,roster:[{id:"p1",name:"A"},{id:"p2",name:"B"},{id:"p3",name:"C"}],
 scores:{p1:"bad",p2:-900,p3:4},used:["xxx","قطو","قطو"],active:{phase:"guess",word:"fake"}},null,null);
 assert.deepEqual(Object.values(c.scores),[0,0,4]);
 assert.equal(c.used.length,1);
 assert.equal(c.active,null);
 const legacy=core.initial(bank,null,{used:["قطو","قطو","fake"]},{"اللاعب 1":8});
 assert.equal(legacy.used.length,1);
 assert.equal(legacy.scores.p1,8);
});
test("role fairness, persistence, and no consecutive impostor assignments",()=>{
 for(let players=3;players<=10;players++){
  let state=core.updateRoster(fresh(),Array.from({length:players},(_,i)=>"P"+i)),last=null;
  for(let i=0;i<180;i++){
   state=next(state,rng(90000+i*19+players)).state;
   assert.notEqual(state.active.spyId,last);
   last=state.active.spyId;
   state=core.abandon({...state,active:{...state.active,viewed:1}});
   if(state.used.length===363)state=core.resetWords(state);
   if(i%10===0)state=core.initial(bank,JSON.parse(JSON.stringify(state)),null,null);
  }
 }
});
test("question asker and target differ; targets receive weighted coverage",()=>{
 for(let count=3;count<=10;count++){
  let s=core.updateRoster(fresh(),Array.from({length:count},(_,i)=>"P"+i));
  s=next(s,rng(count)).state;
  for(let i=0;i<count;i++)s=core.concealNext(core.reveal(s),1000,rng(i));
  for(let i=0;i<100;i++){
   assert.notEqual(s.active.asker,s.active.target);
   s=core.nextQuestion(s,rng(i*7711+count));
  }
  assert.ok(Object.keys(s.active.askedCounts).length>=count-1);
 }
});
test("editor disables words and never creates invalid six-option groups",()=>{
 let s=fresh();
 const group=bank.categories[0].groups[0];
 s=core.filterWord(s,bank,group.words[0],true);
 assert.equal(core.remaining(s,bank,"عشوائي"),357); // six-word group disabled until all six are valid
 s=core.filterWord(s,bank,group.words[1],true);
 assert.equal(core.remaining(s,bank,"عشوائي"),357); // 4 left disables whole six-word group
 s=core.filterWord(s,bank,group.words[0],false);
 assert.equal(core.remaining(s,bank,"عشوائي"),357); // five remaining: group still ineligible
 s=core.filterWord(s,bank,group.words[1],false);
 assert.equal(core.remaining(s,bank,"عشوائي"),363);
});
