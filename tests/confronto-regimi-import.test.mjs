/* Regressioni Excel con file fittizi, SheetJS e browser reali.
 * Il round-trip Worker usa, quando disponibile, il repository privato in sola
 * lettura. Non chiama la produzione e non cambia fixture o risultati golden. */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startWorkerBrowser } from './worker-browser-harness.mjs';

export const MATRIX = [
  ['PROFILO','Professione','profession','commercialista','testo'],
  ['PROFILO','Regime attuale','currentRegime','ordinario','testo'],
  ['PROFILO','Anno fiscale','year',2025,'numero'],
  ['PROFILO','Calcolo per','subjectKind','altro','testo','other'],
  ['PROFILO','Nome della simulazione','subjectName','SIMULAZIONE FITTIZIA IMPORT','testo'],
  ['COMPENSI','Compensi dell’anno','revenue',50000,'numero'],
  ['COMPENSI','Compensi dell’anno precedente','previousRevenue',86000,'numero'],
  ['COMPENSI','Altri redditi personali','otherIncome',12345,'numero'],
  ['COMPENSI','Lavoro dipendente o pensione anno precedente','employeeIncomePrev',23456,'numero'],
  ['COMPENSI','di cui lavoro dipendente anno corrente','employeeIncomeCurr',2345,'numero'],
  ['COMPENSI','Aliquota 5% nuova attività','startup','SI','sino',true],
  ['COMPENSI','Partecipazioni incompatibili','incompatible','NO','sino',false],
  ['COMPENSI','Attività prevalente verso datore','employer','SI','sino',true],
  ['COMPENSI','Rapporto di lavoro precedente cessato','employmentEnded','SI','sino',true],
  ['COMPENSI','Prima iscrizione alla Cassa prima dei 35 anni','reducedMinimums','SI','sino',true],
  ['COMPENSI','Quota di partecipazione %','ownership',73,'numero'],
  ['COMPENSI','Utile distribuito %','distribution',61,'numero'],
  ['COMPENSI','Costi di struttura della società','companyOverhead',1723,'numero'],
  ['COMPENSI','Aliquota IRAP %','irapRate',4.2,'numero'],
  ['COMPENSI','Modalità di calcolo della società','mixMode','manuale','testo','manual'],
  ['COMPENSI','Quanto deve restare in società','retainInCompany',2789,'numero'],
  ['COMPENSI','Remunerazione dalla società','extractionMode','misto','testo','mix'],
  ['COMPENSI','Compenso amministratore','admin',8765,'numero'],
  ['COMPENSI','Previdenza sul compenso','adminTreatment','inps','testo'],
  ['COMPENSI','Aliquota Gestione Separata %','inpsRate',33.72,'numero'],
  ['COMPENSI','Aliquota soggettiva CNPADC %','pensionRate',18,'numero'],
  ['COMPENSI','Contributo di maternità','maternity',137,'numero'],
  ['COMPENSI','Addizionale regionale %','regionalRate',1.51,'numero'],
  ['COMPENSI','Addizionale comunale %','municipalRate',0.63,'numero'],
];
export const COST_MATRIX = [
  ['Voce di costo','nome','Costo custom fittizio'],
  ['Importo annuale','amount',3132.45],
  ['Importo IVA compresa','gross','SI',true],
  ['Aliquota IVA %','iva',13,0.13],
  ['Uso professionale %','uso',71,0.71],
  ['IVA detraibile % ordinario','ivaOrd',62,0.62],
  ['IVA detraibile % società','ivaSoc',53,0.53],
  ['Deducibile % IRPEF','dedOrd',44,0.44],
  ['Deducibile % IRES','dedSoc',35,0.35],
  ['Deducibile % IRAP','irap',26,0.26],
  ['Tetto % dei compensi','tetto',17,0.17],
];
export const AI_MATRIX = [
  ['Tipo','tipo','Verifica'],['Codice / campo','rif','revenue'],
  ['Elemento da verificare','elemento','Dati fittizi verificati'],['Stato','stato','Verificato'],
  ['Osservazione / assunzione','osservazione','Assunzione fittizia'],
  ['Fonte utilizzata','fonte','Fonte fittizia locale'],
];
const aliases = label => label.includes('dell’anno') ? [label,label.replace('dell’anno',"dell'anno"),label.replace('dell’anno','dell anno')] : [label];
const expectedState = Object.fromEntries(MATRIX.map(([, ,key,value,,expected])=>[key,expected??value]));
let runner;
before(async()=>{runner=await startWorkerBrowser();});
after(async()=>{await runner?.close();});
async function using(check,api){const h=await runner.open('confronto-regimi',{api});try{await check(h);assert.deepEqual(h.errors,[]);}finally{await h.close();}}
async function sentinel(page) {
  await page.evaluate(()=>{
    cfSetStato({...cfStatoDefault(),profession:'avvocato',currentRegime:'ordinario',
      year:2026,subjectName:'SENTINELLA',revenue:71234,previousRevenue:65321,otherIncome:18900,
      pensionRate:21,admin:321,distribution:67,mixMode:'manual'});
    const costs=cfNuoviCosti(); costs[0].amount=1289;costs[0].dedOrd=0.63;
    costs.push({...costs[0],id:'sentinel-custom',nome:'Sentinella custom',amount:432,custom:true});
    cfSetCosti(costs);cfSetEsitiAI([{elemento:'Sentinella AI',stato:'Aperto'}]);
    cfSetUltimoEsito({sentinel:'risultato'});cfScriviStato();cfRenderCosti();cfSalvaLavoro(true);
    localStorage.setItem(cfKeys.archivio,JSON.stringify([{id:'sentinel',dati:'archivio precedente'}]));
    sessionStorage.setItem('import-sentinel','sessione precedente');
    document.getElementById('cfRevenue').value='71234,25'; // input non ancora applicato
    document.getElementById('cfChartMain').innerHTML='<text>Grafico sentinella</text>';
    window.__toasts=[];const toast=cfToast;window.cfToast=(m,...args)=>{__toasts.push(m);return toast(m,...args);};
    window.__snapshot=()=>JSON.stringify({state:cfStato(),costs:cfCosti(),ai:cfEsitiAI(),last:cfUltimoEsito(),
      current:cfRisultatoCorrente(),storage:Object.entries(localStorage).sort(),session:Object.entries(sessionStorage).sort(),
      fields:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='file').map(e=>[e.id,e.value,e.checked]),
      charts:['cfChartMain','cfChartReadout','cfThresholdLead','cfPerche','cfChecks'].map(id=>[id,document.getElementById(id)?.innerHTML])});
    window.__before=__snapshot();window.__oldState=cfStato();window.__oldCosts=cfCosti();
  });
}
function pairs(rows){return {COMPENSI:[['Campo','Valore'],...rows]};}
async function book(page,sheets,cells={}) {
  return page.evaluate(({sheets,cells})=>{
    const wb=XLSX.utils.book_new();
    for(const [name,rows] of Object.entries(sheets))XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
    for(const [name,values] of Object.entries(cells))Object.assign(wb.Sheets[name],values);
    return XLSX.write(wb,{type:'base64',bookType:'xlsx'});
  },{sheets,cells});
}
async function parse(page,data,options={}){
  return page.evaluate(({data,options})=>{
    try {
      const r=cfImportaWorkbook(XLSX.read(data,{type:'base64',sheetStubs:true,cellDates:true}),options);
      return {ok:true,r,state:cfStato(),costs:cfCosti(),ai:cfEsitiAI()};
    }catch(e){return {ok:false,error:e.message,unchanged:window.__before===window.__snapshot?.(),
      sameState:cfStato()===window.__oldState,sameCosts:cfCosti()===window.__oldCosts};}
  },{data,options});
}
async function invalid(page,sheets,cells,pattern) {
  await sentinel(page);
  const data=await book(page,sheets,cells);
  await page.locator('#cfFile').setInputFiles({name:'fittizio.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(data,'base64')});
  await page.waitForFunction(()=>__toasts.some(t=>t.startsWith('Import non eseguito:')));
  const result=await page.evaluate(()=>({error:__toasts.join('\n'),unchanged:__snapshot()===__before,
    sameState:cfStato()===__oldState,sameCosts:cfCosti()===__oldCosts}));
  assert.match(result.error,pattern);assert.equal(result.unchanged,true,result.error);
  assert.equal(result.sameState,true);assert.equal(result.sameCosts,true);
}
for(const label of aliases('Compensi dell’anno'))test('Compensi 50000/86000: '+label,()=>using(async({page})=>{
  const r=await parse(page,await book(page,pairs([[label,50000],[label+' precedente',86000]])));
  assert.equal(r.ok,true,r.error);assert.equal(r.state.revenue,50000);assert.equal(r.state.previousRevenue,86000);
}));
test('Spazi, case e accenti innocui; corrente e precedente distinti',()=>using(async({page})=>{
  const r=await parse(page,await book(page,pairs([['  COMPENSI  DELL ANNO  ',50000],["compensi dell'anno   PRECEDENTE",86000]])));
  assert.equal(r.state.revenue,50000);assert.equal(r.state.previousRevenue,86000);
}));
for(const value of ['1.234,56','1234,56','1,234.56','1234.56',1234,0])test('Numero valido '+JSON.stringify(value),()=>using(async({page})=>{
  const r=await parse(page,await book(page,pairs([['Compensi dell’anno',value]])));
  assert.equal(r.ok,true,r.error);assert.equal(r.state.revenue,typeof value==='number'?value:1234.56);
}));
for(const value of ['1.234','1,234','NON DISPONIBILE','abc123','12abc','1.23.4','1,23.45',-1])test('Numero invalido e snapshot: '+value,()=>using(async({page})=>{
  await invalid(page,pairs([['Compensi dell’anno',50000],['Compensi dell’anno precedente',value]]),{},/COMPENSI, riga 3, colonna B \(B3\).*Compensi dell’anno precedente/);
}));
for(const [code,text] of [[0,'#NULL!'],[7,'#DIV/0!'],[15,'#VALUE!'],[23,'#REF!'],[29,'#NAME?'],[36,'#NUM!'],[42,'#N/A'],[43,'#GETTING_DATA']])
test('Cella/formula Excel in errore '+text,()=>using(async({page})=>{
  await invalid(page,pairs([['Compensi dell’anno',50000],['Compensi dell’anno precedente',86000]]),
    {COMPENSI:{B3:{t:'e',v:code,f:'1/0'}}},new RegExp('COMPENSI, riga 3, colonna B.*errore Excel '+text.replace(/[.*+?^$()|[\]\\]/g,'\\$&')));
}));
test('Formula senza risultato salvato',()=>using(async({page})=>{
  await invalid(page,pairs([['Compensi dell’anno',50000]]),{COMPENSI:{B2:{t:'n',f:'SUM(1,2)'}}},/COMPENSI, riga 2, colonna B.*formula senza risultato salvato/);
}));
test('Formula con risultato vuoto non diventa campo assente',()=>using(async({page})=>{
  await invalid(page,pairs([['Compensi dell’anno',50000]]),{COMPENSI:{B2:{t:'s',f:'IF(1=1,"",1)',v:''}}},/COMPENSI, riga 2, colonna B.*formula/);
}));
for(const values of [[50000,''],['',50000],[50000,50000],[50000,'50000,00']])test('Alias compatibili '+JSON.stringify(values),()=>using(async({page})=>{
  const r=await parse(page,await book(page,pairs([['Compensi dell’anno',values[0]],['Compensi dell anno',values[1]]])));
  assert.equal(r.ok,true,r.error);assert.equal(r.state.revenue,50000);assert.equal(r.r.compensi,1);
}));
test('Alias discordanti indicano entrambe le celle',()=>using(async({page})=>{
  await invalid(page,pairs([['Compensi dell’anno',50000],["Compensi dell'anno",60000]]),{},/COMPENSI!B2 e COMPENSI!B3/);
}));
test('Intestazione sconosciuta valorizzata non diventa default',()=>using(async({page})=>{
  await invalid(page,pairs([['Compensi dell anno corrente',50000]]),{},/COMPENSI, riga 2, colonna A.*intestazione non riconosciuta.*B2/);
}));
for(const [sheet,label,key,,type] of MATRIX)test('Dominio validato: '+sheet+'/'+label,()=>using(async({page})=>{
  const value=key==='subjectName'?'X'.repeat(81):type==='numero'?-1:'NON AMMESSO';
  await invalid(page,{[sheet]:[['Campo','Valore'],[label,value]]},{},new RegExp(sheet+', riga 2, colonna B'));
}));
for(const [label,value] of [['Quota di partecipazione %',101],['Aliquota soggettiva CNPADC %',11],['Aliquota Gestione Separata %',25],['Anno fiscale',2027]])
test('Dominio specifico '+label,()=>using(async({page})=>{
  await invalid(page,{[label==='Anno fiscale'?'PROFILO':'COMPENSI']:[['Campo','Valore'],[label,value]]},{},/fuori dominio|non previst/);
}));
test('Costi: riga senza nome non ignorata',()=>using(async({page})=>{
  await invalid(page,{COSTI:[['Voce di costo','Importo annuale'],['',321]]},{},/COSTI, riga 2, colonna B.*senza voce/);
}));
for(const [suffix,rows] of [['discordanti',[['Costo',120],['Costo',220]]],['testo',[['Costo','abc123']]]])
test('Costi invalidi '+suffix,()=>using(async({page})=>{
  await invalid(page,{COSTI:[['Voce di costo','Importo annuale'],...rows]},{},/COSTI.*Importo annuale/);
}));
test('Costi: righe e colonne duplicate compatibili, nessuna sovrascrittura vuota',()=>using(async({page})=>{
  const r=await parse(page,await book(page,{COSTI:[['Voce di costo','Importo annuale','Importo annuale'],['Costo',120,''],['Costo','',120]]}));
  assert.equal(r.ok,true,r.error);assert.equal(r.costs.find(c=>c.nome==='Costo').amount,120);
}));
test('Costi: colonne duplicate discordanti',()=>using(async({page})=>{
  await invalid(page,{COSTI:[['Voce di costo','Importo annuale','Importo annuale'],['Costo',120,220]]},{},/COSTI!B2 e COSTI!C2/);
}));
test('Esiti AI: errore di cella blocca il file intero',()=>using(async({page})=>{
  await invalid(page,{...pairs([['Compensi dell’anno',50000]]),'Esiti AI':[AI_MATRIX.map(r=>r[0]),AI_MATRIX.map(r=>r[2])]},
    {'Esiti AI':{F2:{t:'e',v:42}}},/Esiti AI, riga 2, colonna F.*Fonte utilizzata.*#N\/A/);
}));
for(const [column,key,,] of COST_MATRIX)test('Colonna costi validata: '+column,()=>using(async({page})=>{
  const row=COST_MATRIX.map(c=>c[2]),index=COST_MATRIX.findIndex(c=>c[0]===column);
  row[index]=key==='nome'?'X'.repeat(61):key==='gross'?'NON DISPONIBILE':key==='amount'?'abc123':101;
  await invalid(page,{COSTI:[COST_MATRIX.map(c=>c[0]),row]},{},/COSTI, riga 2, colonna/);
}));
for(let index=0;index<AI_MATRIX.length;index++)test('Colonna AI validata: '+AI_MATRIX[index][0],()=>using(async({page})=>{
  await invalid(page,{'Esiti AI':[AI_MATRIX.map(c=>c[0]),AI_MATRIX.map(c=>c[2])]},
    {'Esiti AI':{[String.fromCharCode(65+index)+'2']:{t:'e',v:15}}},/Esiti AI, riga 2, colonna.*#VALUE!/);
}));
test('PROFILO: colonne Campo/Valore riordinate e alias Valore duplicati',()=>using(async({page})=>{
  const r=await parse(page,await book(page,{PROFILO:[['Valore','Campo','Valore'],['avvocato','Professione',''],['ordinario','Regime attuale','ordinario']]}));
  assert.equal(r.ok,true,r.error);assert.equal(r.state.profession,'avvocato');assert.equal(r.state.currentRegime,'ordinario');
}));
test('PROFILO: colonne Valore discordanti indicano le due celle',()=>using(async({page})=>{
  await invalid(page,{PROFILO:[['Campo','Valore','Valore'],['Professione','avvocato','commercialista']]},{},/PROFILO!B2 e PROFILO!C2/);
}));
test('Colonna extra COSTI: avviso, importo ufficiale invariato',()=>using(async({page})=>{
  const r=await parse(page,await book(page,{COSTI:[['Voce di costo','Importo annuale','Importo ambiguo'],['Costo',100,200]]}));
  assert.equal(r.ok,true,r.error);assert.equal(r.costs.find(c=>c.nome==='Costo').amount,100);
  assert.deepEqual(r.r.avvisi,[{foglio:'COSTI',intestazione:'Importo ambiguo',numero:1,celle:['C2']}]);
}));
test('Riga Esiti AI senza elemento: blocco, nessun dato ignorato',()=>using(async({page})=>{
  await invalid(page,{'Esiti AI':[AI_MATRIX.map(c=>c[0]),['Verifica','','','Aperto','Nota fittizia','Fonte']]},{},/Esiti AI.*senza elemento/);
}));
test('Unione: campo dipendente valida contro la corrente senza rifiutare l’anteprima',()=>using(async({page})=>{
  await sentinel(page);const data=await book(page,pairs([['di cui lavoro dipendente anno corrente',10000]]));
  const preview=await parse(page,data,{soloAnteprima:true});assert.equal(preview.ok,true,preview.error);
  const merged=await parse(page,data,{unisciAllaCorrente:true});assert.equal(merged.ok,true,merged.error);
  assert.equal(merged.state.otherIncome,18900);assert.equal(merged.state.employeeIncomeCurr,10000);
  await sentinel(page);const fresh=await parse(page,data,{soloAnteprima:true,validaRelazioni:true});
  assert.equal(fresh.ok,false);assert.equal(fresh.unchanged,true);assert.match(fresh.error,/non può superare/);
}));
test('Campo assente: default in nuova, valore precedente in aggiornamento',()=>using(async({page})=>{
  await sentinel(page);const data=await book(page,pairs([['Compensi dell’anno',50000]]));
  let r=await parse(page,data,{unisciAllaCorrente:true});assert.equal(r.state.previousRevenue,65321);
  r=await parse(page,data);assert.equal(r.state.previousRevenue,80000);
}));

async function download(page,click) {
  const waiting=page.waitForEvent('download');await click();const file=await waiting;
  const chunks=[];for await(const c of await file.createReadStream())chunks.push(c);
  return {name:file.suggestedFilename(),buffer:Buffer.concat(chunks)};
}
async function official(page,fill=true) {
  await page.evaluate(()=>cfVaiA('profilo'));
  const file=await download(page,()=>page.locator('[data-action="download-template"]').filter({visible:true}).first().click());
  assert.match(file.name,/Template_Confronto_Regimi.*xlsx$/);
  return page.evaluate(({b64,matrix,costs,ai,fill})=>{
    const wb=XLSX.read(b64,{type:'base64'}),headers={};
    for(const sheet of ['PROFILO','COMPENSI']) {
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:''});
      headers[sheet]=rows.slice(1).map(r=>r[0]);
      if(fill)for(let i=1;i<rows.length;i++){
        const spec=matrix.find(m=>m[0]===sheet&&m[1]===rows[i][0]);
        if(!spec)throw new Error('Campo distribuito senza contratto: '+rows[i][0]);
        wb.Sheets[sheet]['B'+(i+1)]={t:typeof spec[3]==='number'?'n':'s',v:spec[3]};
      }
    }
    for(const name of ['COSTI','Esiti AI'])headers[name]=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1})[0];
    if(fill){
      XLSX.utils.sheet_add_aoa(wb.Sheets.COSTI,[costs.map(c=>c[2])],{origin:-1});
      wb.Sheets['Esiti AI']=XLSX.utils.aoa_to_sheet([ai.map(c=>c[0]),ai.map(c=>c[2])]);
    }
    return {headers,names:wb.SheetNames,data:XLSX.write(wb,{type:'base64',bookType:'xlsx'})};
  },{b64:file.buffer.toString('base64'),matrix:MATRIX,costs:COST_MATRIX,ai:AI_MATRIX,fill});
}
test('Matrice completa: template scaricato, 29 campi, 11 colonne costi, 6 Esiti AI',()=>using(async({page})=>{
  const f=await official(page);
  for(const s of ['PROFILO','COMPENSI'])assert.deepEqual(f.headers[s],MATRIX.filter(r=>r[0]===s).map(r=>r[1]));
  assert.deepEqual(f.headers.COSTI,COST_MATRIX.map(r=>r[0]));assert.deepEqual(f.headers['Esiti AI'],AI_MATRIX.map(r=>r[0]));
  assert.deepEqual(f.names.filter(n=>!['PROFILO','COMPENSI','COSTI','Esiti AI'].includes(n)),['ISTRUZIONI','ESEMPI_NON_IMPORTARE']);
  const r=await parse(page,f.data);assert.equal(r.ok,true,r.error);assert.deepEqual(r.state,expectedState);
  const cost=r.costs.find(c=>c.nome===COST_MATRIX[0][2]);
  for(const [,key,value,expected] of COST_MATRIX)assert.equal(cost[key],expected??value,key);
  for(const [,key,value] of AI_MATRIX)assert.equal(r.ai[0][key],value,key);
  assert.equal(r.ai[0].closed,true);
}));
test('Template intatto resta senza dati importabili',()=>using(async({page})=>{
  const f=await official(page,false);const r=await parse(page,f.data,{soloAnteprima:true});
  assert.equal(r.ok,false);assert.match(r.error,/nessun dato da importare/);
}));
test('Template storico distribuito v1.0: tutti i campi riconosciuti senza correggere il file originale',()=>using(async({page})=>{
  const b64=readFileSync(new URL('../resources/templates/Template_Confronto_Regimi_v1.0.xlsx',import.meta.url)).toString('base64');
  const data=await page.evaluate(({b64,matrix})=>{
    const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace('dell’anno','dell anno').toLowerCase();
    const wb=XLSX.read(b64,{type:'base64'});let count=0;
    for(const name of ['PROFILO','COMPENSI']) {
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:''});
      for(let r=1;r<rows.length;r++) {
        const field=matrix.find(m=>m[0]===name&&norm(m[1])===norm(rows[r][0]));
        if(!field)throw new Error('Campo storico non riconosciuto: '+rows[r][0]);
        wb.Sheets[name]['B'+(r+1)]={t:typeof field[3]==='number'?'n':'s',v:field[3]};count++;
      }
    }
    if(count!==matrix.length)throw new Error('Matrice incompleta: '+count);
    return XLSX.write(wb,{type:'base64',bookType:'xlsx'});
  },{b64,matrix:MATRIX});
  const r=await parse(page,data);assert.equal(r.ok,true,r.error);assert.deepEqual(r.state,expectedState);
}));
test('Import valido parziale: il risultato precedente non resta associato ai nuovi input',()=>using(async({page})=>{
  await sentinel(page);const r=await parse(page,await book(page,pairs([['Compensi dell anno',50000]])));
  assert.equal(r.ok,true,r.error);assert.equal(await page.evaluate(()=>cfUltimoEsito()),null);
  assert.equal(await page.evaluate(()=>cfRisultatoCorrente()),null);
}));
test('Errore di salvataggio: stato, input, risultato e archivio invariati',()=>using(async({page})=>{
  await sentinel(page);const data=await book(page,pairs([['Compensi dell’anno',50000]]));
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){
    if(k===cfKeys.stato)throw new DOMException('Quota simulata','QuotaExceededError');return original.call(this,k,v);};});
  await page.locator('#cfFile').setInputFiles({name:'fittizio.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(data,'base64')});
  await page.getByRole('button',{name:'Importa come simulazione nuova',exact:true}).click();
  await page.waitForFunction(()=>__toasts.some(t=>t.includes('salvataggio non riuscito')));
  assert.equal(await page.evaluate(()=>__snapshot()===__before),true);
}));

