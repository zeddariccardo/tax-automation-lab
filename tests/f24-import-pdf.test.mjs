/* Regressioni import/PDF F24: dati esclusivamente fittizi, browser isolato,
 * nessuna lettura di archivi reali o chiamata al Worker. */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startWorkerBrowser } from './worker-browser-harness.mjs';

let runner;
before(async () => { runner = await startWorkerBrowser(); });
after(async () => { await runner?.close(); });

// Ogni prova usa un vero XLSX in memoria e attraversa lettura + import reale.
// Snapshot integrale di stato e storage: anche i clienti creati a metà file
// e le preferenze non collegate all'import devono restare identici in errore.
async function attemptImport(page, options = {}) {
  return page.evaluate(async options => {
    const client = {id:'old',name:'CLIENTE PREESISTENTE',cf:'01234567897',vat:'01234567897',
      address:'VIA TEST 1',city:'MILANO',province:'MI',rules:{codeFlow:[],defaultRef:'',defaultOffice:''}};
    state.clients=[client]; state.mode=options.mode || 'mass'; state.selectedClientId='old';
    state.rows=[upgradeRow({clientId:'old',taxCode:'1001',year:'2026',paymentDate:'2026-09-16',debit:50})];
    state.pending={previous:true};
    localStorage.setItem(KEY_CLIENTS,JSON.stringify(state.clients));
    localStorage.setItem('tal-audit-sentinel','DA_NON_CANCELLARE');
    localStorage.setItem('tal-f24-test-archive',JSON.stringify([{saved:'archivio precedente'}]));
    const base = {'Denominazione':'BETA INDUSTRIA S.P.A.','Codice fiscale':'20202020200','Partita IVA':'20202020200',
      'Flusso':'3','Data pagamento':'16/09/2026','Sezione':'INAIL','Codice tributo / causale':'P','Anno':'2026',
      'Importo debito':6840.25,'Codice ente / sede / regione / comune':'12500',
      'Matricola / posizione / riferimento':'902026','Codice ditta INAIL':'76543210','C.C. INAIL':'44'};
    Object.assign(base,options.base || {});
    if(options.clientRules) client.rules=options.clientRules;
    const records = options.records || [base, {...base,Flusso:'4'}];
    const headers=[...TEMPLATE_HEADERS,...(options.aliases || []).map(x=>x.header)];
    const sheet=XLSX.utils.aoa_to_sheet([headers,...records.map((r,i)=>[
      ...TEMPLATE_HEADERS.map(h=>r[h]??''),...(options.aliases||[]).map(x=>x.values[i]??'')])]);
    Object.entries(options.cells || {}).forEach(([address,cell])=>{sheet[address]=cell;});
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,sheet,'PAGAMENTI');
    const snapshot=()=>({state:JSON.stringify(state),storage:JSON.stringify(Object.entries(localStorage).sort())});
    const before=snapshot();
    let error='', parsed=[];
    const originalSetItem=Storage.prototype.setItem;
    if(options.storageFull) Storage.prototype.setItem=function(key,value){
      if(key===KEY_CLIENTS) throw new DOMException('Storage pieno','QuotaExceededError');
      return originalSetItem.call(this,key,value);
    };
    try {
      parsed=await readSpreadsheet(new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'f24-fittizio.xlsx'));
      prepareImport(parsed,'f24-fittizio.xlsx');
    } catch(e) {error=e.message;}
    finally {Storage.prototype.setItem=originalSetItem;}
    return {error,unchanged:JSON.stringify(before)===JSON.stringify(snapshot()),rows:state.rows,parsed,
      clients:state.clients.length,notes:document.getElementById('reportRows').textContent};
  },options);
}

for (const [code,label] of [[0,'#NULL!'],[7,'#DIV/0!'],[15,'#VALUE!'],[23,'#REF!'],[29,'#NAME?'],[36,'#NUM!'],[42,'#N/A']]) {
  test('F24 import atomico: formula Excel ' + label + ' nella seconda riga',()=>withF24(async page=>{
    const result=await attemptImport(page,{cells:{K3:{t:'e',v:code,f:'1/0'}}});
    assert.match(result.error,/Foglio «PAGAMENTI», riga 3, colonna K \(Importo debito\)/);
    assert.ok(result.error.includes(label));
    assert.equal(result.unchanged,true,'nessuna riga o anagrafica parziale, storage invariato');
  }));
}

for (const value of ['NON DISPONIBILE','abc123','#N/A','1.2.3,45','12€34','1(234)','1e3']) {
  test('F24 import atomico: rifiuta il testo importo ' + value,()=>withF24(async page=>{
    const result=await attemptImport(page,{cells:{K3:{t:'s',v:value}}});
    assert.match(result.error,/riga 3, colonna K \(Importo debito\).*importo non valido/);
    assert.ok(result.error.includes(value));
    assert.equal(result.unchanged,true);
  }));
}

for (const column of ['L','X']) {
  test('F24 import atomico: controlla anche importo credito/detrazione ' + column,()=>withF24(async page=>{
    const result=await attemptImport(page,{cells:{[column+'3']:{t:'e',v:7,f:'1/0'}}});
    assert.ok(result.error.includes('colonna '+column));
    assert.equal(result.unchanged,true);
  }));
}

