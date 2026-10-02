// Presentation-only navigation. No requests, persistence, fiscal facts or actions.
export function entryHero(){
 const words=['pagamenti','adempimenti','comunicazioni','scadenze','documenti','pagamenti'];
 return `<h1 class="entry-title product-hero-title"><span class="sr-only">semplifica pagamenti, adempimenti, comunicazioni, scadenze e documenti</span><span class="hero-phrase" aria-hidden="true"><span class="hero-fixed">semplifica</span><span class="hero-window"><span class="hero-track">${words.map((w,i)=>`<span class="hero-word ${i===1||i===3?'petrol':'violet'}">${w}</span>`).join('')}</span></span></span></h1>`;
}
const entry=(id,label,description,destination,keywords)=>({id,label,description,destination,keywords});
export function searchDestinations({signedOut=false,role,base=null,ready=false}={}){
 if(signedOut)return [
  entry('login','Accedi','Consulta la tua posizione o i clienti del tuo Studio.',{action:'auth-login-mode'},'fatture fattura incassi incasso acconti saldo INPS previdenza scadenze imposte requisiti pagare versare verso documento documenti inserisco aggiungi accedi login'),
  entry('signup','Registrati','Crea il tuo account Forfettario o Studio.',{action:'auth-signup-mode'},'registrati registrazione account nuovo iniziare')
 ];
 if(!ready)return [];
 if(role==='studio'&&!base)return [
  entry('queue','Da fare','Richieste e documenti da controllare.',{href:'#/studio/da-fare'},'attivita richieste messaggi documenti verificare'),
  entry('clients','Clienti','Apri una posizione collegata per consultarne i dati.',{href:'#/studio/clienti'},'clienti cliente fatture fattura incassi incasso acconti saldo INPS previdenza scadenze imposte requisiti pagare verso inserisco')
 ];
 if(!['personal','studio'].includes(role)||!base)return [];
 return [
  entry('income','Entrate','Fatture, incassi e importazione.',{href:base+'entrate'},'fattura fatture incassi incasso inserisco aggiungi registra import importa'),
  entry('taxes','Tasse e contributi','Situazione, requisiti e previsione.',{href:base+'tasse'},'tasse imposte INPS previdenza contributi requisiti previsione accantonamento'),
  entry('payments','Stato dei pagamenti','Importi, scadenze e dati da verificare.',{href:base+'pagamenti'},'pagamenti pagare saldo acconti acconto verso versare scadenze F24'),
  entry('activity','Attività',role==='studio'?'Richieste e messaggi con il cliente.':'Richieste e messaggi con il commercialista.',{href:base+'attivita'},'attivita richiesta richieste messaggi studio commercialista comunicazioni'),
  entry('documents','Archivio documenti','Consulta i documenti condivisi.',{href:base+'documenti'},'documenti documento ricevuta ricevute archivio carica upload'),
  entry('declaration','Dichiarazione','Consulta la bozza e i dati da verificare.',{href:base+'dichiarazione'},'dichiarazione redditi PF bozza dati adempimenti')
 ];
}
const normalize=v=>String(v).toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const stops=new Set(['a','al','alla','allo','ai','alle','che','chi','come','con','cosa','da','dal','dalla','dei','del','della','di','dove','e','gli','ho','i','il','in','la','le','lo','mi','nel','nella','per','quando','quanto','devo','sono','su','un','una','voglio']);
export function matchDestinations(query,entries){
 const q=normalize(query.slice(0,120)),tokens=q.split(' ').filter(t=>t&&!stops.has(t));
 if(!q)return entries.slice(0,4);
 if(!tokens.length)return [];
 return entries.map((e,i)=>{
  const label=normalize(e.label),words=normalize(e.label+' '+e.keywords).split(' ');
  const hits=tokens.filter(t=>words.some(w=>w===t||t.length>=4&&w.startsWith(t)));
  return {e,i,score:hits.length?hits.length*10+(label===q?30:label.includes(q)?15:0):0};
 }).filter(v=>v.score>0).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,4).map(v=>v.e);
}
export function createProductSearch({document:doc,getEntries,onSelect,icon}){
 let key=null,query='',expanded=false,active=-1,input,box,list,status,results=[],hadFocus=false;
 const close=()=>{expanded=false;active=-1;draw();};
 function draw(){
  if(!input?.isConnected)return;
  results=matchDestinations(query,getEntries());active=Math.min(active,results.length-1);
  input.setAttribute('aria-expanded',String(expanded));
  if(expanded&&active>=0)input.setAttribute('aria-activedescendant','product-option-'+active);else input.removeAttribute('aria-activedescendant');
  box.hidden=!expanded;list.replaceChildren();
  if(expanded){
   const rect=input.getBoundingClientRect(),height=doc.defaultView.visualViewport?.height||doc.defaultView.innerHeight;
   const below=height-rect.bottom,above=rect.top,flip=below<160&&above>below;
   input.closest('[data-product-search]').dataset.above=String(flip);
   input.closest('[data-product-search]').style.setProperty('--search-room',Math.max(64,(flip?above:below)-20)+'px');
  }
  results.forEach((r,i)=>{
   const option=doc.createElement('div');option.id='product-option-'+i;option.role='option';
   option.setAttribute('aria-selected',String(i===active));option.dataset.productResult=String(i);
   const title=doc.createElement('strong'),description=doc.createElement('span');title.textContent=r.label;description.textContent=r.description;
   option.append(title,description);list.append(option);
  });
  status.textContent=results.length?'':'Nessuna sezione trovata. Prova con “fatture” o “documenti”.';
 }
 function select(i){
  const chosen=results[i];
  // Recheck the current scope at activation, not just when the popup opened.
  if(!chosen||!getEntries().some(e=>e.id===chosen.id&&JSON.stringify(e.destination)===JSON.stringify(chosen.destination))){close();return;}
  close();query='';input.value='';onSelect(chosen.destination);
 }
 doc.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-product-search]'))close();});
 doc.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='k'&&input?.isConnected&&!doc.querySelector('dialog[open]')){
   e.preventDefault();input.focus();expanded=true;draw();
  }
 });
 doc.defaultView.addEventListener('resize',()=>{if(expanded)draw();});
 doc.defaultView.visualViewport?.addEventListener('resize',()=>{if(expanded)draw();});
 return {
  capture(){hadFocus=doc.activeElement===input;},
  mount(root,contextKey,restoreFocus=true){
   if(contextKey!==key){key=contextKey;query='';expanded=false;active=-1;hadFocus=false;}
   if(!root){input=null;return;}
   root.classList.add('product-search');
   root.innerHTML=`<label class="sr-only" for="product-search">Cerca nel Forfettario</label><div class="product-search-field">${icon('search')}<input id="product-search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="product-results" autocomplete="off" spellcheck="false" maxlength="120" placeholder="Cosa vuoi fare?"></div><div class="product-search-popup" hidden><div id="product-results" role="listbox" aria-label="Sezioni del Forfettario"></div><p class="product-search-empty" role="status"></p></div>`;
   input=root.querySelector('input');box=root.querySelector('.product-search-popup');list=root.querySelector('[role=listbox]');status=root.querySelector('[role=status]');
   input.value=query;
   input.addEventListener('input',()=>{query=input.value;expanded=true;active=-1;draw();});
   input.addEventListener('focus',()=>{expanded=true;draw();});
   input.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if(e.key==='Escape'){e.preventDefault();close();}
    else if(['ArrowDown','ArrowUp'].includes(e.key)){
     e.preventDefault();expanded=true;draw();
     if(results.length)active=e.key==='ArrowDown'?(active+1)%results.length:(active<0?results.length-1:(active-1+results.length)%results.length);
     draw();list.children[active]?.scrollIntoView({block:'nearest'});
    }else if(e.key==='Enter'&&expanded&&active>=0){e.preventDefault();select(active);}
    else if(e.key==='Tab')close();
   });
   root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget))close();});
   list.addEventListener('pointerdown',e=>e.preventDefault());
   list.addEventListener('click',e=>{const r=e.target.closest('[data-product-result]');if(r)select(Number(r.dataset.productResult));});
   draw();if(hadFocus&&restoreFocus)input.focus({preventScroll:true});
  }
 };
}
