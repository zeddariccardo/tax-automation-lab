/* File fittizi in memoria, browser isolato e rete intercettata.
 * L'import è provato dal campo file; calcoli e contratti restano nelle suite esistenti. */
import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {startWorkerBrowser} from './worker-browser-harness.mjs';
let runner;
before(async()=>{runner=await startWorkerBrowser();});
after(async()=>{await runner?.close();});
async function withLipe(check){const run=await runner.open('lipe');try{await check(run.page);assert.deepEqual(run.errors,[],'nessun errore JavaScript/console');}finally{await run.close();}}

async function attempt(page,options={}){
  const data=await page.evaluate(options=>{
    const client={...defaultClient(),denom:'CLIENTE SENTINELLA',piva:'01234567897',cf:'01234567897',periodType:'T',commitmentDate:'2026-08-01'};
    const mapping=[{...defaultMapping('Z22'),id:'old-code',description:'Codice precedente',baseRow:'VP2',dueRow:'VP4'}];
    const record={version:'3.6.7',client,mapping,savedAt:'2026-01-01T00:00:00.000Z'};
    Object.assign(state,{configClient:clone(client),configMapping:clone(mapping),loadedConfigKey:client.piva,
      activeClientKey:client.piva,activeRecord:clone(record),year:2026,quarter:3,
      rows:[{id:'old-row',code:'Z22',taxable:111,vat:24.42,month:7,sourceRow:2,source:'precedente.xlsx'}],
      manual:{Q3:{vp9:7}},sourceFile:'precedente.xlsx',importIssues:[],unknownDraft:{CUSTOM:{decision:'exclude'}},
      periodMapping:{},importContext:{piva:client.piva,year:2026,quarter:3,periodType:'T'}});
    if(options.newDraft)Object.assign(state,{configClient:defaultClient(),configMapping:[],loadedConfigKey:''});
    syncConfigToFields();
    localStorage.setItem(KEYS.clients,JSON.stringify({[client.piva]:record}));
    localStorage.setItem(KEYS.work,JSON.stringify({'01234567897|2026|Q3':{sentinel:'lavorazione precedente'}}));
    localStorage.setItem(KEYS.history,JSON.stringify([{id:'old-history',sentinel:'storico precedente'}]));
    localStorage.setItem(KEYS.session,JSON.stringify({piva:client.piva,year:2026,quarter:3}));
    localStorage.setItem('lipe_file_seq_v1',JSON.stringify({IVP18_01234567897:42}));
    sessionStorage.setItem('lipe-import-sentinel','precedente');
    const snapshot=()=>JSON.stringify({state,fields:[...document.querySelectorAll('[id^="cfg-"]')].filter(e=>'value'in e).map(e=>[e.id,e.value]),
      storage:Object.entries(localStorage).sort(),session:Object.entries(sessionStorage).sort()});
    const previous=snapshot(),oldMapping=state.configMapping;
    window.__lipeImportResult=()=>({unchanged:previous===snapshot(),sameMapping:state.configMapping===oldMapping,
      state:clone(state),clients:getClients(),dateField:document.getElementById('cfg-commitment-date').value,
      toast:document.getElementById('toast').textContent,diagnostics:document.getElementById('lipe-import-diagnostics')?.textContent||''});
    const wb=XLSX.utils.book_new(),add=(n,r)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(r),n);
    if(options.type==='amounts')add('Importi',[['Codice IVA','Imponibile','IVA','Mese'],...(options.rows||[['Z22',12,2.64,7],['Z22',13,2.86,8]])]);
    else{
      add('Anagrafica',options.anagrafica||[['Campo','Valore'],['Denominazione','CLIENTE IMPORTATO'],['Partita IVA',options.newClient?'20202020200':'01234567897'],['Periodicità','Trimestrale'],['Data impegno','2026-09-02']]);
      add('Codiciario',[['Codice IVA','Descrizione','Imponibile →','IVA esigibile →','IVA detraibile →','% imponibile','% IVA esigibile','% IVA detraibile','Note'],
        ...(options.rows||[['Z22','Prima riga valida','VP2','VP4','',50,100,100,''],['CUSTOM','Codice personalizzato','VP3','','VP5',100,100,100,'']])]);
    }
    for(const [name,cells] of Object.entries(options.cells||{}))Object.assign(wb.Sheets[name],cells);
    if(options.titleAndReorder){
      const name=options.type==='amounts'?'Importi':'Codiciario',sheet=wb.Sheets[name],rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''});
      wb.Sheets[name]=XLSX.utils.aoa_to_sheet([['Titolo fittizio'],...rows.map(row=>row.slice().reverse())]);
    }
    if(options.ai)add('Esiti AI',[['Tipo','Codice conto / campo','Elemento da verificare','Stato','Osservazione / assunzione','Fonte'],['Verifica','CUSTOM','Codice custom','Aperto','Verifica fittizia','Dati fittizi']]);
    if(options.failStorage){
      const native=Storage.prototype.setItem,key=KEYS[options.failStorage];let failed=false;
      Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===key&&!failed){failed=true;throw new DOMException('Quota simulata','QuotaExceededError');}return native.call(this,k,v);};
    }
    document.getElementById('toast').textContent='';
    return XLSX.write(wb,{type:'base64',bookType:'xlsx'});
  },options);
  const input=options.type==='amounts'?'#amounts-upload':'#mapping-upload';
  await page.locator(input).setInputFiles({name:'lipe-fittizio.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(data,'base64')});
  await page.waitForFunction(()=>/Cliente (?:creato|aggiornato) dal file:|Importazione .+ non riuscita:|Movimenti:|Codiciario importato/.test(document.getElementById('toast').textContent));
  return page.evaluate(()=>__lipeImportResult());
}
function reject(r,pattern){assert.match(r.toast,/non riuscita:/);assert.match(r.toast,pattern);assert.equal(r.unchanged,true,'cliente, codici, configurazione, periodo, lavoro, storico e progressivi identici');assert.equal(r.sameMapping,true);}

for(const value of ['NON DISPONIBILE','abc123',150,-1,'1.234','1,234'])test('LIPE codiciario: prima riga valida, seconda invalida '+value,()=>withLipe(async page=>{
  reject(await attempt(page,{cells:{Codiciario:{F3:{t:typeof value==='number'?'n':'s',v:value}}}}),/Foglio «Codiciario», riga 3, colonna F.*% imponibile/);
}));
for(const [n,label] of [[7,'#DIV/0!'],[42,'#N/A'],[15,'#VALUE!']])test('LIPE codiciario: errore Excel '+label,()=>withLipe(async page=>{
  const r=await attempt(page,{cells:{Codiciario:{F3:{t:'e',v:n,f:'1/0'}}}});reject(r,/riga 3, colonna F/);assert.ok(r.toast.includes(label));
}));
test('LIPE codiciario: formula senza risultato salvato',()=>withLipe(async page=>{
  reject(await attempt(page,{cells:{Codiciario:{F3:{t:'n',f:'1+1'}}}}),/riga 3, colonna F.*formula senza risultato/);
}));
for(const newClient of [false,true])test('LIPE duplicati: nessun cliente creato o sovrascritto, nuovo='+newClient,()=>withLipe(async page=>{
  const r=await attempt(page,{newClient,cells:{Codiciario:{A3:{t:'s',v:'z22'}}}});reject(r,/duplicat/i);assert.match(r.toast,/Z22/);assert.match(r.toast,/A2.*A3/);assert.equal(Object.keys(r.clients).length,1);
}));
test('LIPE nuovo cliente con codiciario invalido non viene creato',()=>withLipe(async page=>{
  const r=await attempt(page,{newClient:true,cells:{Codiciario:{F3:{t:'n',v:150}}}});reject(r,/% imponibile/);assert.equal(r.clients['20202020200'],undefined);
}));
test('LIPE nuova scheda cliente con codiciario invalido lascia invariata la lavorazione attiva',()=>withLipe(async page=>{
  reject(await attempt(page,{newDraft:true,newClient:true,cells:{Codiciario:{F3:{t:'n',v:150}}}}),/riga 3, colonna F/);
}));
test('LIPE codiciario: riga valorizzata senza codice non ignorata',()=>withLipe(async page=>{
  reject(await attempt(page,{cells:{Codiciario:{A3:{t:'s',v:''}}}}),/riga 3, colonna A.*Codice IVA/);
}));
test('LIPE P.IVA e codice con zeri formattati, data nativa Excel',()=>withLipe(async page=>{
  const r=await attempt(page,{cells:{Anagrafica:{B3:{t:'n',v:1234567897,z:'00000000000'},B5:{t:'n',v:46267,z:'dd/mm/yyyy'}},Codiciario:{A3:{t:'n',v:1,z:'0000'}}}});
  assert.match(r.toast,/Cliente aggiornato dal file/);assert.equal(r.state.configClient.piva,'01234567897');assert.equal(r.state.configMapping.at(-1).code,'0001');
  assert.equal(r.state.configClient.commitmentDate,'2026-09-02');assert.equal(r.dateField,'2026-09-02');
}));
for(const value of ['2026-02-30','31/04/2026','NON DISPONIBILE'])test('LIPE data impegno impossibile '+value,()=>withLipe(async page=>{
  reject(await attempt(page,{cells:{Anagrafica:{B5:{t:'s',v:value}}}}),/Foglio «Anagrafica», riga 5, colonna B.*Data impegno/);
}));
test('LIPE non inventa lo zero già perso nella P.IVA',()=>withLipe(async page=>{
  reject(await attempt(page,{cells:{Anagrafica:{B3:{t:'n',v:1234567897,z:'General'}}}}),/Partita IVA/);
}));
test('LIPE codiciario valido con 220 codici custom',()=>withLipe(async page=>{
  const rows=Array.from({length:220},(_,i)=>['CUSTOM_'+i,'Codice '+i,'VP3','','VP5',100,100,50,'Nota fittizia']);
  const r=await attempt(page,{rows});assert.match(r.toast,/Cliente aggiornato dal file/);assert.equal(r.state.configMapping.length,221);
  assert.equal(r.clients['01234567897'].mapping.length,221);assert.deepEqual(r.state.configMapping.slice(1).map(m=>[m.baseRow,m.dedRow,m.dedPct]),rows.map(()=>['VP3','VP5',50]));
  assert.equal(r.state.rows[0].taxable,111);
}));
for(const value of ['NON DISPONIBILE','abc123','1.234','1,234'])test('LIPE importi: blocca testo invalido/ambiguo '+value,()=>withLipe(async page=>{
  reject(await attempt(page,{type:'amounts',cells:{Importi:{B3:{t:'s',v:value}}}}),/Foglio «Importi», riga 3, colonna B.*Imponibile/);
}));
test('LIPE importi: riga con importo e codice vuoto',()=>withLipe(async page=>{
  reject(await attempt(page,{type:'amounts',cells:{Importi:{A3:{t:'s',v:''}}}}),/riga 3, colonna A.*Codice IVA/);
}));
for(const cell of [{t:'e',v:7,f:'1/0'},{t:'n',f:'1+1'}])test('LIPE importi: errore Excel/cache mancante '+cell.t,()=>withLipe(async page=>{
  reject(await attempt(page,{type:'amounts',cells:{Importi:{C3:cell}}}),/riga 3, colonna C.*IVA/);
}));
test('LIPE 240 importi validi, note di credito e codici custom conservati',()=>withLipe(async page=>{
  const rows=Array.from({length:240},(_,i)=>[i%2?'CUSTOM':'Z22',i%2?-12.5:25,i%2?-2.75:5.5,7+i%3]);
  const r=await attempt(page,{type:'amounts',rows});assert.match(r.toast,/Movimenti:/);assert.equal(r.state.rows.length,240);
  assert.deepEqual(r.state.rows.map(x=>[x.code,x.taxable,x.vat,x.month]),rows);
}));

for(const failStorage of ['clients','work','session'])test('LIPE codiciario: rollback del salvataggio '+failStorage,()=>withLipe(async page=>{
  reject(await attempt(page,{failStorage}),/Salvataggio locale non riuscito/);
}));
test('LIPE importi: storage pieno non sostituisce il periodo',()=>withLipe(async page=>{
  reject(await attempt(page,{type:'amounts',failStorage:'work'}),/Salvataggio locale non riuscito/);
}));
test('LIPE importi: formati espliciti e formule con risultato salvato',()=>withLipe(async page=>{
  const values=['1.234,56','1234,56','1,234.56','1234.56','-1.234,56','(1,234.56)',1234.56];
  const r=await attempt(page,{type:'amounts',rows:values.map(v=>['CUSTOM',v,-10,7]),cells:{Importi:{C2:{t:'n',v:-10,f:'-5*2'}}}});
  assert.deepEqual(r.state.rows.map(x=>x.taxable),[1234.56,1234.56,1234.56,1234.56,-1234.56,-1234.56,1234.56]);
}));
test('LIPE percentuali: formato nativo, percentuale letterale e zero salvato',()=>withLipe(async page=>{
  const r=await attempt(page,{cells:{Codiciario:{F2:{t:'n',v:.5,z:'0%'},F3:{t:'n',v:0,f:'1-1'}}}});
  assert.equal(r.state.configMapping[0].basePct,50);assert.equal(r.state.configMapping[1].basePct,0);
}));
test('LIPE data nativa fittizia 29 febbraio 1900 rifiutata',()=>withLipe(async page=>{
  reject(await attempt(page,{cells:{Anagrafica:{B5:{t:'n',v:60,z:'dd/mm/yyyy'}}}}),/Data impegno.*data impossibile/);
}));
test('LIPE titolo e header riordinati conservano codiciario ed Esiti AI',()=>withLipe(async page=>{
  const r=await attempt(page,{titleAndReorder:true,ai:true});assert.equal(r.state.configMapping[0].basePct,50);assert.equal(r.state.configMapping[1].dedRow,'VP5');
  assert.equal(r.state.configClient.aiFindings.length,1);assert.equal(r.clients['01234567897'].client.aiFindings.length,1);
}));
test('LIPE importi: titolo, header riordinati e data periodo Excel',()=>withLipe(async page=>{
  const r=await attempt(page,{type:'amounts',titleAndReorder:true,rows:[['0001',12,-2.64,7]]});
  assert.deepEqual(r.state.rows.map(x=>[x.code,x.taxable,x.vat,x.month]),[['0001',12,-2.64,7]]);
  const native=await attempt(page,{type:'amounts',cells:{Importi:{D2:{t:'n',v:46267,z:'dd/mm/yyyy'}}}});assert.equal(native.state.rows[0].month,9);
}));
test('LIPE colonne percentuali duplicate non vengono scelte arbitrariamente',()=>withLipe(async page=>{
  reject(await attempt(page,{cells:{Codiciario:{G1:{t:'s',v:'% imponibile'}}}}),/intestazione duplicata/);
}));
test('LIPE incolla: validazione completa prima di modificare il codiciario',()=>withLipe(async page=>{
  await attempt(page);
  const result=await page.evaluate(()=>{
    const before=JSON.stringify(state),storage=JSON.stringify(Object.entries(localStorage).sort());let message='';
    try{mergeMappings(parseGridText('Z22\tValido\tVP2\tVP4\t\t50\t100\t100\nCUSTOM\tInvalido\tVP3\t\tVP5\t150\t100\t100','mapping'));}catch(e){message=e.message;}
    return {message,unchanged:before===JSON.stringify(state)&&storage===JSON.stringify(Object.entries(localStorage).sort())};
  });assert.match(result.message,/riga 3.*% imponibile/);assert.equal(result.unchanged,true);
}));