test('F24: formati importo espliciti italiani e inglesi, senza usare la visualizzazione arrotondata',()=>withF24(async page=>{
  const result=await page.evaluate(()=>['1.234,56','1,234.56','1234.56','1234,56','1 234,56','€ 1.234,56','1.234,56 €']
    .map(parseImportAmount));
  assert.ok(result.every(p=>p.value===1234.56 && !p.invalid && !p.negative));
  const imported=await attemptImport(page,{cells:{K2:{t:'s',v:'1,234.56'},K3:{t:'n',v:1234.56,z:'0'}}});
  assert.equal(imported.error,'');
  assert.deepEqual(imported.rows.map(r=>r.debit),[1234.56,1234.56]);
}));

test('F24: matrice importi, notazioni ambigue bloccate senza interpretazione o stato parziale',()=>withF24(async page=>{
  for (const value of ['1.234,56','1234,56','1,234.56','1234.56']) {
    const result=await attemptImport(page,{cells:{K3:{t:'s',v:value}}});
    assert.equal(result.error,'',value);
    assert.equal(result.rows[1].debit,1234.56,value);
  }
  for (const value of ['1.234','1,234','€ 1.234','1,234 €']) {
    const result=await attemptImport(page,{cells:{K3:{t:'s',v:value}}});
    assert.match(result.error,/riga 3, colonna K.*importo ambiguo/,value);
    assert.equal(result.unchanged,true,value+': righe, clienti e storage invariati');
  }
}));

test('F24: zeri formattati Excel conservati per 0010, 04 e gli altri identificativi',()=>withF24(async page=>{
  const result=await attemptImport(page,{cells:{
    H2:{t:'n',v:10,z:'0000'},M2:{t:'n',v:123,z:'00000'},N2:{t:'n',v:12026,z:'000000'},
    Y2:{t:'n',v:123456,z:'00000000'},Z2:{t:'n',v:4,z:'00'},K2:{t:'n',v:1234.56,z:'0'}
  }});
  assert.equal(result.error,'');
  const r=result.rows[0];
  assert.deepEqual([r.taxCode,r.officeCode,r.reference,r.inailCompanyCode,r.inailCc,r.debit],
    ['0010','00123','012026','00123456','04',1234.56]);
}));

test('F24: alias vuoto non cancella il primo valore; duplicato identico usa la prima colonna documentata',()=>withF24(async page=>{
  const result=await attemptImport(page,{aliases:[{header:'CC INAIL',values:['','44']},{header:'C.C. INAIL',values:['44','44']}]});
  assert.equal(result.error,'');
  assert.deepEqual(result.rows.map(r=>r.inailCc),['44','44']);
  assert.deepEqual(result.rows.map(r=>r.sourceColumns.inailCc.column),['Z','Z']);
  assert.match(result.notes,/duplicato identico; usata la prima colonna non vuota Z/);
}));

test('F24: prima colonna vuota usa il successivo alias valorizzato',()=>withF24(async page=>{
  const result=await attemptImport(page,{cells:{Z2:{t:'s',v:''}},aliases:[{header:'CC INAIL',values:['04','44']}]});
  assert.equal(result.error,''); assert.equal(result.rows[0].inailCc,'04');
  assert.equal(result.rows[0].sourceColumns.inailCc.column,'AI');
}));

test('F24: alias discordanti e intestazioni letteralmente duplicate sono ambigui',()=>withF24(async page=>{
  for(const header of ['CC INAIL','C.C. INAIL']){
    const result=await attemptImport(page,{aliases:[{header,values:['44','04']}]});
    assert.match(result.error,/riga 3, colonna AI.*ambigue.*inailCc.*colonna Z/);
    assert.equal(result.unchanged,true);
  }
}));

test('F24: alias del debito vuoto o identico non azzera il pagamento, discordante annulla tutto',()=>withF24(async page=>{
  for (const value of ['',6840.25,200]) {
    const result=await attemptImport(page,{aliases:[{header:'Debito',values:['',value]}]});
    if (value===200) {
      assert.match(result.error,/riga 3, colonna AI.*ambigue.*debit.*colonna K/);
      assert.equal(result.unchanged,true);
    } else {
      assert.equal(result.error,'');
      assert.deepEqual(result.rows.map(r=>r.debit),[6840.25,6840.25]);
    }
  }
}));

test('F24: riferimento INAIL lungo bloccato in import e revisione senza troncamenti',()=>withF24(async page=>{
  const result=await attemptImport(page,{cells:{N3:{t:'s',v:'202612345678'}}});
  assert.match(result.error,/riga 3.*riferimento INAIL.*massimo 6/);
  assert.equal(result.unchanged,true);
  assert.equal(result.parsed[1].reference,'202612345678');
  const issues=await page.evaluate(()=>rowIssues(upgradeRow({section:'INAIL',reference:'202612345678'})));
  assert.ok(issues.some(x=>/massimo 6/.test(x)));
}));

test('F24: riferimento INAIL accetta sei cifre con zeri e blocca caratteri non numerici',()=>withF24(async page=>{
  const valid=await attemptImport(page,{cells:{N3:{t:'s',v:'000001'}}});
  assert.equal(valid.error,''); assert.equal(valid.rows[1].reference,'000001');
  const invalid=await attemptImport(page,{cells:{N3:{t:'s',v:'90202A'}}});
  assert.match(invalid.error,/riga 3.*riferimento INAIL.*solo cifre/);
  assert.equal(invalid.unchanged,true);
}));

