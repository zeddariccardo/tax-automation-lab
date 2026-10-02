import test from 'node:test';
import assert from 'node:assert/strict';
import {entryHero,searchDestinations,matchDestinations} from './product-ui.js';
import {authEntry} from './auth-view.js';
const personal=searchDestinations({role:'personal',base:'#/io/',ready:true});
const ids=(q,entries=personal)=>matchDestinations(q,entries).map(x=>x.id);

test('every requested intent leads to an existing section, never a fiscal command',()=>{
 for(const [q,id] of Object.entries({
  fatture:'income',incassi:'income',acconti:'payments',saldo:'payments',INPS:'taxes',
  previdenza:'taxes',scadenze:'payments',imposte:'taxes',requisiti:'taxes',
  'quanto devo pagare?':'payments','dove inserisco una fattura?':'income',
  'quando verso gli acconti?':'payments'
 }))assert.equal(ids(q)[0],id,q);
 for(const row of personal){assert.match(row.destination.href,/^#\/io\/(entrate|tasse|pagamenti|attivita|documenti|dichiarazione)$/);assert.equal(row.destination.action,undefined);}
});
test('matching is accent/case insensitive, bounded, deterministic and has an honest empty state',()=>{
 assert.deepEqual(ids('ATTIVITÀ'),['activity']);
 assert.deepEqual(ids('astronave'),[]);
 assert.ok(ids('fatture tasse pagamenti attività documenti dichiarazione').length<=4);
 assert.deepEqual(ids(''),ids(''));assert.equal(ids('').length,4);
 assert.deepEqual(ids('quanto devo?'),[]);
});
test('logged-out entry never mounts the product search',()=>{
 for(const signup of [false,true]){
  const html=authEntry({access:{phase:'signed-out',message:''},signup,loginEmail:'',brand:()=>'',icon:()=>'',esc:s=>s,button:()=>''});
  assert.doesNotMatch(html,/data-product-search|Cosa vuoi fare|role="combobox"/);
 }
});
test('no destinations before current context and structural data are ready',()=>{
 for(const role of ['entry','personal','studio'])assert.deepEqual(searchDestinations({role,base:'#/io/',ready:false}),[]);
 assert.deepEqual(searchDestinations({role:'personal',ready:true}),[]);
 assert.deepEqual(searchDestinations({role:'entry',ready:true,base:'#/io/'}),[]);
});
test('Studio root offers its portfolio, not guessed client links or demo deadlines',()=>{
 const rows=searchDestinations({role:'studio',ready:true});
 assert.deepEqual(rows.map(x=>x.destination.href),['#/studio/da-fare','#/studio/clienti']);
 assert.deepEqual(ids('quando verso gli acconti?',rows),['clients']);
 assert.ok(rows.every(x=>!JSON.stringify(x).includes('#/io/')));
});
test('a client context keeps every navigation inside the selected position',()=>{
 const base='#/studio/clienti/synthetic-workspace/';
 const rows=searchDestinations({role:'studio',base,ready:true});
 assert.equal(rows.length,personal.length);
 assert.ok(rows.every(x=>x.destination.href.startsWith(base)));
 assert.equal(matchDestinations('fatture',rows)[0].destination.href,base+'entrate');
});
test('hero has one static accessible heading; visual loop does not repeat announcements',()=>{
 const html=entryHero();
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/<span class="sr-only">semplifica pagamenti, adempimenti, comunicazioni, scadenze e documenti<\/span>/);
 assert.match(html,/class="hero-phrase" aria-hidden="true"/);
 assert.deepEqual([...html.matchAll(/class="hero-word (violet|petrol)">([^<]+)/g)].map(m=>[m[2],m[1]]),[
  ['pagamenti','violet'],['adempimenti','petrol'],['comunicazioni','violet'],['scadenze','petrol'],['documenti','violet'],['pagamenti','violet']
 ]);
});
test('hero CTA uses the existing Auth action; loading and context choice do not gain a second H1',()=>{
 const render=phase=>authEntry({access:{phase,message:'',contexts:[]},loginEmail:'',brand:()=>'',icon:()=>'',esc:s=>s,button:()=>''});
 const html=render('signed-out');
 assert.equal((html.match(/class="button hero-access"/g)||[]).length,1);
 assert.match(html,/class="button hero-access"[^>]*data-action="auth-signup-mode" data-auth-focus>Registrati/);
 assert.match(html,/id="login-form"/);assert.match(html,/autocomplete="current-password"/);
 for(const phase of ['loading','choosing','config-error']){
  assert.equal((render(phase).match(/<h1\b/g)||[]).length,1);
  assert.doesNotMatch(render(phase),/hero-access|data-product-search/);
 }
});
