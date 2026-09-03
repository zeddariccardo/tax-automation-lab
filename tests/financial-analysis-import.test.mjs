/* Import Safety Analisi: XLSX fittizi in memoria e file chooser reale.
 * Il blocco dei duplicati è temporaneo: sezione|codice collide nel mapping.
 * Il template ammette sottoconti; identità indipendenti richiedono un task separato.
 * Il backend privato, se disponibile, viene usato esclusivamente in sola lettura. */
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {startWorkerBrowser} from './worker-browser-harness.mjs';
import {financialAnalysisCases} from './financial-analysis-fixtures.mjs';

let runner,calculate;
const backend=new URL('../../tax-automation-lab-backend/src/financial-analysis/',import.meta.url);
const hasBackend=existsSync(new URL('motore.js',backend));
before(async()=>{
  if(hasBackend){const {calcola}=await import(new URL('motore.js',backend)),{validaPayload}=await import(new URL('validazione.js',backend));calculate=p=>calcola(validaPayload(p));}
  runner=await startWorkerBrowser();
});
after(async()=>{await runner?.close();});
async function withAnalysis(check){
  const h=await runner.open('financial-analysis',{origin:'http://127.0.0.1',api:async request=>{
    if(new URL(request.url()).pathname==='/api/stato')return Response.json({ok:true});
    return Response.json(calculate?calculate(JSON.parse(request.postData())):{contractVersion:0});
  }});
  try{
    await h.page.evaluate(()=>FA_APP.configureForTests({debounceMs:0}));
    await check(h);
    assert.deepEqual(h.errors,[],'nessun errore JavaScript');
  }finally{await h.close();}
}
async function seed(page){
  await page.evaluate(fixture=>{
    FA_APP.loadFixture(fixture);
    localStorage.setItem('tal_financial_analysis_configs_v3',JSON.stringify({SENTINELLA:{company:{name:'Archivio precedente'},note:'DA PRESERVARE'}}));
    sessionStorage.setItem('sentinella-import','SESSIONE PRECEDENTE');
  },financialAnalysisCases[6].fixture);
  await page.waitForFunction(()=>['ready','error'].includes(FA_APP.diagnostics().status));
  await page.evaluate(()=>{
    STATE.fileMeta={main:{sentinel:123}};STATE.scenarioMeta={sentinel:456};
    const encode=(key,value)=>value instanceof Set?[...value]:value;
    window.__snapshot=()=>JSON.stringify({
      state:STATE,result:FA_APP.result(),analysis:FA_APP.diagnostics(),
      payload:FA_APP.buildPayload(),
      storage:Object.entries(localStorage).sort(),session:Object.entries(sessionStorage).sort(),
      views:[...document.querySelectorAll('.fs-view')].map(e=>[e.id,e.innerHTML,e.className]),
      inputs:[...document.querySelectorAll('input,select,textarea')].filter(e=>e.type!=='file').map(e=>[e.id,e.value,e.checked]),
      hash:location.hash
    },encode);
    // buildPayload è il percorso esistente e può preparare attributi dello storico.
    window.__before=__snapshot();
    window.__refs=[STATE.accounts,STATE.attrs,STATE.reclassMap,STATE.scenarios,STATE.centers,STATE.adjustments,STATE.history,STATE.selected];
  });
}
async function workbook(page,options={}){
  return page.evaluate(o=>{
    const wb=XLSX.utils.book_new(),head=['Codice conto','Descrizione conto','Importo esercizio corrente','Importo esercizio precedente','Voce IV Direttiva'];
    const add=(n,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),n);
    add('Anagrafica',o.company||[['Denominazione','AZIENDA FITTIZIA NUOVA'],['Partita IVA','01234567890'],['Schema di bilancio','Abbreviato'],['Periodo — dal','2025-01-01'],['Periodo — al','2025-12-31']]);
    for(const [sheet,key]of[['Stato Patrimoniale','sp'],['Conto Economico','ce']]){
      const headers=o.headers||head,rows=o[key]||(key==='sp'?[['0001','Banca fittizia',1000,800,'CIV'],['0002','Capitale fittizio',-1000,-800,'AI']]:[['R1','Ricavi fittizi',-1000,-800,'A1'],['C1','Servizi fittizi',300,200,'B7']]);
      add(sheet,[...(o.title?[['Bilancio di verifica fittizio']]:[]),headers,...rows.map(row=>headers.map(label=>row[head.indexOf(label)]??''))]);
    }
    for(const [sheet,rows]of Object.entries(o.sheets||{})){if(wb.Sheets[sheet])wb.Sheets[sheet]=XLSX.utils.aoa_to_sheet(rows);else add(sheet,rows);}
    for(const [sheet,cells]of Object.entries(o.cells||{}))Object.assign(wb.Sheets[sheet],cells);
    if(o.date1904)wb.Workbook={WBProps:{date1904:true}};
    if(o.only){wb.SheetNames=wb.SheetNames.filter(n=>o.only.includes(n));for(const n of Object.keys(wb.Sheets))if(!wb.SheetNames.includes(n))delete wb.Sheets[n];}
    if(o.remove){wb.SheetNames=wb.SheetNames.filter(n=>n!==o.remove);delete wb.Sheets[o.remove];}
    return XLSX.write(wb,{type:'base64',bookType:'xlsx'});
  },options);
}
async function upload(page,b64,kind='main'){
  const selector={main:'importMain(event)',budget:"importScenario(event,'budget')",forecast:"importScenario(event,'forecast')",centers:'importCenters(event)',benchmark:'importBenchmark(event)',history:'importHistory(event)'}[kind];
  await page.evaluate(()=>document.getElementById('toast').textContent='');
  await page.locator('input[onchange="'+selector+'"]').setInputFiles({name:'import-fittizio.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(b64,'base64')});
  await page.waitForFunction(()=>/^Import annullato:|Import completato/.test(document.getElementById('toast').textContent)||document.getElementById('toast').textContent.includes('Import completato'));
  return page.locator('#toast').textContent();
}
async function rejected(h,options,pattern,kind='main'){
  await seed(h.page);
  const n=h.requests.length,b64=await workbook(h.page,options),message=await upload(h.page,b64,kind);
  assert.match(message,/^Import annullato:/);assert.match(message,pattern);
  const evidence=await h.page.evaluate(()=>({
    unchanged:__snapshot()===__before,
    refs:__refs.every((ref,i)=>ref===[STATE.accounts,STATE.attrs,STATE.reclassMap,STATE.scenarios,STATE.centers,STATE.adjustments,STATE.history,STATE.selected][i])
  }));
  assert.deepEqual(evidence,{unchanged:true,refs:true},'stato, risultato, KPI, grafici, gate, mapping e archivio invariati');
  assert.equal(h.requests.length,n,'nessuna richiesta su import rifiutato');
  return message;
}

for(const [value,expected]of[['1.234,56',1234.56],['1234,56',1234.56],['1,234.56',1234.56],['1234.56',1234.56],[1234,1234],[-1234.56,-1234.56],['-1234,56',-1234.56]]){
  test('importi validi: '+value,()=>withAnalysis(async h=>{
    const message=await upload(h.page,await workbook(h.page,{cells:{'Conto Economico':{C3:{t:typeof value==='number'?'n':'s',v:value}}}}));
    assert.match(message,/Import completato/);
    assert.equal(await h.page.evaluate(()=>STATE.accounts.find(a=>a.code==='C1').current),expected);
  }));
}
for(const [name,cell,pattern]of[
  ['NON DISPONIBILE',{t:'s',v:'NON DISPONIBILE'},/numero non valido/],
  ['abc123',{t:'s',v:'abc123'},/numero non valido/],
  ['ambiguo punto',{t:'s',v:'1.234'},/ambiguo/],
  ['ambiguo virgola',{t:'s',v:'1,234'},/ambiguo/],
  ['errore Excel',{t:'e',v:7,f:'1/0'},/#DIV\/0!/],
  ['N/A',{t:'e',v:42},/#N\/A/],
  ['VALUE',{t:'e',v:15},/#VALUE!/],
  ['formula senza cache',{t:'n',f:'SUM(1,2)'},/formula senza risultato/],
  ['formula con cache vuota',{t:'s',f:'IF(1,"","")',v:''},/formula senza risultato/],
  ['booleano',{t:'b',v:true},/numero non valido/],
]){
  test(name+': annullamento con stato sentinella',()=>withAnalysis(async h=>{
    const message=await rejected(h,{cells:{'Conto Economico':{C3:cell}}},pattern);
    assert.match(message,/Conto Economico, riga 3, cella C3, importo (?:esercizio )?corrente/i);
  }));
}
for(const [name,options,pattern]of[
  ['file malformato',{sheets:{'Conto Economico':[['Header sbagliato'],['dato']]},remove:'Stato Patrimoniale'},/Stato Patrimoniale/],
  ['riga senza codice',{cells:{'Conto Economico':{A3:{t:'s',v:''}}}},/riga 3, cella A3.*senza identificativo/],
  ['voce senza classificazione',{cells:{'Conto Economico':{E3:{t:'s',v:'???'}}}},/cella E3.*voce non riconosciuta/],
  ['data impossibile ISO',{cells:{Anagrafica:{B5:{t:'s',v:'2025-02-30'}}}},/Anagrafica.*B5.*data impossibile/],
  ['data impossibile italiana',{cells:{Anagrafica:{B5:{t:'s',v:'31\/02\/2025'}}}},/data impossibile/],
  ['data Excel inesistente 1900-02-29',{cells:{Anagrafica:{B5:{t:'n',v:60,z:'dd/mm/yyyy'}}}},/data impossibile/],
  ['date invertite',{cells:{Anagrafica:{B4:{t:'s',v:'2026-01-01'}}}},/successivo/],
  ['errore in anagrafica',{cells:{Anagrafica:{B1:{t:'e',v:7}}}},/#DIV\/0!/],
  ['benchmark principale senza header',{sheets:{Benchmark:[['errato'],['prof_ros',.1]]}},/Benchmark.*Intestazioni/],
  ['Esiti AI valorizzato non ignorato',{sheets:{'Esiti AI':[['Tipo','Codice conto / campo','Elemento da verificare','Stato','Osservazione / assunzione','Fonte utilizzata'],['Errore','C1','Da controllare','Aperto','nota','fonte']]}},/Esiti AI.*non ancora reimportabile.*revisione/],
  ['foglio non supportato',{sheets:{'Foglio inatteso':[['Dato'],[500]]}},/Foglio inatteso.*non importabile/],
]){
  test(name,()=>withAnalysis(h=>rejected(h,options,pattern)));
}
test('duplicati C1 Servizi 300 / Personale 700: entrambi gli ordini bloccati temporaneamente',()=>withAnalysis(async h=>{
  for(const rows of [
    [['C1','Servizi',300,200,'B7'],['C1','Personale',700,600,'B9A']],
    [['C1','Personale',700,600,'B9A'],['C1','Servizi',300,200,'B7']]
  ]){
    const message=await rejected(h,{ce:[['R1','Ricavi',-1000,-800,'A1'],...rows]},/attuale mapping non può distinguere/);
    for(const text of ['C1','Conto Economico!A3','Conto Economico!A4','Servizi','Personale',"dipendente dall'ordine delle righe"])assert.ok(message.includes(text),text);
  }
}));
test('anche duplicati identici sono bloccati, nessuna deduplicazione o somma',()=>withAnalysis(h=>rejected(h,{ce:[['C1','Servizi',300,200,'B7'],['C1','Servizi',300,200,'B7']]},/mapping non può distinguere/)));
test('stesso codice in SP e CE resta ammesso: chiavi di sezione diverse',()=>withAnalysis(async h=>{
  assert.match(await upload(h.page,await workbook(h.page,{ce:[['0001','Ricavi',-1000,-800,'A1']]})),/Import completato/);
  assert.equal(await h.page.evaluate(()=>STATE.accounts.filter(a=>a.code==='0001').length),2);
}));
test('zeri iniziali del codice e P.IVA preservati solo quando presenti nel formato',()=>withAnalysis(async h=>{
  assert.match(await upload(h.page,await workbook(h.page,{cells:{'Stato Patrimoniale':{A2:{t:'n',v:1,z:'0000'},A3:{t:'n',v:2}},Anagrafica:{B2:{t:'n',v:1234567890,z:'00000000000'}}}})),/Import completato/);
  assert.deepEqual(await h.page.evaluate(()=>[STATE.accounts[0].code,STATE.accounts[1].code,STATE.company.vat]),['0001','2','01234567890']);
}));
for(const [name,cell,date1904]of[
  ['seriale Excel',{t:'n',v:46022,z:'dd/mm/yyyy'},false],
  ['data nativa',{t:'d',v:new Date('2025-12-31T00:00:00Z'),z:'dd/mm/yyyy'},false],
  ['testo italiano',{t:'s',v:'31/12/2025'},false],
  ['sistema 1904',{t:'n',v:44560,z:'dd/mm/yyyy'},true]
]){
  test(name+' convertita in ISO',()=>withAnalysis(async h=>{
    assert.match(await upload(h.page,await workbook(h.page,{cells:{Anagrafica:{B5:cell}},date1904})),/Import completato/);
    assert.deepEqual(await h.page.evaluate(()=>[STATE.company.periodTo,STATE.company.yearCurrent,document.getElementById('an_to').value]),['2025-12-31',2025,'2025-12-31']);
  }));
}
test('500+ conti, comparativo, header riordinati e riga titolo',()=>withAnalysis(async h=>{
  const ce=[['R1','Ricavi fittizi',-1000,-800,'A1'],...Array.from({length:510},(_,i)=>['C'+i,'Servizi '+i,i+1,i+2,'B7'])];
  const message=await upload(h.page,await workbook(h.page,{ce,title:true,headers:['Voce IV Direttiva','Importo esercizio precedente','Codice conto','Importo esercizio corrente','Descrizione conto']}));
  assert.match(message,/Import completato/);
  assert.deepEqual(await h.page.evaluate(()=>[STATE.accounts.length,STATE.periods.previous.available,STATE.accounts.at(-1).previous]),[513,true,511]);
}));
test('valuta invalida non può causare un errore di rendering dopo il commit dello stato',()=>withAnalysis(h=>rejected(h,{company:[['Denominazione','Nuova'],['Schema di bilancio','Abbreviato'],['Valuta','EURO_INVALIDA']]},/Valuta|valuta/)));
test('Esiti AI senza header non viene scambiato per un foglio vuoto',()=>withAnalysis(h=>rejected(h,{sheets:{'Esiti AI':[['RILIEVO SENZA HEADER']]}},/Esiti AI/)));
test('dati prima dell’header non vengono scambiati per una riga titolo',()=>withAnalysis(h=>rejected(h,{sheets:{'Conto Economico':[['C_PERSO','Importo prima dell’header',400],['Codice conto','Descrizione conto','Importo esercizio corrente','Importo esercizio precedente','Voce IV Direttiva'],['C1','Servizi',300,200,'B7']]}},/prima dell.intestazione/)));
const benchmarkHead=['Codice KPI','Unità','Q1','Mediana','Q3','Fonte','Anno'];
test('benchmark dedicato privo di header: mai undefined',()=>withAnalysis(h=>rejected(h,{sheets:{Benchmark:[['errato'],['prof_ros',.1]]},only:['Benchmark']},/Intestazioni/,'benchmark')));
test('benchmark numeri testuali rigorosi e campo fonte locale',()=>withAnalysis(async h=>{
  await seed(h.page);
  assert.match(await upload(h.page,await workbook(h.page,{only:['Benchmark'],sheets:{Benchmark:[benchmarkHead,['prof_ros','%','0,10','0.20','0,30','FONTE SOLO LOCALE',2025]]}}),'benchmark'),/Import completato/);
  assert.deepEqual(await h.page.evaluate(()=>[STATE.benchmark[0].q1,STATE.benchmark[0].median,STATE.benchmark[0].q3]),[.1,.2,.3]);
  assert.equal(JSON.stringify(await h.page.evaluate(()=>FA_APP.buildPayload())).includes('FONTE SOLO LOCALE'),false);
}));
test('benchmark errore Excel e riga senza codice preservano lo stato',()=>withAnalysis(async h=>{
  for(const row of [['prof_ros','%',{t:'e',v:7},.2,.3,'Fonte',2025],['','%',.1,.2,.3,'Fonte',2025]])
    await rejected(h,{only:['Benchmark'],sheets:{Benchmark:[benchmarkHead,row]}},/Codice KPI|#DIV\/0!/,'benchmark');
}));
test('storico invalido resta atomico',()=>withAnalysis(h=>rejected(h,{cells:{'Conto Economico':{C3:{t:'s',v:'abc123'}}}},/numero non valido/,'history')));
test('storico valido con data Excel e comparativo',()=>withAnalysis(async h=>{
  await seed(h.page);
  assert.match(await upload(h.page,await workbook(h.page,{cells:{Anagrafica:{B5:{t:'n',v:46022,z:'dd/mm/yyyy'}}}}),'history'),/Import completato/);
  assert.deepEqual(await h.page.evaluate(()=>[STATE.history.at(-1).year,STATE.history.at(-1).periods.previous.available,STATE.accounts[0].code]),[2025,true,'100000']);
}));
const scenarioHead=['Sezione','Codice conto','Descrizione conto','Importo scenario alla data','Voce IV Direttiva','Note'];
for(const kind of ['budget','forecast']){
  const sheet=kind==='budget'?'Budget':'Forecast';
  test(kind+' valido, custom e negativi; stesso codice actual non è duplicato nello scenario',()=>withAnalysis(async h=>{
    await seed(h.page);
    assert.match(await upload(h.page,await workbook(h.page,{only:[sheet],sheets:{[sheet]:[scenarioHead,['CE','700000','Ricavi scenario',-1200000,'A1','Nota locale ignorata con avviso']]}}),kind),/Import completato/);
    assert.equal(await h.page.evaluate(k=>STATE.scenarios[k][0].current,kind),-1200000);
    assert.ok((await h.page.locator('#diagnostics-list').textContent()).includes('Note'));
  }));
  for(const [label,rows]of[
    ['numero invalido',[['CE','R1','Ricavi',-1000,'A1',''],['CE','C1','Servizi','abc123','B7','']]],
    ['duplicato',[['CE','C1','Servizi',300,'B7',''],['CE','C1','Personale',700,'B9A','']]],
    ['SP non supportato',[['SP','SP1','Banca',1000,'CIV','']]]
  ])test(kind+' '+label+': nessun import parziale',()=>withAnalysis(h=>rejected(h,{only:[sheet],sheets:{[sheet]:[scenarioHead,...rows]}},/numero non valido|mapping non può distinguere|soltanto CE/,kind)));
}
const centersHead=['Codice conto','Descrizione conto','Centro di costo','Importo esercizio corrente','Importo esercizio precedente','Note'];
test('centri: riga senza identificativo o conto ignoto non ignorati',()=>withAnalysis(async h=>{
  for(const row of [['','Servizi','A',100,80,''],['623000','Servizi','',100,80,''],['IGNOTO','Servizi','A',100,80,'']])
    await rejected(h,{only:['Allocazioni centri'],sheets:{'Allocazioni centri':[centersHead,row]}},/senza identificativo|non presente/,'centers');
}));
test('centri: prima riga valida e seconda importo invalido',()=>withAnalysis(h=>rejected(h,{only:['Allocazioni centri'],sheets:{'Allocazioni centri':[centersHead,['623000','Servizi','A',100,80,''],['623000','Servizi','B','NON DISPONIBILE',80,'']]}},/numero non valido/,'centers')));
test('Esiti AI vuoto ammesso; nessuna acquisizione silenziosa dei rilievi',()=>withAnalysis(async h=>{
  assert.match(await upload(h.page,await workbook(h.page,{sheets:{'Esiti AI':[['Tipo','Codice conto / campo','Elemento da verificare','Stato','Osservazione / assunzione','Fonte utilizzata'],['','','','','','']]}})),/Import completato/);
}));

async function download(page,fn){
  const pending=page.waitForEvent('download');await page.evaluate(fn=>window[fn](),fn);
  const file=await pending,chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);
  return Buffer.concat(chunks).toString('base64');
}
test('template del pulsante: download, compilazione, import, mapping, calcolo',()=>withAnalysis(async h=>{
  const template=await download(h.page,'downloadMainTemplate');
  const b64=await h.page.evaluate(b64=>{
    const wb=XLSX.read(b64,{type:'base64'});
    for(const n of ['Anagrafica','Stato Patrimoniale','Conto Economico'])if(!wb.Sheets[n])throw new Error(n+' mancante');
    wb.Sheets.Anagrafica.B2={t:'s',v:'Società fittizia template'};wb.Sheets.Anagrafica.B6={t:'s',v:'Abbreviato'};wb.Sheets.Anagrafica.B8={t:'n',v:46022,z:'dd/mm/yyyy'};
    XLSX.utils.sheet_add_aoa(wb.Sheets['Stato Patrimoniale'],[['0001','Banca',1000,800,'CIV'],['0002','Capitale',-1000,-800,'AI']],{origin:'A2'});
    XLSX.utils.sheet_add_aoa(wb.Sheets['Conto Economico'],[['R1','Ricavi',-1000,-800,'A1'],['C1','Servizi',300,200,'B7']],{origin:'A2'});
    return XLSX.write(wb,{type:'base64',bookType:'xlsx'});
  },template);
  assert.match(await upload(h.page,b64),/Import completato/);
  await h.page.evaluate(()=>{setMappingScheme('ce_va');setView('mapping');});
  assert.equal(await h.page.locator('#mapping-content .mapping-account').count(),2);
  await h.page.waitForFunction(()=>['ready','error'].includes(FA_APP.diagnostics().status));
  assert.equal(await h.page.evaluate(()=>FA_APP.buildPayload().periods.current.ce.rev),1000);
  if(hasBackend){assert.equal(await h.page.evaluate(()=>FA_APP.diagnostics().status),'ready');assert.equal(await h.page.evaluate(()=>FA_APP.result().kpis.length),42);}
}));
test('template AI ufficiale: CE Budget/Forecast, catalogo e allocazioni senza nuove logiche',()=>withAnalysis(async h=>{
  const b64=readFileSync(new URL('../resources/templates/Template_Analisi_di_Bilancio_AI.xlsx',import.meta.url)).toString('base64');
  const compiled=await h.page.evaluate(b64=>{
    const wb=XLSX.read(b64,{type:'base64'});
    const rows=XLSX.utils.sheet_to_json(wb.Sheets.Anagrafica,{header:1,defval:''});
    for(let r=0;r<rows.length;r++){const label=String(rows[r][0]).toLowerCase();if(label==='denominazione')wb.Sheets.Anagrafica['B'+(r+1)]={t:'s',v:'UFFICIALE FITTIZIA'};if(label==='schema di bilancio')wb.Sheets.Anagrafica['B'+(r+1)]={t:'s',v:'Abbreviato'};if(label==='periodo — al')wb.Sheets.Anagrafica['B'+(r+1)]={t:'n',v:46022,z:'dd/mm/yyyy'};}
    const add=(sheet,rows)=>XLSX.utils.sheet_add_aoa(wb.Sheets[sheet],rows,{origin:'A2'});
    add('Stato Patrimoniale',[['0001','Banca',1000,800,'CIV'],['0002','Capitale',-1000,-800,'AI']]);
    add('Conto Economico',[['R1','Ricavi',-1000,-800,'A1'],['C1','Servizi',300,200,'B7']]);
    add('Budget',[['CE','R1','Ricavi',-1200,'A1','']]);add('Forecast',[['CE','R1','Ricavi',-1100,'A1','']]);
    add('Catalogo centri',[['A','Centro fittizio','','','']]);
    add('Allocazioni centri',[['C1','Servizi','A',300,200,'']]);
    return XLSX.write(wb,{type:'base64',bookType:'xlsx'});
  },b64);
  assert.match(await upload(h.page,compiled),/Import completato/);
  assert.deepEqual(await h.page.evaluate(()=>[STATE.scenarios.budget[0].current,STATE.scenarios.forecast[0].current,STATE.centerCatalog[0].code,STATE.centers[0].center]),[-1200,-1100,'A','A']);
  await h.page.waitForFunction(()=>['ready','error'].includes(FA_APP.diagnostics().status));
  if(hasBackend)assert.equal(await h.page.evaluate(()=>FA_APP.diagnostics().status),'ready');
}));
test('template scenario, centri e benchmark distribuiti reimportabili',()=>withAnalysis(async h=>{
  await seed(h.page);
  for(const [fn,kind,rows]of[
    ['downloadScenarioTemplate','budget',[['R1','Ricavi',-1200,0,'A1']]],
    ['downloadCentersTemplate','centers',[['623000','A',248000,226000]]],
    ['downloadBenchmarkTemplate','benchmark',[['prof_ros','%',.1,.2,.3,'Fonte fittizia',2025]]]
  ]){
    const b64=await download(h.page,fn);
    const compiled=await h.page.evaluate(({b64,rows})=>{const wb=XLSX.read(b64,{type:'base64'});XLSX.utils.sheet_add_aoa(wb.Sheets[wb.SheetNames[0]],rows,{origin:'A2'});return XLSX.write(wb,{type:'base64',bookType:'xlsx'});},{b64,rows});
    assert.match(await upload(h.page,compiled,kind),/Import completato/);
  }
}));
test('privacy: nessun codice, identità, nota, descrizione o Esito AI nel payload',()=>withAnalysis(async h=>{
  const sentinel='SENTINEL_IMPORT_ANALISI_PRIVATO_X7';
  const b64=await workbook(h.page,{company:[['Denominazione',sentinel],['Schema di bilancio','Abbreviato']],ce:[[sentinel,sentinel,-1000,-800,'A1']],sheets:{Budget:[scenarioHead,['CE',sentinel,sentinel,-1200,'A1',sentinel]],'Esiti AI':[['Tipo','Codice conto / campo','Elemento da verificare','Stato','Osservazione / assunzione','Fonte utilizzata']]}});
  assert.match(await upload(h.page,b64),/Import completato/);
  await h.page.waitForFunction(()=>['ready','error'].includes(FA_APP.diagnostics().status));
  assert.ok(!(await h.page.evaluate(()=>JSON.stringify(FA_APP.buildPayload()))).includes(sentinel));
  assert.ok(!JSON.stringify(h.requests).includes(sentinel));
  assert.ok(!(await h.page.locator('#diagnostics-list').textContent()).includes(sentinel));
}));