test('F24: nessuna anagrafica parziale con identità invalida nell’ultima riga',()=>withF24(async page=>{
  const result=await attemptImport(page,{cells:{B3:{t:'s',v:'12345678901'}}});
  assert.match(result.error,/Codice fiscale non valido/);
  assert.equal(result.unchanged,true);
}));

test('F24: anche import singolo invalido preserva selezione, pending e storage',()=>withF24(async page=>{
  const result=await attemptImport(page,{mode:'single',cells:{N3:{t:'s',v:'202612345678'}}});
  assert.match(result.error,/massimo 6/); assert.equal(result.unchanged,true);
}));

test('F24: un saldo finale negativo non crea clienti',()=>withF24(async page=>{
  const result=await attemptImport(page,{cells:{D3:{t:'s',v:'3'},L3:{t:'n',v:100000},K3:{t:'n',v:0}}});
  assert.match(result.error,/crediti supera i debiti/);
  assert.equal(result.unchanged,true);
}));

test('F24: storage pieno annulla l’import prima di cambiare lo stato',()=>withF24(async page=>{
  const result=await attemptImport(page,{storageFull:true});
  assert.match(result.error,/Spazio locale non disponibile/); assert.equal(result.unchanged,true);
}));

test('F24: capienza INAIL verificata prima della conferma massiva, senza cambiare pending',()=>withF24(async page=>{
  const row={'Denominazione':'BETA INDUSTRIA S.P.A.','Codice fiscale':'20202020200','Flusso':'1',
    'Data pagamento':'16/09/2026','Sezione':'INAIL','Codice tributo / causale':'P','Importo debito':10,
    'Codice ente / sede / regione / comune':'12500','Matricola / posizione / riferimento':'902026',
    'Codice ditta INAIL':'76543210','C.C. INAIL':'44'};
  const records=[...Array.from({length:4},()=>({...row})),{...row,Denominazione:'ALTRA SOCIETA FITTIZIA','Codice fiscale':'01234567897'}];
  const result=await attemptImport(page,{mode:'single',records});
  assert.match(result.error,/superata la capienza di 3 righe/); assert.equal(result.unchanged,true);
}));

test('F24: formule senza cache numerica non diventano zero',()=>withF24(async page=>{
  const result=await attemptImport(page,{cells:{K3:{t:'n',f:'1+1'}}});
  assert.match(result.error,/riga 3, colonna K.*formula senza risultato/);
  assert.equal(result.unchanged,true);
}));

test('F24: flusso vuoto documentato, regole del cliente non cambiano il file',()=>withF24(async page=>{
  const result=await attemptImport(page,{mode:'single',
    base:{Denominazione:'CLIENTE PREESISTENTE','Codice fiscale':'01234567897','Partita IVA':'01234567897',Flusso:''},
    clientRules:{codeFlow:[{code:'P',flow:'NON_USARE'}],defaultOffice:'99999',defaultRef:'999999'}});
  assert.equal(result.error,''); assert.equal(result.rows[0].flow,'1');
  assert.equal(result.rows[0].officeCode,'12500'); assert.equal(result.rows[0].reference,'902026');
  assert.match(result.notes,/Flusso vuoto; usato 1/);
}));

test('F24: la conferma del cambio cliente passa dalla stessa transazione',()=>withF24(async page=>{
  const pending=await attemptImport(page,{mode:'single'});
  assert.equal(pending.error,''); assert.equal(pending.clients,1); assert.equal(pending.rows.length,1);
  await page.locator('#switchClientBtn').click();
  const after=await page.evaluate(()=>({clients:state.clients.length,rows:state.rows.length,
    selected:clientById(state.selectedClientId).cf,cc:state.rows[0].inailCc,pending:state.pending}));
  assert.deepEqual(after,{clients:2,rows:2,selected:'20202020200',cc:'44',pending:null});
}));

test('F24: l’input file mostra un errore persistente con cella e mantiene gli archivi',()=>withF24(async page=>{
  const result=await page.evaluate(async()=>{
    state.rows=[upgradeRow({taxCode:'1001',debit:50,clientId:'old'})];
    const before=JSON.stringify(state);
    const sheet=XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS,['BETA',...Array(9).fill(''),'NON DISPONIBILE']]);
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,sheet,'PAGAMENTI');
    await handleFile({target:{files:[new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'errore.xlsx')],value:'errore.xlsx'}},'massLoadedFile');
    return {same:JSON.stringify(state)===before,open:document.getElementById('modalImportReport').classList.contains('open'),
      text:document.getElementById('reportRows').textContent};
  });
  assert.equal(result.same,true); assert.equal(result.open,true);
  assert.match(result.text,/PAGAMENTI.*riga 2, colonna K.*NON DISPONIBILE/);
}));

test('F24: sezione vuota/ignota e casella non riconosciuta non ricevono default silenziosi',()=>withF24(async page=>{
  for(const cells of [{G3:{t:'s',v:''}},{G3:{t:'s',v:'NON NOTA'}},{S3:{t:'s',v:'forse'}}]){
    const result=await attemptImport(page,{cells});
    assert.match(result.error,/Sezione mancante o non riconosciuta|Casella.*non riconosciuto/);
    assert.equal(result.unchanged,true);
  }
}));

