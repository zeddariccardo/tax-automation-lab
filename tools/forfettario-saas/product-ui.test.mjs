import test from 'node:test';
import assert from 'node:assert/strict';
import {entryHero} from './product-ui.js';
import {authEntry} from './auth-view.js';
test('logged-out entry never mounts the product search',()=>{
 for(const signup of [false,true]){
  const html=authEntry({access:{phase:'signed-out',message:''},signup,loginEmail:'',brand:()=>'',icon:()=>'',esc:s=>s,button:()=>''});
  assert.doesNotMatch(html,/data-product-search|Cosa vuoi fare|role="combobox"/);
 }
});
test('hero has one static accessible heading; visual loop does not repeat announcements',()=>{
 const html=entryHero();
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/<span class="sr-only">semplifica fatture, tasse, documenti, dichiarazioni e pagamenti<\/span>/);
 assert.match(html,/class="hero-phrase" aria-hidden="true"/);
 assert.deepEqual([...html.matchAll(/class="hero-word (violet|petrol)">([^<]+)/g)].map(m=>[m[2],m[1]]),[
  ['fatture','violet'],['tasse','petrol'],['documenti','violet'],['dichiarazioni','petrol'],['pagamenti','violet'],['fatture','violet']
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
