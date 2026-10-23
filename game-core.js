/* منو الدخيل؟: pure, testable game rules. Browser and Node compatible. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.ImposterCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const VERSION=4, ROUND_MS=180000;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
  const safeName=x=>String(x==null?"":x).trim().slice(0,28);
  const finite=x=>Number.isFinite(x)&&x>=0&&x<=10000000?Math.floor(x):0;
  const randomId=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
  const makeRoster=n=>Array.from({length:n},(_,i)=>({id:"p"+(i+1),name:"اللاعب "+(i+1)}));
  function randomInt(limit,rng){
    if(!Number.isInteger(limit)||limit<1)throw new Error("Invalid random range");
    return Math.floor(Math.min(0.999999999,Math.max(0,rng()))*limit);
  }
  function weighted(items,weightFn,rng){
    if(!items.length)return null;
    const weights=items.map(x=>Math.max(0,Number(weightFn(x))||0));
    let total=weights.reduce((s,x)=>s+x,0);
    if(total<=0)return items[randomInt(items.length,rng)];
    let ticket=rng()*total;
    for(let i=0;i<items.length;i++){ticket-=weights[i];if(ticket<0)return items[i]}
    return items[items.length-1];
  }
  function shuffle(items,rng){
    const arr=items.slice();
    for(let i=arr.length-1;i>0;i--){const j=randomInt(i+1,rng);[arr[i],arr[j]]=[arr[j],arr[i]]}
    return arr;
  }
  function catalogue(bank){
    if(!bank||!Array.isArray(bank.categories))throw new Error("Invalid word bank");
    const found=new Set(), categories={};
    for(const category of bank.categories){
      if(!category||typeof category.name!=="string"||!Array.isArray(category.groups))throw new Error("Bad word category");
      categories[category.name]=category.groups.map((group,i)=>{
        if(!Array.isArray(group.words)||group.words.length<6)throw new Error("Too few guess alternatives");
        for(const word of group.words){
          if(typeof word!=="string"||found.has(word))throw new Error("Duplicate or invalid word: "+word);
          found.add(word);
        }
        return {...group,id:category.name+":"+i};
      });
    }
    return {categories,words:[...found],set:found};
  }
  function cleanRoster(roster){
    if(!Array.isArray(roster)||roster.length<3||roster.length>10)return makeRoster(5);
    const seen=new Set();
    return roster.map((p,i)=>{
      const id=plain(p)&&typeof p.id==="string"&&/^[a-zA-Z0-9_-]{1,50}$/.test(p.id)&&!seen.has(p.id)?p.id:"p"+(i+1);
      seen.add(id);
      return {id,name:safeName(p&&p.name)||"اللاعب "+(i+1)};
    });
  }
  function initial(bank, saved, legacyCycle, legacyScores){
    const cat=catalogue(bank),s=plain(saved)&&saved.version===VERSION?saved:{};
    const roster=cleanRoster(s.roster);
    const ids=new Set(roster.map(p=>p.id)),scores={};
    for(const p of roster){
      let value=plain(s.scores)&&Object.hasOwn(s.scores,p.id)?s.scores[p.id]:0;
      if(!s.version&&plain(legacyScores)&&Object.hasOwn(legacyScores,p.name))value=legacyScores[p.name];
      scores[p.id]=finite(value);
    }
    const old=plain(legacyCycle)&&Array.isArray(legacyCycle.used)?legacyCycle:{};
    const used=Array.isArray(s.used)?s.used:Array.isArray(old.used)?old.used:[];
    const cleanUsed=[...new Set(used.filter(w=>typeof w==="string"&&cat.set.has(w)))];
    const state={
      version:VERSION,roster,scores,used:cleanUsed,round:Math.min(100000,Math.max(0,Number(s.round)||0)),
      category:Object.hasOwn(cat.categories,s.category)?s.category:"عشوائي",
      recentCategories:Array.isArray(s.recentCategories)?s.recentCategories.filter(x=>typeof x==="string").slice(-4):[],
      recentGroups:Array.isArray(s.recentGroups)?s.recentGroups.filter(x=>typeof x==="string").slice(-5):[],
      recentHints:Array.isArray(s.recentHints)?s.recentHints.filter(x=>typeof x==="string").slice(-18):[],
      spyCounts:plain(s.spyCounts)?s.spyCounts:{},lastSpy:typeof s.lastSpy==="string"?s.lastSpy:"",
      blocked:Array.isArray(s.blocked)?s.blocked.filter(x=>cat.set.has(x)):[],
      active:null
    };
    if(plain(s.active)){
      const a=s.active, group=Object.values(cat.categories).flat().find(g=>g.words.includes(a.word));
      const eligible=group&&ids.has(a.spyId)&&["pass","reveal","talk","guess-pass","guess","result"].includes(a.phase);
      if(eligible&&Array.isArray(a.options)&&a.options.length===6&&a.options.includes(a.word)&&new Set(a.options).size===6&&a.options.every(w=>group.words.includes(w))){
        const options=a.options.slice(),count=roster.length;
        state.active={word:a.word,category:typeof a.category==="string"?a.category:"",groupId:group.id,
          phase:a.phase,spyId:a.spyId,index:Math.max(0,Math.min(count-1,Number(a.index)||0)),
          viewed:Math.max(0,Math.min(count,Number(a.viewed)||0)),options,
          hint:typeof a.hint==="string"?a.hint.slice(0,180):group.hint,
          questions:Array.isArray(a.questions)?a.questions.slice(0,2).map(String):[],
          askQueue:Array.isArray(a.askQueue)?a.askQueue.filter(id=>ids.has(id)):[],
          asker:ids.has(a.asker)?a.asker:"",target:ids.has(a.target)?a.target:"",
          askTurn:Math.max(0,Math.min(1000,Number(a.askTurn)||0)),
          askedCounts:plain(a.askedCounts)?a.askedCounts:{},
          lastPair:typeof a.lastPair==="string"?a.lastPair:"",
          deadline:Number.isFinite(a.deadline)?a.deadline:0,
          awarded:!!a.awarded,correct:!!a.correct};
        if(!state.used.includes(a.word))state.used.push(a.word);
        if(state.active.phase==="reveal")state.active.phase="pass"; // Hide secrets after refresh.
      }
    }
    return state;
  }
  function freshGroup(group,used,blocked){
    const viable=group.words.filter(w=>!blocked.has(w));
    return viable.length>=6?viable.filter(w=>!used.has(w)):[];
  }
  function remaining(state,bank,category){
    const cat=catalogue(bank),used=new Set(state.used),blocked=new Set(state.blocked);
    const names=category&&category!=="عشوائي"?[category]:Object.keys(cat.categories);
    return names.flatMap(n=>(cat.categories[n]||[]).flatMap(g=>freshGroup(g,used,blocked))).length;
  }
  function selectWord(state,bank,rng){
    const cat=catalogue(bank),used=new Set(state.used),blocked=new Set(state.blocked);
    const names=state.category==="عشوائي"?Object.keys(cat.categories):[state.category];
    const available=names.map(name=>{
      const groups=(cat.categories[name]||[]).map(g=>({group:g,unused:freshGroup(g,used,blocked)})).filter(g=>g.unused.length>0);
      return {name,groups,remaining:groups.reduce((n,g)=>n+g.unused.length,0)};
    }).filter(c=>c.remaining>0);
    if(!available.length)return null;
    const picked=weighted(available,c=>{
      const prev=state.recentCategories;
      const cooldown=prev.at(-1)===c.name?0.22:prev.at(-2)===c.name?0.65:1;
      return c.remaining*cooldown;
    },rng);
    const chosen=weighted(picked.groups,g=>{
      const prev=state.recentGroups;
      return g.unused.length*(prev.at(-1)===g.group.id?0.22:prev.at(-2)===g.group.id?0.7:1);
    },rng);
    return {word:chosen.unused[randomInt(chosen.unused.length,rng)],category:picked.name,group:chosen.group,guesses:chosen.group.words.filter(w=>!blocked.has(w))};
  }
  function pickSpy(state,rng){
    const count=state.roster.length;
    const players=state.roster.filter(p=>p.id!==state.lastSpy);
    if(!players.length)return state.roster[0].id;
    const values=state.roster.map(p=>finite(state.spyCounts[p.id]));
    const low=Math.min(...values);
    return weighted(players,p=>Math.exp(-0.075*(finite(state.spyCounts[p.id])-low)),rng).id;
  }
  function hintFor(state,bank,group,rng){
    const variants=Array.isArray(group.hints)&&group.hints.length?group.hints:[group.hint];
    const fresh=variants.filter(h=>!state.recentHints.slice(-6).includes(h)),pool=fresh.length?fresh:variants;
    const hint=pool[randomInt(pool.length,rng)];
    const common=Array.isArray(group.discussion)&&group.discussion.length>=2?group.discussion:bank.questions[group.questionSet]||[];
    const candidates=shuffle(common,rng).slice(0,2);
    state.recentHints.push(hint);state.recentHints=state.recentHints.slice(-18);
    return {hint,questions:candidates};
  }
  function start(state,bank,rng){
    if(state.active&&!["result"].includes(state.active.phase))throw new Error("Round already active");
    const next=clone(state),p=selectWord(next,bank,rng);
    if(!p)return {state:next,exhausted:true};
    const spyId=pickSpy(next,rng),help=hintFor(next,bank,p.group,rng);
    const choices=shuffle([p.word,...shuffle(p.guesses.filter(w=>w!==p.word),rng).slice(0,5)],rng);
    if(choices.length!==6||new Set(choices).size!==6)throw Error("Invalid guess options");
    next.used.push(p.word);next.round++;
    next.spyCounts[spyId]=finite(next.spyCounts[spyId])+1;next.lastSpy=spyId;
    next.recentCategories.push(p.category);next.recentCategories=next.recentCategories.slice(-4);
    next.recentGroups.push(p.group.id);next.recentGroups=next.recentGroups.slice(-5);
    next.active={word:p.word,category:p.category,groupId:p.group.id,spyId,phase:"pass",index:0,viewed:0,
      options:choices,hint:help.hint,questions:help.questions,askQueue:[],asker:"",target:"",
      askTurn:0,askedCounts:{},lastPair:"",deadline:0,awarded:false,correct:false};
    return {state:next,exhausted:false};
  }
  function copyActive(state,allowed){
    if(!state.active||!allowed.includes(state.active.phase))throw Error("Invalid game phase");
    return clone(state);
  }
  function reveal(state){const s=copyActive(state,["pass"]);s.active.phase="reveal";s.active.viewed=Math.max(s.active.viewed,s.active.index+1);return s}
  function concealNext(state,now,rng){
    const s=copyActive(state,["reveal"]);
    if(s.active.index<s.roster.length-1){s.active.index++;s.active.phase="pass";}
    else {s.active.phase="talk";s.active.deadline=now+ROUND_MS;s.active=questionInState(s,rng);}
    return s;
  }
  function questionInState(s,rng){
    const a=s.active,roster=s.roster;
    if(!a.askQueue.length){
      a.askQueue=shuffle(roster.map(p=>p.id),rng);
      if(a.askQueue.length>1&&a.askQueue.at(-1)===a.asker)[a.askQueue[0],a.askQueue[a.askQueue.length-1]]=[a.askQueue.at(-1),a.askQueue[0]];
    }
    const asker=a.askQueue.pop(),candidates=roster.filter(p=>p.id!==asker);
    const values=candidates.map(p=>finite(a.askedCounts[p.id])),low=Math.min(...values);
    const target=weighted(candidates,p=>{
      const times=finite(a.askedCounts[p.id]);
      return Math.exp(-0.95*(times-low))*(a.lastPair===asker+":"+p.id?0.15:1);
    },rng).id;
    a.asker=asker;a.target=target;a.lastPair=asker+":"+target;a.askTurn++;
    a.askedCounts[target]=finite(a.askedCounts[target])+1;
    return a;
  }
  function nextQuestion(state,rng){
    const s=copyActive(state,["talk"]);s.active=questionInState(s,rng);return s;
  }
  function endDiscussion(state,confirmed,now){
    const s=copyActive(state,["talk"]);
    const enough=s.active.askTurn>=Math.min(s.roster.length,3),expired=now>=s.active.deadline;
    if(!enough&&!expired&&!confirmed)throw Error("Discussion needs confirmation");
    s.active.phase="guess-pass";return s;
  }
  function showGuess(state){const s=copyActive(state,["guess-pass"]);s.active.phase="guess";return s}
  function score(state,index){
    const s=copyActive(state,["guess"]);
    const a=s.active;
    if(!Number.isInteger(index)||index<0||index>=a.options.length)throw Error("Invalid guess index");
    const correct=a.options[index]===a.word;
    if(!a.awarded){
      if(correct)s.scores[a.spyId]=finite(s.scores[a.spyId])+3;
      else for(const p of s.roster)if(p.id!==a.spyId)s.scores[p.id]=finite(s.scores[p.id])+2;
    }
    a.correct=correct;a.awarded=true;a.phase="result";return s;
  }
  function abandon(state){
    const s=copyActive(state,["pass","reveal","talk","guess-pass","guess","result"]);
    const a=s.active;
    if(a.viewed===0&&a.phase==="pass"){
      s.used=s.used.filter(w=>w!==a.word);s.round=Math.max(0,s.round-1);
      s.spyCounts[a.spyId]=Math.max(0,finite(s.spyCounts[a.spyId])-1);
      // Keep recent history as an innocent statistical effect, not a spoiled word.
    }
    s.active=null;return s;
  }
  function updateRoster(state,names){
    const s=clone(state);
    if(s.active)throw Error("Cannot edit players during active game");
    if(!Array.isArray(names)||names.length<3||names.length>10)throw Error("3–10 players");
    const used=new Set();
    s.roster=names.map((name,i)=>{
      const value=safeName(name)||"اللاعب "+(i+1);
      const id=state.roster[i]?.id||"p"+(i+1)+"_"+randomId();
      const key=value.toLocaleLowerCase();
      if(used.has(key))throw Error("Duplicate player name");
      used.add(key);
      return {id,name:value};
    });
    for(const p of s.roster)if(!Object.hasOwn(s.scores,p.id))s.scores[p.id]=0;
    return s;
  }
  function filterWord(state,bank,word,blocked){
    if(state.active)throw Error("Cannot review words mid-round");
    if(!catalogue(bank).set.has(word))throw Error("Unknown word");
    const s=clone(state),values=new Set(s.blocked);
    if(blocked)values.add(word);else values.delete(word);
    s.blocked=[...values];return s;
  }
  function resetWords(state){if(state.active)throw Error("Finish current round before resetting words");const s=clone(state);s.used=[];s.recentCategories=[];s.recentGroups=[];return s}
  function secondsLeft(state,now){
    return state.active?.phase==="talk"?Math.max(0,Math.ceil((state.active.deadline-now)/1000)):0;
  }
  return {VERSION,ROUND_MS,catalogue,initial,remaining,start,reveal,concealNext,nextQuestion,endDiscussion,
    showGuess,score,abandon,updateRoster,filterWord,resetWords,secondsLeft,weighted,shuffle};
});