async function withF24(check) {
  const run = await runner.open('f24');
  try {
    await check(run.page);
    assert.deepEqual(run.errors, [], 'nessun errore JavaScript');
    assert.deepEqual(run.requests, [], 'F24 resta locale');
    assert.deepEqual(run.missing, [], 'nessuna risorsa mancante');
  } finally { await run.close(); }
}

test('F24: tutte le 34 intestazioni del template hanno una destinazione', () => withF24(async page => {
  const missing = await page.evaluate(() => TEMPLATE_HEADERS.filter(h => !HEADER_MAP[normHeader(h)]));
  assert.deepEqual(missing, [], 'nessuna colonna del template deve essere ignorata');
}));

test('F24: C.C. INAIL del template e alias conservano il controcodice', () => withF24(async page => {
  const actual = await page.evaluate(() => ['C.C. INAIL', 'CC INAIL', 'C C INAIL', '  c.c.   INAIL  '].map(header => canonicalRow({[header]:'04'}).inailCc));
  assert.deepEqual(actual, ['04','04','04','04']);
}));

test('F24: il template XLSX distribuito importa Beta INAIL senza perdere il C.C.', () => withF24(async page => {
  const bytes = await readFile(new URL('../resources/templates/Template_F24_Configura_AI_v1.0.xlsx', import.meta.url));
  const actual = await page.evaluate(async base64 => {
    const wb = XLSX.read(Uint8Array.from(atob(base64), c=>c.charCodeAt(0)), {type:'array'});
    const headers = XLSX.utils.sheet_to_json(wb.Sheets.PAGAMENTI, {header:1})[0];
    const raw = {'Denominazione':'BETA INDUSTRIA S.P.A.','Codice fiscale':'20202020200','Partita IVA':'20202020200','Flusso':'3','Data pagamento':'16/09/2026','Sezione':'INAIL','Codice tributo / causale':'P','Anno':'2026','Importo debito':6840.25,'Codice ente / sede / regione / comune':'12500','Matricola / posizione / riferimento':'902026','Codice ditta INAIL':'76543210','C.C. INAIL':'44'};
    wb.Sheets.PAGAMENTI = XLSX.utils.aoa_to_sheet([headers,headers.map(h=>raw[h]??'')]);
    const rows = await readSpreadsheet(new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'beta-fittizia.xlsx'));
    const row = {...rows[0],clientId:'test-beta'};
    return {count:rows.length,cc:row.inailCc,company:row.inailCompanyCode,amount:row.debit,date:row.paymentDate,issues:rowIssues(row)};
  }, bytes.toString('base64'));
  assert.deepEqual(actual,{count:1,cc:'44',company:'76543210',amount:6840.25,date:'2026-09-16',issues:[]});
}));

test('F24: gli identificativi testuali mantengono gli zeri iniziali', () => withF24(async page => {
  const actual = await page.evaluate(() => {
    const r=canonicalRow({'Codice fiscale':'01234567897','Partita IVA':'01234567897','Codice tributo / causale':'0010','Codice ente / sede / regione / comune':'00123','Codice ditta INAIL':'00123456','C.C. INAIL':'04','Matricola / posizione / riferimento':'012026','Periodo / rateazione':'0008'});
    return [r.cf,r.vat,r.taxCode,r.officeCode,r.inailCompanyCode,r.inailCc,r.reference,r.period];
  });
  assert.deepEqual(actual,['01234567897','01234567897','0010','00123','00123456','04','012026','0008']);
}));

test('F24: C.C. assente resta bloccante, importi e date errati non vengono sanati', () => withF24(async page => {
  const actual = await page.evaluate(() => {
    const row=canonicalRow({'Sezione':'INAIL','Codice tributo / causale':'P','Codice ente / sede / regione / comune':'12500','Codice ditta INAIL':'76543210','Matricola / posizione / riferimento':'902026','Importo debito':'non-un-importo','Data pagamento':'31/02/2026'});
    row.clientId='test-beta';
    return {cc:row.inailCc,issues:rowIssues(row)};
  });
  assert.equal(actual.cc,'');
  assert.ok(actual.issues.some(x=>x.includes('C.C.: obbligatorio')));
  assert.ok(actual.issues.some(x=>x.includes('non interpretabile')));
  assert.ok(actual.issues.some(x=>/Data di pagamento/.test(x)));
}));

test('F24: casi massivi, flussi e centesimi restano separati per cliente', () => withF24(async page => {
  const actual=await page.evaluate(()=>{
    state.clients=Array.from({length:50},(_,i)=>({id:'c'+i,name:'SOCIETA FITTIZIA '+i,cf:'20202020200'}));
    state.rows=state.clients.flatMap(c=>Array.from({length:3},(_,i)=>upgradeRow({clientId:c.id,paymentDate:'2026-09-16',flow:String(i+1),section:'INAIL',taxCode:'P',debit:1000.01,officeCode:'12500',inailCompanyCode:'76543210',inailCc:'44',reference:'902026'})));
    state.rev++;
    const groups=groupF24();
    return {groups:groups.length,total:groups.reduce((s,g)=>s+g.debitCents,0),issues:groups.flatMap(g=>g.issues),counts:groups.map(g=>g.filled.length)};
  });
  assert.equal(actual.groups,150); assert.equal(actual.total,15000150);
  assert.deepEqual(actual.issues,[]); assert.ok(actual.counts.every(n=>n===1));
}));