const EXTRA_SENTINEL='ANNOTAZIONE_PRIVATA_NON_IMPORTARE_X9_Q7_831245';
const EXTRA_ROWS = {
  PROFILO: [['Campo','Valore','Come si compila'],['Professione','commercialista','Indicazione del template']],
  COMPENSI: [['Campo','Valore','Come si compila'],['Compensi dell anno',50000,''],['Compensi dell anno precedente',86000,'']],
  COSTI: [COST_MATRIX.map(c=>c[0]),COST_MATRIX.map(c=>c[2])],
  'Esiti AI': [AI_MATRIX.map(c=>c[0]),AI_MATRIX.map(c=>c[2])],
};
function withExtra(sheet,values,labels=['Nota interna utente']) {
  return {[sheet]:EXTRA_ROWS[sheet].map((row,r)=>[...row,...(r===0?labels:labels.map((_,c)=>values[c]??''))])};
}
for(const sheet of Object.keys(EXTRA_ROWS)) {
  test('Extra vuota accettata senza avviso: '+sheet,()=>using(async({page})=>{
    const base=await parse(page,await book(page,{[sheet]:EXTRA_ROWS[sheet]}),{soloAnteprima:true});
    const r=await parse(page,await book(page,withExtra(sheet,[])),{soloAnteprima:true});
    assert.equal(r.ok,true,r.error);assert.deepEqual(r.r,base.r);
  }));
  test('Extra con commenti ignorata con avviso: '+sheet,()=>using(async({page})=>{
    const base=await parse(page,await book(page,{[sheet]:EXTRA_ROWS[sheet]}),{soloAnteprima:true});
    const r=await parse(page,await book(page,withExtra(sheet,[EXTRA_SENTINEL])),{soloAnteprima:true});
    assert.equal(r.ok,true,r.error);
    assert.deepEqual(r.r.statoLetto,base.r.statoLetto);assert.deepEqual(r.r.costiLetti,base.r.costiLetti);assert.deepEqual(r.r.esitiLetti,base.r.esitiLetti);
    assert.equal(r.r.avvisi.length,1);assert.equal(r.r.avvisi[0].intestazione,'Nota interna utente');
    assert.equal(r.r.avvisi[0].foglio,sheet);assert.equal(r.r.avvisi[0].numero,EXTRA_ROWS[sheet].length-1);
    assert.ok(!JSON.stringify(r).includes(EXTRA_SENTINEL),'nemmeno il rapporto trattiene il contenuto della nota');
  }));
  test('Due colonne extra diagnosticate separatamente: '+sheet,()=>using(async({page})=>{
    const r=await parse(page,await book(page,withExtra(sheet,[EXTRA_SENTINEL,'Seconda nota'],['Nota interna utente','Commenti personali'])),{soloAnteprima:true});
    assert.equal(r.ok,true,r.error);assert.deepEqual(r.r.avvisi.map(a=>a.intestazione),['Nota interna utente','Commenti personali']);
    assert.ok(!JSON.stringify(r).includes(EXTRA_SENTINEL));
  }));
}
for(const sheet of ['PROFILO','COMPENSI']) {
  for(const value of [EXTRA_SENTINEL,50000,0,false])test('Campo senza Valore e dato extra: '+sheet+' / '+value,()=>using(async({page})=>{
    const rows=withExtra(sheet,[value]);rows[sheet][1][1]='';
    await invalid(page,rows,{},new RegExp(sheet+'.*non contiene un valore nella colonna "Valore".*Nota interna utente'));
  }));
  test('Campo sconosciuto con valore TAL e nota resta bloccato: '+sheet,()=>using(async({page})=>{
    const rows=withExtra(sheet,[EXTRA_SENTINEL]);rows[sheet][1][0]='Compensi dell anno corrente';
    await invalid(page,rows,{},/intestazione non riconosciuta.*Compensi dell anno corrente/);
  }));
  test('Campo sconosciuto con solo nota resta bloccato: '+sheet,()=>using(async({page})=>{
    const rows=withExtra(sheet,[EXTRA_SENTINEL]);rows[sheet][1][0]='Campo non TAL';rows[sheet][1][1]='';
    await invalid(page,rows,{},/intestazione non riconosciuta.*Campo non TAL/);
  }));
  for(const [index,bad] of [[0,'Campi'],[1,'Valori']])test('Struttura minima: '+sheet+' non riconosce '+bad,()=>using(async({page})=>{
    const rows=withExtra(sheet,[EXTRA_SENTINEL]);rows[sheet][0][index]=bad;
    await invalid(page,rows,{},/sono richieste le colonne "Campo" e "Valore"/);
  }));
}
test('COSTI e AI: le colonne principali restano obbligatorie',()=>using(async({page})=>{
  await invalid(page,{COSTI:[['Nome del costo','Importo annuale','Nota interna utente'],['Costo',100,EXTRA_SENTINEL]]},{},/Voce di costo.*intestazione non trovata/);
}));
test('Esiti AI: extra non sostituisce Elemento da verificare',()=>using(async({page})=>{
  await invalid(page,{'Esiti AI':[['Elemento da controllare','Stato','Nota interna utente'],['Verifica','Aperto',EXTRA_SENTINEL]]},{},/Elemento da verificare.*intestazione non trovata/);
}));
test('Alias Valore duplicato: una colonna vuota non fa scattare il blocco della nota',()=>using(async({page})=>{
  const r=await parse(page,await book(page,{COMPENSI:[['Campo','Valore','Valore','Nota interna utente'],['Compensi dell anno','',50000,EXTRA_SENTINEL]]}));
  assert.equal(r.ok,true,r.error);assert.equal(r.state.revenue,50000);assert.equal(r.r.avvisi.length,1);
}));
test('Note senza riga TAL in COSTI e AI: annotate, senza creare righe nel modello',()=>using(async({page})=>{
  for(const sheet of ['COSTI','Esiti AI']) {
    const rows=withExtra(sheet,[EXTRA_SENTINEL]);const length=EXTRA_ROWS[sheet][0].length;
    rows[sheet].push([...Array(length).fill(''),EXTRA_SENTINEL]);
    const r=await parse(page,await book(page,rows));
    assert.equal(r.ok,true,r.error);assert.equal(r.r.avvisi[0].numero,2);
    if(sheet==='COSTI')assert.equal(r.r.nuove,1);else assert.equal(r.ai.length,1);
  }
}));
test('Nelle sole extra errori/formule non vengono interpretati come valori TAL',()=>using(async({page})=>{
  for(const cell of [{t:'e',v:7},{t:'n',f:'SUM(1,2)'},{t:'s',v:EXTRA_SENTINEL}]) {
    const r=await parse(page,await book(page,withExtra('COMPENSI',['']),{COMPENSI:{D2:cell}}));
    assert.equal(r.ok,true,r.error);assert.equal(r.state.revenue,50000);assert.equal(r.state.previousRevenue,86000);
    assert.equal(r.r.avvisi[0].numero,1);
  }
}));
test('Extra non maschera un numero TAL invalido',()=>using(async({page})=>{
  const rows=withExtra('COMPENSI',[EXTRA_SENTINEL]);rows.COMPENSI[1][1]='NON DISPONIBILE';
  await invalid(page,rows,{},/COMPENSI, riga 2, colonna B.*numero non valido/);
}));
test('Avvisi persistenti, escaping e nessuna modifica in caso di annullamento',()=>using(async({page})=>{
  await sentinel(page);
  const label='Nota <img src=x onerror=alert(1)> interna';
  const data=await book(page,withExtra('COMPENSI',[EXTRA_SENTINEL],[label]));
  await page.locator('#cfFile').setInputFiles({name:'extra-fittizie.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(data,'base64')});
  const modal=page.locator('#cfModal');
  await modal.waitFor({state:'visible'});assert.ok((await modal.innerText()).includes(label));
  assert.ok((await modal.innerText()).includes('non verrà importata'));assert.ok(!(await modal.innerText()).includes(EXTRA_SENTINEL));
  assert.equal(await modal.locator('img').count(),0);assert.equal(await page.evaluate(()=>__snapshot()===__before),true);
  await page.getByRole('button',{name:'Annulla',exact:true}).click();
  assert.equal(await page.evaluate(()=>__snapshot()===__before),true);
  assert.equal(await page.locator('#cfImportWarnings').count(),0);
}));

// Disponibile nel checkout accoppiato; il pubblico in CI non contiene il motore.
const workerPath=fileURLToPath(new URL('../../tax-automation-lab-backend/src/index.js',import.meta.url));
test('Privacy extra: payload identico, avviso persistente e sentinella assente da stato/archivio/Excel/backup',
  {skip:!existsSync(workerPath)&&'richiede il repository backend privato'},async()=>{
    const {default:worker}=await import(pathToFileURL(workerPath).href);
    const api=request=>worker.fetch(new Request('http://localhost'+new URL(request.url()).pathname,{
      method:request.method(),headers:{'content-type':'application/json'},body:request.postData()||undefined}),{AMBIENTE:'sviluppo'});
    const runs=[];
    for(const annotated of [false,true]) await using(async(h)=>{
      const {page}=h,network=[];
      page.on('request',r=>network.push({url:r.url(),body:r.postData()}));
      const f=await official(page);
      const data=await page.evaluate(({data,annotated,sentinel})=>{
        const wb=XLSX.read(data,{type:'base64'});
        if(annotated)for(const sheet of ['PROFILO','COMPENSI','COSTI','Esiti AI']){
          const ws=wb.Sheets[sheet],range=XLSX.utils.decode_range(ws['!ref']);
          // Solo righe già compilate in Valore per PROFILO/COMPENSI: il caso C
          // è provato separatamente e deve continuare a bloccare.
          XLSX.utils.sheet_add_aoa(ws,[['Nota interna utente','Commenti personali'],[sentinel,sentinel]],{origin:{r:0,c:range.e.c+1}});
        }
        return XLSX.write(wb,{type:'base64',bookType:'xlsx'});
      },{data:f.data,annotated,sentinel:EXTRA_SENTINEL});
      await page.locator('#cfFile').setInputFiles({name:'annotazioni-fittizie.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(data,'base64')});
      const modal=page.locator('#cfModal');await modal.waitFor({state:'visible'});
      if(annotated){
        const text=await modal.innerText();assert.ok(text.includes('non verrà importata'));
        for(const sheet of ['PROFILO','COMPENSI','COSTI','Esiti AI'])assert.ok(text.includes(sheet+':'));
        assert.equal(await modal.locator('li').filter({hasText:'non fa parte del template TAL'}).count(),8);
        assert.ok(!text.includes(EXTRA_SENTINEL));
      }
      await page.getByRole('button',{name:'Importa',exact:true}).click();
      await page.waitForFunction(()=>!!cfRisultatoCorrente());
      assert.deepEqual(await page.evaluate(()=>cfStato()),expectedState);
      const model=await page.evaluate(()=>({state:cfStato(),costs:cfCosti(),ai:cfEsitiAI(),
        stored:JSON.parse(localStorage.getItem(cfKeys.stato))}));
      assert.ok(!JSON.stringify(model).includes(EXTRA_SENTINEL));
      if(annotated){
        const warnings=page.locator('#cfImportWarnings');assert.equal(await warnings.isVisible(),true);
        assert.equal(await warnings.locator('li').count(),8);
        assert.ok(!(await warnings.innerText()).includes(EXTRA_SENTINEL));
        await page.evaluate(()=>cfVaiA('compensi'));
        assert.equal(await warnings.isVisible(),true,'il riepilogo resta dopo navigazione');
        await page.setViewportSize({width:375,height:812});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'riepilogo senza overflow mobile');
        await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>cfVaiA('confronto'));
        await page.waitForFunction(()=>!!cfRisultatoCorrente());
        assert.equal(await warnings.isVisible(),true);
      }
      await page.getByRole('button',{name:'Salva',exact:true}).click();
      const stored=await page.evaluate(()=>Object.entries(localStorage));
      assert.ok(!JSON.stringify(stored).includes(EXTRA_SENTINEL),'nessun contenuto extra in alcuno storage persistito');
      const archive=await page.evaluate(()=>cfLeggiArchivio());
      assert.equal(archive.length,1);assert.ok(!JSON.stringify(archive).includes(EXTRA_SENTINEL));
      const excel=await download(page,()=>page.getByRole('button',{name:'Esporta in Excel',exact:true}).click());
      const contents=await page.evaluate(data=>JSON.stringify(XLSX.read(data,{type:'base64'})),excel.buffer.toString('base64'));
      assert.ok(!contents.includes(EXTRA_SENTINEL),'sentinella assente da tutti i fogli Excel');
      await page.evaluate(()=>cfVaiA('dati'));
      const backup=await download(page,()=>page.locator('[data-action="backup"]').click());
      assert.ok(!backup.buffer.toString().includes(EXTRA_SENTINEL),'sentinella assente anche dal backup');
      const bodies=h.requests.filter(r=>r.method==='POST').map(r=>r.body);
      assert.ok(bodies.length);assert.ok(!JSON.stringify(network).includes(EXTRA_SENTINEL));
      runs.push({model,bodies});
      if(annotated){
        // Una successiva importazione rifiutata lascia intatti anche risultato,
        // grafici, archivio e il precedente riepilogo delle colonne escluse.
        await page.evaluate(()=>{
          window.__toasts=[];const toast=cfToast;window.cfToast=(m,...args)=>{__toasts.push(m);return toast(m,...args);};
          window.__snapExtra=()=>JSON.stringify({state:cfStato(),costs:cfCosti(),ai:cfEsitiAI(),r:cfRisultatoCorrente(),last:cfUltimoEsito(),
            fields:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='file').map(e=>[e.id,e.value,e.checked]),
            chart:document.getElementById('cfChartMain').innerHTML,warnings:document.getElementById('cfImportWarnings').innerHTML,
            storage:Object.entries(localStorage).sort()});
          window.__beforeExtra=__snapExtra();
        });
        const bad=withExtra('COMPENSI',[EXTRA_SENTINEL]);bad.COMPENSI[1][1]='';
        await page.locator('#cfFile').setInputFiles({name:'colonna-errata.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await book(page,bad),'base64')});
        await page.waitForFunction(()=>__toasts.some(t=>t.startsWith('Import non eseguito:')));
        assert.equal(await page.evaluate(()=>__snapExtra()===__beforeExtra),true);
        // Un nuovo import senza note sostituisce il precedente riepilogo.
        await page.locator('#cfFile').setInputFiles({name:'senza-note.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(f.data,'base64')});
        await page.getByRole('button',{name:'Importa come simulazione nuova',exact:true}).click();
        await page.waitForFunction(()=>document.getElementById('cfImportWarnings').hidden);
      }
    },api);
    assert.deepEqual(runs[1].model,runs[0].model,'stessi input e stesso stato persistito');
    assert.deepEqual(runs[1].bodies,runs[0].bodies,'payload di rete identico byte per byte');
  });
test('Round-trip pulsante → file → import → Worker reale → confronto/grafici → Excel e payload',
  {skip:!existsSync(workerPath)&&'richiede il repository backend privato, verificato dal suo E2E'},async()=>{
    const {default:worker}=await import(pathToFileURL(workerPath).href);
    const api=request=>worker.fetch(new Request('http://localhost'+new URL(request.url()).pathname,{
      method:request.method(),headers:{'content-type':'application/json'},body:request.postData()||undefined}),{AMBIENTE:'sviluppo'});
    await using(async(h)=>{
      const {page}=h,f=await official(page);
      await page.locator('#cfFile').setInputFiles({name:'round-trip-fittizio.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(f.data,'base64')});
      await page.getByRole('button',{name:'Importa',exact:true}).click();
      await page.waitForFunction(()=>!!cfRisultatoCorrente());
      assert.deepEqual(await page.evaluate(()=>cfStato()),expectedState);
      assert.ok(await page.locator('#cfChartMain').innerHTML());
      assert.equal(await page.locator('#cfApiRiprova').count(),0);
      const bodies=h.requests.filter(r=>r.method==='POST').map(r=>JSON.parse(r.body));
      assert.ok(bodies.length);const input=bodies.at(-1).input;
      assert.equal(input.revenue,50000);assert.equal(input.previousRevenue,86000);
      assert.ok(!JSON.stringify(bodies).includes('FITTIZIA'));assert.ok(!JSON.stringify(bodies).includes('fittizio'));
      const banned=['subjectName','subjectKind','currentRegime','nome','nota','fonte','esiti'];
      function walk(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){assert.ok(!banned.includes(k),'campo locale nel payload: '+k);walk(x);}}
      walk(input);
      assert.deepEqual(Object.keys(input).sort(),MATRIX.map(r=>r[2]).filter(k=>!banned.includes(k)).concat('costs').sort());
      for(const cost of input.costs) {
        assert.deepEqual(Object.keys(cost).sort(),['id','amount','gross','iva','ivaOrd','ivaSoc','dedOrd','dedSoc','irap','uso','tetto'].sort());
        assert.equal(typeof cost.id,'string'); // identificatore tecnico già previsto dal contratto
      }
      assert.ok(h.requests.every(r=>new URL(r.url).pathname.startsWith('/api/')));
      await page.getByRole('button',{name:'Salva',exact:true}).click();
      assert.equal(await page.evaluate(()=>cfLeggiArchivio().length),1);
      const excel=await download(page,()=>page.getByRole('button',{name:'Esporta in Excel',exact:true}).click());
      const output=await page.evaluate(b64=>{
        const wb=XLSX.read(b64,{type:'base64'});return Object.fromEntries(wb.SheetNames.map(n=>[n,XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:''})]));
      },excel.buffer.toString('base64'));
      assert.ok(excel.buffer.length>10000);assert.ok(Object.keys(output).length>=4);
      assert.ok(JSON.stringify(output).includes('50000'));assert.ok(JSON.stringify(output).includes('86000'));
      // Un errore successivo conserva anche un vero risultato del Worker e grafici.
      await page.evaluate(()=>{
        window.__toasts=[];const toast=cfToast;window.cfToast=(m,...args)=>{__toasts.push(m);return toast(m,...args);};
        window.__snapReal=()=>JSON.stringify({s:cfStato(),c:cfCosti(),ai:cfEsitiAI(),r:cfRisultatoCorrente(),last:cfUltimoEsito(),
          storage:Object.entries(localStorage).sort(),chart:document.getElementById('cfChartMain').innerHTML});
        window.__realBefore=__snapReal();
      });
      const bad=await book(page,pairs([['Compensi dell anno',50000],["Compensi dell'anno",60000]]));
      await page.locator('#cfFile').setInputFiles({name:'invalido.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bad,'base64')});
      await page.waitForFunction(()=>__toasts.some(t=>t.startsWith('Import non eseguito:')));
      assert.equal(await page.evaluate(()=>__snapReal()===__realBefore),true);
    },api);
  });
