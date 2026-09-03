/* Import Bilancio: XLSX fittizi in memoria, file chooser reale, browser isolato.
 * Nessuna chiamata al Worker pubblicato, nessuna scrittura di file Excel. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startWorkerBrowser } from './worker-browser-harness.mjs';

let runner;
before(async () => { runner = await startWorkerBrowser(); });
after(async () => { await runner?.close(); });

async function withBilancio(check) {
  const run = await runner.open('financial-statement');
  try { await check(run.page); assert.deepEqual(run.errors, [], 'nessun errore JavaScript o chiamata remota fallita'); } finally { await run.close(); }
}

async function importWorkbook(page, options = {}) {
  const base64 = await page.evaluate(options => {
    const headers = ['Codice conto', 'Descrizione conto', 'Importo esercizio corrente',
      'Importo esercizio precedente', 'Voce IV Direttiva'];
    const wb = XLSX.utils.book_new();
    const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
    add('Anagrafica', options.anagrafica || [
      ['Denominazione', 'NUOVA SOCIETÀ TEST'], ['Partita IVA', '22222222222'], ['Codice fiscale', '22222222222']]);
    for (const [name, source] of [['Stato Patrimoniale', 'sp'], ['Conto Economico', 'ce']]) {
      if (options.missing === name) continue;
      const selected = options.headers || headers;
      const records = options[source] || [
        ['0001', 'Conto uno', 100, 80, source === 'sp' ? 'CIV1' : 'A1'],
        ['0002', 'Conto due', -100, -80, source === 'sp' ? 'AI' : 'B6']];
      add(name, [...(options.title ? [['Bilancio di verifica — dati fittizi']] : []), selected,
        ...records.map(row => selected.map(header => row[headers.indexOf(header)] ?? ''))]);
    }
    if (options.ai) add('Esiti AI', options.ai);
    for (const [sheet, cells] of Object.entries(options.cells || {})) {
      Object.assign(wb.Sheets[sheet], cells);
    }
    document.getElementById('an_denom').value = 'SOCIETÀ SENTINELLA';
    document.getElementById('an_piva').value = '11111111111';
    document.getElementById('an_cf').value = '11111111111';
    document.getElementById('an_comune').value = 'Comune precedente';
    document.getElementById('an_periodo_a').value = '2025-12-31';
    document.getElementById('an_schema').value = ''; // Import indipendente dal calcolo remoto.
    Object.assign(STATE, {
      accounts: [{uid:'sentinel',code:'OLD',desc:'Preesistente',importo:77,importo_prev:66,source:'sp',voce:'CIV1'}],
      leafOverrides: {sentinel:'CIV1'},
      storni: [{id:'old-storno',fromLeaf:'CIV1',toLeaf:'AI',amount:3,amountPrev:2,active:false}],
      adjustments: [{id:'old-adjustment',leaf:'CIV1',amount:5,amountPrev:4,active:false}],
      technicalAix: {status:'confirmed',sentinel:99},
      aiFindings: [{tipo:'Verifica',elemento:'Preesistente',closed:false}],
      comparativeColumnPresent: true, comparativeHasValues: true
    });
    RESULT = {sentinel:'Risultato precedente da preservare'};
    localStorage.setItem('fs_archive_v1', JSON.stringify({clients:{old:{name:'Archivio sentinella'}},_migrated:true}));
    localStorage.setItem('fs_draft_v1', JSON.stringify({sentinel:'Bozza precedente'}));
    localStorage.setItem('riclass_open_v2', JSON.stringify({'22222222222':{
      map:{},carryPending:{from:'2025',storni:[],adjustments:[]}}}));
    sessionStorage.setItem('import-sentinel', 'Sessione precedente');
    document.getElementById('upload_meta').textContent = 'File precedente';
    const snapshot = () => JSON.stringify({state:STATE,result:RESULT,
      identity:[...document.querySelectorAll('input[id^="an_"],select[id^="an_"]')].map(e=>[e.id,e.value]),
      storage:Object.entries(localStorage).sort(),session:Object.entries(sessionStorage).sort(),
      meta:document.getElementById('upload_meta').textContent});
    const previous = snapshot(), previousState = STATE, previousAccounts = STATE.accounts;
    window.__importResult = () => ({unchanged:previous===snapshot(),sameReferences:STATE===previousState && STATE.accounts===previousAccounts,
      state:JSON.parse(JSON.stringify(STATE)),denom:document.getElementById('an_denom').value,
      piva:document.getElementById('an_piva').value,comune:document.getElementById('an_comune').value,
      meta:document.getElementById('upload_meta').textContent,
      diagnostics:document.getElementById('fs_import_diagnostics')?.textContent || '',
      toast:document.getElementById('toast').textContent});
    document.getElementById('toast').textContent = '';
    window.fsShowView('import');
    return XLSX.write(wb, {type:'base64',bookType:options.bookType || 'xlsx'});
  }, options);
  await page.locator('#upload_input').setInputFiles({name:options.bookType === 'biff8' ? 'bilancio-test.xls' : 'bilancio-test.xlsx',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(base64,'base64')});
  await page.waitForFunction(() => /Bilancio caricato e verificato|Errore lettura file:/.test(document.getElementById('toast').textContent));
  return page.evaluate(() => window.__importResult());
}

function rejected(result, message) {
  assert.match(result.toast, /Errore lettura file:/);
  assert.match(result.toast, message);
  assert.equal(result.unchanged, true, 'anagrafica, conti, mapping, A.IX, storni, rettifiche, AI, risultato e storage identici');
  assert.equal(result.sameReferences, true, 'il rifiuto non sostituisce lo stato con una ricostruzione');
  assert.ok(result.diagnostics.includes(result.toast.replace('Errore lettura file: ','')), 'origine disponibile anche dopo la scomparsa del toast');
}

test('Bilancio: rifiuto strutturale atomico anche cambiando società', () => withBilancio(async page => {
  rejected(await importWorkbook(page, {missing:'Conto Economico'}), /Fogli obbligatori mancanti/);
}));

for (const [name, cells] of [
  ['importo corrente', {A3:{t:'s',v:''}}],
  ['solo comparativo', {A3:{t:'s',v:''},C3:{t:'s',v:''}}],
  ['zero esplicito', {A3:{t:'s',v:''},C3:{t:'n',v:0},D3:{t:'s',v:''}}],
  ['falso header ripetuto', {A3:{t:'s',v:'Codice conto'}}]
]) test('Bilancio: non ignora una riga senza codice — '+name, () => withBilancio(async page => {
  rejected(await importWorkbook(page, {cells:{'Conto Economico':cells}}), /Foglio «Conto Economico», riga 3, colonna A.*codice conto/i);
}));

for (const [code, label] of [[0,'#NULL!'],[7,'#DIV/0!'],[15,'#VALUE!'],[23,'#REF!'],[29,'#NAME?'],[36,'#NUM!'],[42,'#N/A']]) {
  test('Bilancio: errore Excel '+label+' con origine e stato invariato', () => withBilancio(async page => {
    const result = await importWorkbook(page, {cells:{'Conto Economico':{C3:{t:'e',v:code,f:'1/0'}}}});
    rejected(result, /Foglio «Conto Economico», riga 3, colonna C/);
    assert.ok(result.toast.includes(label));
  }));
}

for (const [sheet, address] of [['Stato Patrimoniale','D3'],['Anagrafica','B2'],['Conto Economico','A3']]) {
  test('Bilancio: errore Excel anche in '+sheet+' '+address, () => withBilancio(async page => {
    rejected(await importWorkbook(page, {cells:{[sheet]:{[address]:{t:'e',v:42}}}}), /#N\/A/);
  }));
}

test('Bilancio: formula priva di risultato salvato non diventa zero', () => withBilancio(async page => {
  rejected(await importWorkbook(page, {cells:{'Conto Economico':{C3:{t:'n',f:'SUM(1,2)'}}}}), /riga 3, colonna C.*formula senza risultato/);
}));

for (const value of ['NON DISPONIBILE','abc123','#N/A','1.2.3,45','1e3','12€34','1.234','1,234']) {
  test('Bilancio: blocca importo testuale invalido o ambiguo '+value, () => withBilancio(async page => {
    rejected(await importWorkbook(page, {cells:{'Conto Economico':{C3:{t:'s',v:value}}}}), /riga 3, colonna C.*(?:importo|Excel)/);
  }));
}

test('Bilancio: importi espliciti italiani/inglesi, segni, zero e precisione delle celle numeriche', () => withBilancio(async page => {
  const values = ['1.234,56','1234,56','1,234.56','1234.56','(1.234,56)','-1234.56','+1234,56','1 234,56',0,1234.5678,''];
  const result = await importWorkbook(page, {sp:values.map((v,i)=>[String(i),'Importo',v,0,'CIV1'])});
  assert.match(result.toast,/Bilancio caricato/);
  assert.deepEqual(result.state.accounts.filter(a=>a.source==='sp').map(a=>a.importo),
    [1234.56,1234.56,1234.56,1234.56,-1234.56,-1234.56,1234.56,1234.56,0,1234.5678,0]);
}));

for (const bookType of ['xlsx','biff8']) test('Bilancio: codici testuali e formattati, senza inventare zeri — '+bookType, () => withBilancio(async page => {
  const result = await importWorkbook(page, {bookType,sp:[['0001','Testo',1,0,'CIV1'],[1,'Formattato',2,0,'CIV1'],[1,'Generale',3,0,'CIV1']],
    cells:{'Stato Patrimoniale':{A3:{t:'n',v:1,z:'0000'}}}});
  assert.match(result.toast,/Bilancio caricato/);
  assert.deepEqual(result.state.accounts.filter(a=>a.source==='sp').map(a=>a.code),['0001','0001','1']);
}));

test('Bilancio: duplicati conservati con UID e mapping separati, avviso persistente con righe', () => withBilancio(async page => {
  const result = await importWorkbook(page, {sp:[['DUP 01','Primo',10,1,'CIV1'],['dup-01','Secondo',20,2,'AI']]});
  assert.match(result.toast,/Bilancio caricato/);
  const rows = result.state.accounts.filter(a=>a.source==='sp');
  assert.deepEqual(rows.map(a=>[a.code,a.importo,a.voce]),[['DUP 01',10,'CIV1'],['dup-01',20,'AI']]);
  assert.equal(new Set(rows.map(a=>a.uid)).size,2);
  assert.match(result.diagnostics,/duplicat/i);
  assert.match(result.diagnostics,/Stato Patrimoniale.*A2.*A3/);
  assert.equal(await page.locator('#fs_import_diagnostics').isVisible(),true);
}));

const aiHeader = ['Tipo','Codice conto / campo','Elemento da verificare','Stato','Osservazione / assunzione','Fonte'];
test('Bilancio: 420 conti, header riordinati dopo titolo, comparativo ed Esiti AI', () => withBilancio(async page => {
  const rows = (prefix, voce) => Array.from({length:210},(_,i)=>[prefix+String(i).padStart(4,'0'),'Conto '+i,(i%2?-1:1)*(i+0.25),i+0.5,voce]);
  const result = await importWorkbook(page, {title:true,sp:rows('SP','CIV1'),ce:rows('CE','A1'),
    headers:['Voce IV Direttiva','Importo esercizio precedente','Descrizione conto','Codice conto','Importo esercizio corrente'],
    ai:[['Note del preparatore'],aiHeader,['Esempio','','Non lasciare questa riga','','',''],
      ['Verifica','SP0001','Saldo da verificare','Aperto','Fonte da confermare','Libro giornale'],
      ['Verifica','CE0001','Saldo verificato','Risolto','Controllato','Mastro']]});
  assert.match(result.toast,/Bilancio caricato/);
  assert.equal(result.state.accounts.length,420);
  assert.equal(new Set(result.state.accounts.map(a=>a.uid)).size,420);
  assert.deepEqual(result.state.accounts.map(a=>[a.code,a.desc,a.importo,a.importo_prev,a.voce]),
    [...rows('SP','CIV1'),...rows('CE','A1')]);
  assert.equal(result.state.comparativeColumnPresent,true);
  assert.equal(result.state.comparativeHasValues,true);
  assert.deepEqual(result.state.aiFindings.map(f=>[f.rif,f.closed]),[['SP0001',false],['CE0001',true]]);
  assert.equal(result.denom,'NUOVA SOCIETÀ TEST');
  assert.equal(result.piva,'22222222222');
  assert.equal(result.comune,'');
  assert.deepEqual(result.state.leafOverrides,{});
  assert.deepEqual(result.state.storni,[]);
  assert.deepEqual(result.state.adjustments,[]);
  assert.equal(result.state.technicalAix,null);
}));

test('Bilancio: assenza del comparativo e righe completamente vuote consentite', () => withBilancio(async page => {
  const result = await importWorkbook(page, {headers:['Codice conto','Descrizione conto','Importo esercizio corrente','Voce IV Direttiva'],
    sp:[['0001','Conto',100,0,'CIV1'],['','','','','']]});
  assert.match(result.toast,/Bilancio caricato/);
  assert.equal(result.state.comparativeColumnPresent,false);
  assert.equal(result.state.comparativeHasValues,false);
  assert.ok(result.state.accounts.every(a=>a.importo_prev===0));
}));

test('Bilancio: errore in Esiti AI rifiuta anche anagrafica e conti già validati', () => withBilancio(async page => {
  rejected(await importWorkbook(page, {ai:[aiHeader,['Verifica','0001','Verificare','Aperto','','']],
    cells:{'Esiti AI':{E2:{t:'e',v:15}}}}), /Foglio «Esiti AI», riga 2, colonna E.*#VALUE!/);
}));

test('Bilancio: header duplicato non selezionato arbitrariamente', () => withBilancio(async page => {
  rejected(await importWorkbook(page, {headers:['Codice conto','Descrizione conto','Importo esercizio corrente','Voce IV Direttiva','Importo esercizio corrente']}), /intestazione duplicata/i);
}));

test('Bilancio: formula con risultato salvato zero valida, valore numerico non arrotondato dal formato', () => withBilancio(async page => {
  const result=await importWorkbook(page,{cells:{'Stato Patrimoniale':{C2:{t:'n',f:'1-1',v:0},C3:{t:'n',v:1234.5678,z:'0'}}}});
  assert.match(result.toast,/Bilancio caricato/);
  assert.deepEqual(result.state.accounts.filter(a=>a.source==='sp').map(a=>a.importo),[0,1234.5678]);
}));

for (const cell of [{t:'b',v:true},{t:'n',v:45000,z:'dd/mm/yyyy'}]) {
  test('Bilancio: importo booleano o data non interpretato come numero '+cell.t, () => withBilancio(async page => {
    rejected(await importWorkbook(page,{cells:{'Conto Economico':{D3:cell}}}),/riga 3, colonna D.*importo non valido/);
  }));
}

test('Bilancio: errore dopo 420 conti, con header riordinati e titolo, conserva lo stato sentinella', () => withBilancio(async page => {
  const rows=Array.from({length:210},(_,i)=>['C'+i,'Conto',i,0,'CIV1']);
  const result=await importWorkbook(page,{title:true,sp:rows,ce:rows,
    headers:['Importo esercizio corrente','Voce IV Direttiva','Descrizione conto','Codice conto','Importo esercizio precedente'],
    cells:{'Conto Economico':{A212:{t:'s',v:'NON DISPONIBILE'}}}});
  rejected(result,/Foglio «Conto Economico», riga 212, colonna A.*NON DISPONIBILE/);
}));

test('Bilancio: rifiuto atomico anche se la società rimane la stessa', () => withBilancio(async page => {
  rejected(await importWorkbook(page,{anagrafica:[['Partita IVA','11111111111'],['Denominazione','Nome da non applicare']],
    cells:{'Conto Economico':{C3:{t:'s',v:'abc123'}}}}),/importo non valido/);
}));

for (const [label, rows, message] of [
  ['senza header',[['Foglio AI non strutturato']],/intestazione.*mancante/],
  ['senza elemento',[aiHeader,['Verifica','0001','','Aperto','Dato da non perdere','']],/riga 2, colonna C.*elemento da verificare vuoto/],
  ['header duplicato',[[...aiHeader,'Stato conferma']],/intestazione duplicata/]
]) test('Bilancio: Esiti AI '+label+' bloccati prima di applicare lo stato', () => withBilancio(async page => {
  rejected(await importWorkbook(page,{ai:rows}),message);
}));

test('Bilancio: anagrafica con valori duplicati discordanti non sovrascritta', () => withBilancio(async page => {
  rejected(await importWorkbook(page,{anagrafica:[['Partita IVA','22222222222'],['Partita IVA','33333333333']]}),/campo anagrafico duplicato con valori discordanti/);
}));

test('Bilancio: riferimenti AI formattati conservano gli zeri del conto', () => withBilancio(async page => {
  const result=await importWorkbook(page,{ai:[aiHeader,['Verifica',1,'Verificare','Aperto','','']],cells:{'Esiti AI':{B2:{t:'n',v:1,z:'0000'}}}});
  assert.match(result.toast,/Bilancio caricato/);
  assert.equal(result.state.aiFindings[0].rif,'0001');
}));