test('F24: il PDF usa Courier normale per CF e codici, senza cambiare importi e tre copie', () => withF24(async page => {
  const actual=await page.evaluate(()=>{
    const row=upgradeRow({section:'Erario',taxCode:'1001',period:'0008',year:'2026',debit:1234.56,coobligorCf:'RSSMRA80A01H501U',coobligorCode:'50'});
    const g={client:{name:'TEST PDF S.P.A.',cf:'20202020200'},date:'2026-09-16',flow:'1',rows:[row],filled:[row],balance:1234.56};
    const pdf=pdfDocForGroup(g);
    return pdf.internal.pages.slice(1).map(parts=>{
      const blocks=[...parts.join('\n').matchAll(/BT\n([\s\S]*?)\nET/g)].map(m=>({font:m[1].match(/\/(F\d+) /)?.[1],text:m[1].match(/\((.*?)\) Tj/)?.[1]}));
      return {cf:blocks.slice(0,11),coobligor:blocks.filter(x=>x.text!==undefined).slice(12,28),code:blocks.find(x=>x.text==='1001'),amount:blocks.find(x=>x.text==='1234'),allText:blocks.map(x=>x.text).join('|')};
    });
  });
  assert.equal(actual.length,3);
  for(const page of actual){
    assert.equal(page.cf.map(x=>x.text).join(''),'20202020200');
    assert.ok(page.cf.every(x=>x.font==='F5'),'CF in Courier normale');
    assert.equal(page.coobligor.map(x=>x.text).join(''),'RSSMRA80A01H501U');
    assert.ok(page.coobligor.every(x=>x.font==='F5'),'CF coobbligato in Courier normale');
    assert.equal(page.code.font,'F5'); assert.equal(page.amount.font,'F5');
    assert.match(page.allText,/1234\|5\|6/);
  }
}));

test('F24: PDF di tutte le sei sezioni identico al precedente, salvo peso Courier approvato',()=>withF24(async page=>{
  const result=await page.evaluate(()=>{
    const common={paymentDate:'2026-09-16',flow:'1',year:'2026',debit:1234.56,credit:0,period:'0008',
      officeCode:'01234',reference:'902026',periodFrom:'08/2026',periodTo:'08/2026',inailCompanyCode:'76543210',
      inailCc:'44',coobligorCf:'RSSMRA80A01H501U',coobligorCode:'50',numImmobili:'2',acconto:true,
      positionCode:'00123',entityCode:'0001'};
    const rows=['Erario','INPS','Regioni','IMU e altri tributi locali','INAIL','Altri enti previdenziali e assicurativi']
      .map((section,i)=>({...common,section,taxCode:['1001','DM10','3800','3918','P','CXX'][i]}));
    const group={client:{name:'SOCIETA FITTIZIA PDF S.P.A.',cf:'20202020200',city:'MILANO',province:'MI',address:'VIA DI PROVA 1'},
      date:common.paymentDate,flow:'1',flowDesc:'Test grafico',filled:rows,rows,balance:7407.36};
    const doc=pdfDocForGroup(group);
    return {pages:doc.internal.pages.slice(1).map(p=>p.join('\n')),width:doc.internal.pageSize.getWidth(),height:doc.internal.pageSize.getHeight()};
  });
  // Golden del PDF precedente alle due correzioni approvate: tutti gli
  // operatori di disegno/testo, coordinate, dimensioni e caselle, senza file QA.
  // Normalizziamo soltanto Courier normal/bold, non font-size o altri operatori.
  assert.deepEqual(result.pages.map(p=>createHash('sha256').update(p.replace(/\/F[56] /g,'/COURIER ')).digest('hex')),[
    '7dd63d8dea2cb913235affab146245d95a25e020737e56d362fa1c01d9acdedc',
    '027a42243ab8e65fe3e98afcb8963cea8ecb71557852ede3f93035c8b31da9b3',
    '52664a8533a5386af8e1771839519a01601362b1260317408f2cc795c8d68e58'
  ]);
  assert.ok(Math.abs(result.width-210)<0.01 && Math.abs(result.height-297)<0.01);
  assert.deepEqual(result.pages.map(p=>createHash('sha256').update(p).digest('hex')),[
    'a801f0e52e7dea509178d47fb4003cf64722b8009baec572d4941ea455ddf514',
    'ef5406f4cead8ded8d7258fa3adbbfdad8cdacafd7da07b6fb80a489eb862c4d',
    '358f7a8bf4d4a243321ba04d98e099c535e687273f7a6525d201527a7ecd8f0e'
  ],'nemmeno il peso degli altri testi PDF deve cambiare');
}));

test('F24: download template, compilazione Beta fittizia, import, revisione e PDF/Excel/ZIP',()=>withF24(async page=>{
  const downloadPromise=page.waitForEvent('download');
  await page.evaluate(()=>downloadPaymentTemplate(true));
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'Template_F24_Massivo.xlsx');
  const chunks=[];
  for await(const chunk of await download.createReadStream()) chunks.push(chunk);
  const result=await page.evaluate(async base64=>{
    const wb=XLSX.read(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),{type:'array'});
    const headers=XLSX.utils.sheet_to_json(wb.Sheets.PAGAMENTI,{header:1})[0];
    const cells=['BETA INDUSTRIA S.P.A.','20202020200','20202020200','3','Premio INAIL','16/09/2026',
      'INAIL','P','0008','2026',6840.25,'','12500','902026','08/2026','08/2026','001','00123456789',
      'No','No','Sì','No','2',1.23,'76543210','44','00123','RSSMRA80A01H501U','50',
      'Dati esclusivamente fittizi','001234','000001','0001','Sì'];
    wb.Sheets.PAGAMENTI=XLSX.utils.aoa_to_sheet([headers,cells]);
    state.mode='mass';
    const rows=await readSpreadsheet(new File([XLSX.write(wb,{type:'array',bookType:'xlsx'})],'beta.xlsx'));
    prepareImport(rows,'beta.xlsx');
    Object.assign(state.clients[0],{address:'VIA TEST 1',city:'MILANO',province:'MI',draft:false});
    touchState(); renderAll();
    document.querySelector('[data-action="confirm-mass-review"]').click();
    const groups=groupF24(), issues=groups.flatMap(g=>g.issues);
    const row=state.rows[0];
    const pdf=pdfDocForGroup(groups[0]);
    let exported;
    const writeFile=XLSX.writeFile;
    XLSX.writeFile=book=>{exported=book;};
    try{exportSummaryXlsx();}finally{XLSX.writeFile=writeFile;}
    const excelRows=XLSX.utils.sheet_to_json(exported.Sheets.RIGHE);
    let zipBlob;
    const original=downloadBlob;
    downloadBlob=blob=>{zipBlob=blob;};
    try{await exportAllPdfZip();}finally{downloadBlob=original;}
    if(!zipBlob) throw new Error('ZIP non prodotto');
    const zip=await JSZip.loadAsync(zipBlob);
    const pdfFiles=Object.keys(zip.files).filter(name=>name.endsWith('.pdf'));
    return {headers:headers.length,unmapped:headers.filter(h=>!HEADER_MAP[normHeader(h)]),
      issues,reviewStage:state.activeStage,cc:row.inailCc,debit:row.debit,date:row.paymentDate,sourceFields:Object.keys(row.sourceColumns),
      certification:row.certificationNo,operation:row.operationId,entity:row.entityCode,nonCalendar:row.nonCalendarYear,
      pdfPages:pdf.getNumberOfPages(),pdfBytes:pdf.output('arraybuffer').byteLength,
      excelAmount:excelRows[0]['Importo debito'],excelCc:excelRows[0]['C.C. INAIL'],
      pdfFiles:pdfFiles.length,zipPdfHeader:await zip.file(pdfFiles[0]).async('string').then(s=>s.slice(0,5)),
      csv:await zip.file('F24/Riepilogo.csv').async('string')};
  },Buffer.concat(chunks).toString('base64'));
  assert.equal(result.headers,34); assert.deepEqual(result.unmapped,[]); assert.deepEqual(result.issues,[]);
  assert.equal(result.reviewStage,'editor','la conferma della revisione apre gli F24');
  assert.equal(result.sourceFields.length,33,'solo la colonna credito intenzionalmente vuota');
  assert.deepEqual([result.cc,result.debit,result.date],['44',6840.25,'2026-09-16']);
  assert.deepEqual([result.certification,result.operation,result.entity,result.nonCalendar],['001234','000001','0001',true]);
  assert.equal(result.pdfPages,3); assert.ok(result.pdfBytes>1000);
  assert.equal(result.excelAmount,6840.25); assert.equal(result.excelCc,'44');
  assert.equal(result.pdfFiles,1); assert.equal(result.zipPdfHeader,'%PDF-');
  assert.match(result.csv,/6840,25/);
}));


// Regressioni della compilazione manuale: nessuna modifica al parser Excel.
async function seedF24Editor(page, section = 'Erario', extra = {}) {
  await page.evaluate(({section,extra}) => {
    state.demo=true;
    state.clients=[{id:'manual-client',name:'CONTRIBUENTE FITTIZIO',cf:'20202020200',
      address:'VIA DI PROVA 1',city:'MILANO',province:'MI',iban:'IT60X0542811101000000123456'}];
    state.selectedClientId='manual-client';state.mode='single';state.workView='table';
    state.rows=[upgradeRow({id:'manual-row',clientId:'manual-client',flow:'1',section,
      paymentDate:'2026-09-16',year:'2026',taxCode:'1001',debit:100,credit:0,...extra})];
    touchState();state.activeGroup=groupF24()[0]?.key || '';goStage('editor');renderAll();
  },{section,extra});
}

const manualSections = [
  {section:'Erario',taxCode:'1001',fields:{rdTaxOfficeCode:'ABC',rdActCode:'00000000001',rdCertificationNo:'CERT_TEST'},
    expected:{taxOfficeCode:'ABC',actCode:'00000000001',certificationNo:'CERT_TEST'}},
  {section:'INPS',taxCode:'DM10',fields:{rdOfficeCode:'1234',rdReference:'1234567890',rdPeriodFrom:'08/2026',rdPeriodTo:'08/2026'},
    expected:{officeCode:'1234',reference:'1234567890',periodFrom:'08/2026',periodTo:'08/2026'}},
  {section:'Regioni',taxCode:'3802',fields:{rdOfficeCode:'03'},expected:{officeCode:'03'},officeLabel:'Codice regione'},
  {section:'IMU e altri tributi locali',taxCode:'3918',fields:{rdOfficeCode:'H501',rdNumImmobili:'2',rdDetrazione:'10,00',rdOperationId:'000001'},
    expected:{officeCode:'H501',numImmobili:'2',detrazione:10,operationId:'000001'},officeLabel:'Codice ente / Comune'},
  {section:'INAIL',taxCode:'P',fields:{rdOfficeCode:'12500',rdReference:'902026',rdInailCompanyCode:'76543210',rdInailCc:'04'},
    expected:{officeCode:'12500',reference:'902026',inailCompanyCode:'76543210',inailCc:'04'}},
  {section:'Altri enti previdenziali e assicurativi',taxCode:'CXX',fields:{rdOfficeCode:'00123',rdEntityCode:'0001',rdPositionCode:'000123456',rdPeriodFrom:'08/2026',rdPeriodTo:'08/2026'},
    expected:{officeCode:'00123',entityCode:'0001',positionCode:'000123456',periodFrom:'08/2026',periodTo:'08/2026'}}
];
for(const scenario of manualSections) {
  test('F24 modal: campi coerenti e gate validi per '+scenario.section,()=>withF24(async page=>{
    await seedF24Editor(page,scenario.section,{taxCode:scenario.taxCode});
    await page.locator('[data-action="open-row"][data-id="manual-row"]').click();
    const expectedInputs=[...Object.keys(scenario.fields),'rdCoobligorCf','rdCoobligorCode','rdNote','rdNonCalendarYear'];
    if(scenario.section.startsWith('IMU'))expectedInputs.push('rdRavv','rdImmVar','rdAcc','rdSaldo');
    const inputs=await page.locator('#modalRowDetail input').evaluateAll(els=>els.filter(e=>e.type!=='hidden'&&e.getClientRects().length).map(e=>e.id));
    assert.deepEqual(inputs.sort(),expectedInputs.sort(),'solo i campi pertinenti sono visibili');
    const irrelevant=await page.locator('#modalRowDetail input').evaluateAll(els=>els.filter(e=>e.type!=='hidden'&&!e.getClientRects().length).map(e=>e.disabled));
    assert.ok(irrelevant.every(Boolean),'campi non pertinenti disabilitati');
    if(scenario.officeLabel)assert.equal(await page.locator('label[for="rdOfficeCode"]').textContent(),scenario.officeLabel);
    for(const[id,value]of Object.entries(scenario.fields))await page.locator('#'+id).fill(value);
    await page.locator('[data-action="save-row-detail"]').click();
    const result=await page.evaluate(()=>({row:state.rows[0],issues:rowIssues(state.rows[0]),errors:blockingErrors(),
      telematic:telematicGroupIssues(groupF24()[0],'personal',{})}));
    for(const[key,value]of Object.entries(scenario.expected))assert.equal(result.row[key],value,key);
    assert.deepEqual(result.issues,[]);assert.deepEqual(result.errors,[]);assert.deepEqual(result.telematic,[]);
  }));
}

test('F24 modal: nessun fallback tra ufficio, regione/Comune ed ente previdenziale; campi nascosti preservati',()=>withF24(async page=>{
  for(const[section,taxCode,office]of[['Regioni','3802','03'],['IMU e altri tributi locali','3918','H501']]){
    await seedF24Editor(page,section,{taxCode,taxOfficeCode:'03',entityCode:'H501',reference:'NON MODIFICARE'});
    assert.ok((await page.evaluate(()=>rowIssues(state.rows[0]))).some(x=>/Codice regione|Codice ente \/ Comune/.test(x)));
    await page.evaluate(()=>openRowDetail('manual-row'));
    await page.locator('#rdOfficeCode').fill(office);
    // Un controllo fuori sezione non può cambiare il modello neppure se il DOM ha un valore residuo.
    await page.evaluate(()=>{document.getElementById('rdTaxOfficeCode').value='DIVERSO';document.getElementById('rdEntityCode').value='DIVERSO';});
    await page.locator('[data-action="save-row-detail"]').click();
    assert.deepEqual(await page.evaluate(()=>[state.rows[0].officeCode,state.rows[0].taxOfficeCode,state.rows[0].entityCode,state.rows[0].reference,rowIssues(state.rows[0])]),
      [office,'03','H501','NON MODIFICARE',[]]);
  }
  await page.evaluate(()=>{setRow('manual-row','section','INAIL');openRowDetail('manual-row');});
  assert.equal(await page.locator('#rdReference').isEnabled(),true);
  assert.equal(await page.locator('#rdInailCc').isVisible(),true);
  assert.equal(await page.locator('#rdOperationId').isVisible(),false);
}));

for(const key of ['debit','credit']) {
  test('F24 '+key+': negativo visibile, gate bloccati, correzione reale elimina il rilievo',()=>withF24(async page=>{
    await seedF24Editor(page);
    const input=page.locator('[data-action="row-money"][data-field="'+key+'"]').first();
    await input.fill('-2.000,00');await input.press('Tab');
    assert.equal(await input.inputValue(),'-2000','il segno non viene corretto silenziosamente');
    const negative=await page.evaluate(key=>({value:state.rows[0][key],issues:rowIssues(state.rows[0]),
      telematic:telematicGroupIssues(groupF24()[0],'personal',{}),importIssues:state.rows[0].importIssues}),key);
    assert.equal(negative.value,-2000);assert.ok(negative.issues.some(x=>/negativo.*colonna corretta/.test(x)));
    assert.ok(negative.telematic.some(x=>/negativo/.test(x)));
    assert.deepEqual(negative.importIssues,[],'il segno corrente non è un errore di import storico');
    await page.evaluate(()=>downloadF24Pdf(groupF24()[0].key));
    assert.match(await page.locator('#toast').textContent(),/Correggi|errori/i,'PDF bloccato');
    if(key==='debit'){
      await input.fill('2.000,00');await input.press('Tab');
    }else{
      // Il credito deve passare nella colonna debito; non si indovina la direzione.
      await input.fill('');await input.press('Tab');
      const debit=page.locator('[data-action="row-money"][data-field="debit"]').first();
      await debit.fill('2.000,00');await debit.press('Tab');
    }
    const corrected=await page.evaluate(()=>({debit:state.rows[0].debit,credit:state.rows[0].credit,
      issues:rowIssues(state.rows[0]),errors:blockingErrors(),importIssues:state.rows[0].importIssues,
      telematic:telematicGroupIssues(groupF24()[0],'personal',{})}));
    assert.deepEqual(corrected,{debit:2000,credit:0,issues:[],errors:[],importIssues:[],telematic:[]});
    const downloaded=page.waitForEvent('download');await page.evaluate(()=>downloadF24Pdf(groupF24()[0].key));
    assert.match((await downloaded).suggestedFilename(),/\.pdf$/);
  }));
}

test('F24: correggere il debito rimuove solo le sue issue pregresse anche con valore mostrato identico',()=>withF24(async page=>{
  const other=['Importo a credito negativo nel file: indica un valore positivo nella colonna corretta',
    'Detrazione non interpretabile nel file: «abc»','Sezione mancante o non riconosciuta'];
  await seedF24Editor(page,'Erario',{debit:2000,importIssues:['Importo debito negativo',...other]});
  const input=page.locator('[data-action="row-money"][data-field="debit"]').first();
  await input.focus();await input.press('Tab');
  assert.equal((await page.evaluate(()=>state.rows[0].importIssues)).length,4,'il solo focus non corregge il dato');
  await input.fill('2000');await input.press('Tab');
  assert.deepEqual(await page.evaluate(()=>state.rows[0].importIssues),other);
}));

test('F24 modello compilabile: segno e correzione hanno gli stessi effetti della tabella',()=>withF24(async page=>{
  await seedF24Editor(page,'Regioni',{taxCode:'3802',officeCode:'03'});
  await page.evaluate(()=>switchWorkView('model'));
  const input=page.locator('#modelSheet [data-sezione="regioni"][data-riga="0"][data-field="debit"]');
  await input.fill('-2.000,00');await input.press('Tab');
  assert.equal(await input.inputValue(),'-2000');
  assert.ok((await page.evaluate(()=>blockingErrors())).some(x=>/negativo/.test(x.msg)));
  await input.fill('2000');await input.press('Tab');
  assert.deepEqual(await page.evaluate(()=>[state.rows[0].importIssues,blockingErrors()]),[[],[]]);
}));

test('F24: una riga con solo un importo negativo non scompare come bozza',()=>withF24(async page=>{
  await seedF24Editor(page,'Erario',{taxCode:''});
  const input=page.locator('[data-action="row-money"][data-field="debit"]').first();
  await input.fill('-2.000,00');await input.press('Tab');
  const result=await page.evaluate(()=>({filled:groupF24()[0].filled.length,issues:blockingErrors()}));
  assert.equal(result.filled,1);assert.ok(result.issues.some(x=>/negativo/.test(x.msg)));
}));

test('F24 detrazione: correzione nel modal elimina il rilievo del campo senza alterare gli altri importi',()=>withF24(async page=>{
  await seedF24Editor(page,'IMU e altri tributi locali',{taxCode:'3918',officeCode:'H501',detrazione:5,
    importIssues:['Detrazione non interpretabile nel file: «abc»']});
  await page.evaluate(()=>openRowDetail('manual-row'));
  await page.locator('#rdNote').fill('Nota fittizia');
  await page.locator('[data-action="save-row-detail"]').click();
  assert.deepEqual(await page.evaluate(()=>state.rows[0].importIssues),['Detrazione non interpretabile nel file: «abc»'],'una nota non corregge la detrazione');
  await page.evaluate(()=>openRowDetail('manual-row'));
  await page.locator('#rdDetrazione').fill('-10,00');
  await page.locator('[data-action="save-row-detail"]').click();
  assert.deepEqual(await page.evaluate(()=>[state.rows[0].detrazione,state.rows[0].importIssues]),[-10,[]]);
  assert.ok((await page.evaluate(()=>rowIssues(state.rows[0]))).some(x=>/detrazione negativo/.test(x)));
  await page.evaluate(()=>openRowDetail('manual-row'));
  await page.locator('#rdDetrazione').fill('10,00');await page.locator('[data-action="save-row-detail"]').click();
  assert.deepEqual(await page.evaluate(()=>[state.rows[0].debit,state.rows[0].credit,state.rows[0].detrazione,rowIssues(state.rows[0])]),[100,0,10,[]]);
}));
