/* Regressioni frontend: risposte fittizie acquisite dal Worker locale sulla
 * baseline 1ae3038. Nessun motore fiscale duplicato e nessuna chiamata esterna.
 * I golden privati verificano separatamente formule e controlli del servizio. */
import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {startWorkerBrowser} from './worker-browser-harness.mjs';

const FIXTURES = {"M0":{"payload":{"anno":2026,"trimestre":3,"periodicita":"M","regimeTrimestrale":"ordinary","gruppo":{"partecipante":false,"controllante":false,"meseFinale":null},"aggregati":[{"mese":7,"VP2":10000,"VP4":2200}],"manuali":{"M7":{"subforn":false,"eventi":false,"vp7":null,"vp8":null,"vp9":null,"vp10":null,"vp11":null,"vp12":0,"vp13":null}},"riportoStorico":null,"storicoMancante":"assente","clienteSelezionato":true,"contestoCoerente":true,"pivaFormalmenteValida":true,"conteggi":{"righe":1,"codiciSconosciuti":0,"righeFuoriPeriodo":0,"codiciariAnomali":0,"codiciariTotale":1,"righeAZero":0}},"response":{"periodi":[{"chiave":"M7","etichetta":"Luglio","mese":7,"trimestre":null,"mesi":[7],"codiceTrimestre":null,"partecipanteAlGruppo":false,"vp2":10000,"vp3":0,"vp4":2200,"vp5":0,"vp6":2200,"vp7":0,"vp8":0,"vp9":0,"vp10":0,"vp11":0,"vp12":0,"vp13":0,"vp14deb":2200,"vp14cre":0,"saldo":2200,"riporto":{"vp7":0,"vp8":0,"origine":"storico Q2","storicoMancante":true,"vp7Forzato":false,"vp8Forzato":false}},{"chiave":"M8","etichetta":"Agosto","mese":8,"trimestre":null,"mesi":[8],"codiceTrimestre":null,"partecipanteAlGruppo":false,"vp2":0,"vp3":0,"vp4":0,"vp5":0,"vp6":0,"vp7":0,"vp8":0,"vp9":0,"vp10":0,"vp11":0,"vp12":0,"vp13":0,"vp14deb":0,"vp14cre":0,"saldo":0,"riporto":{"vp7":0,"vp8":0,"origine":"Luglio","storicoMancante":false,"vp7Forzato":false,"vp8Forzato":false}},{"chiave":"M9","etichetta":"Settembre","mese":9,"trimestre":null,"mesi":[9],"codiceTrimestre":null,"partecipanteAlGruppo":false,"vp2":0,"vp3":0,"vp4":0,"vp5":0,"vp6":0,"vp7":0,"vp8":0,"vp9":0,"vp10":0,"vp11":0,"vp12":0,"vp13":0,"vp14deb":0,"vp14cre":0,"saldo":0,"riporto":{"vp7":0,"vp8":0,"origine":"Agosto","storicoMancante":false,"vp7Forzato":false,"vp8Forzato":false}}],"totali":{"vp2":10000,"vp3":0,"vp4":2200,"vp5":0,"saldo":2200},"tettoVp7":100,"controlli":[{"name":"Cliente selezionato","status":"ok","value":null,"valoreLocale":"denominazione","desc":"L’elaborazione deve essere associata a un cliente configurato."},{"name":"Importi caricati","status":"ok","value":"1","desc":"Righe lette dal file o dai dati incollati."},{"name":"Codici non riconosciuti","status":"ok","value":"0","desc":"Tutti i codici sono presenti nel codiciario."},{"name":"Righe fuori periodo","status":"ok","value":"Coerenti","desc":"Periodo atteso: Luglio, Agosto, Settembre."},{"name":"Codiciario cliente","status":"ok","value":"1 codici","desc":"Controllo duplicati e percentuali di confluenza."},{"name":"Riporto periodo precedente","status":"warn","value":"Storico precedente non disponibile","desc":"Manca il trimestre precedente finalizzato. Il trimestre può essere gestito autonomamente: verifica e inserisci manualmente gli eventuali riporti VP7 e VP8."},{"name":"Liquidazione IVA di gruppo","status":"ok","value":"Coerente","desc":"Nessuna regola speciale di gruppo applicabile."},{"name":"Acconto e interessi","status":"ok","value":"Coerenti","desc":"Collocazione temporale coerente."},{"name":"Righe a zero","status":"ok","value":"0","desc":"Nessuna riga completamente a zero."},{"name":"Coerenza fra file e periodo","status":"ok","value":"Coerente","desc":"Il file importato è vincolato a cliente, anno, trimestre e periodicità correnti."}],"bloccanti":[],"blocca":false}},"M20":{"payload":{"anno":2026,"trimestre":3,"periodicita":"M","regimeTrimestrale":"ordinary","gruppo":{"partecipante":false,"controllante":false,"meseFinale":null},"aggregati":[{"mese":7,"VP2":10000,"VP4":2200}],"manuali":{"M7":{"subforn":false,"eventi":false,"vp7":null,"vp8":null,"vp9":null,"vp10":null,"vp11":null,"vp12":20,"vp13":null}},"riportoStorico":null,"storicoMancante":"assente","clienteSelezionato":true,"contestoCoerente":true,"pivaFormalmenteValida":true,"conteggi":{"righe":1,"codiciSconosciuti":0,"righeFuoriPeriodo":0,"codiciariAnomali":0,"codiciariTotale":1,"righeAZero":0}},"response":{"periodi":[{"chiave":"M7","etichetta":"Luglio","mese":7,"trimestre":null,"mesi":[7],"codiceTrimestre":null,"partecipanteAlGruppo":false,"vp2":10000,"vp3":0,"vp4":2200,"vp5":0,"vp6":2200,"vp7":0,"vp8":0,"vp9":0,"vp10":0,"vp11":0,"vp12":20,"vp13":0,"vp14deb":2220,"vp14cre":0,"saldo":2220,"riporto":{"vp7":0,"vp8":0,"origine":"storico Q2","storicoMancante":true,"vp7Forzato":false,"vp8Forzato":false}},{"chiave":"M8","etichetta":"Agosto","mese":8,"trimestre":null,"mesi":[8],"codiceTrimestre":null,"partecipanteAlGruppo":false,"vp2":0,"vp3":0,"vp4":0,"vp5":0,"vp6":0,"vp7":0,"vp8":0,"vp9":0,"vp10":0,"vp11":0,"vp12":0,"vp13":0,"vp14deb":0,"vp14cre":0,"saldo":0,"riporto":{"vp7":0,"vp8":0,"origine":"Luglio","storicoMancante":false,"vp7Forzato":false,"vp8Forzato":false}},{"chiave":"M9","etichetta":"Settembre","mese":9,"trimestre":null,"mesi":[9],"codiceTrimestre":null,"partecipanteAlGruppo":false,"vp2":0,"vp3":0,"vp4":0,"vp5":0,"vp6":0,"vp7":0,"vp8":0,"vp9":0,"vp10":0,"vp11":0,"vp12":0,"vp13":0,"vp14deb":0,"vp14cre":0,"saldo":0,"riporto":{"vp7":0,"vp8":0,"origine":"Agosto","storicoMancante":false,"vp7Forzato":false,"vp8Forzato":false}}],"totali":{"vp2":10000,"vp3":0,"vp4":2200,"vp5":0,"saldo":2220},"tettoVp7":100,"controlli":[{"name":"Cliente selezionato","status":"ok","value":null,"valoreLocale":"denominazione","desc":"L’elaborazione deve essere associata a un cliente configurato."},{"name":"Importi caricati","status":"ok","value":"1","desc":"Righe lette dal file o dai dati incollati."},{"name":"Codici non riconosciuti","status":"ok","value":"0","desc":"Tutti i codici sono presenti nel codiciario."},{"name":"Righe fuori periodo","status":"ok","value":"Coerenti","desc":"Periodo atteso: Luglio, Agosto, Settembre."},{"name":"Codiciario cliente","status":"ok","value":"1 codici","desc":"Controllo duplicati e percentuali di confluenza."},{"name":"Riporto periodo precedente","status":"warn","value":"Storico precedente non disponibile","desc":"Manca il trimestre precedente finalizzato. Il trimestre può essere gestito autonomamente: verifica e inserisci manualmente gli eventuali riporti VP7 e VP8."},{"name":"Liquidazione IVA di gruppo","status":"ok","value":"Coerente","desc":"Nessuna regola speciale di gruppo applicabile."},{"name":"Acconto e interessi","status":"fail","value":"Interessi non ammessi","desc":"VP12 è riservato alle liquidazioni trimestrali e non va indicato nel quarto trimestre."},{"name":"Righe a zero","status":"ok","value":"0","desc":"Nessuna riga completamente a zero."},{"name":"Coerenza fra file e periodo","status":"ok","value":"Coerente","desc":"Il file importato è vincolato a cliente, anno, trimestre e periodicità correnti."}],"bloccanti":[],"blocca":true}},"T0":{"payload":{"anno":2026,"trimestre":3,"periodicita":"T","regimeTrimestrale":"ordinary","gruppo":{"partecipante":false,"controllante":false,"meseFinale":null},"aggregati":[{"mese":7,"VP2":10000,"VP4":2200}],"manuali":{"Q3":{"subforn":false,"eventi":false,"vp7":null,"vp8":null,"vp9":null,"vp10":null,"vp11":null,"vp12":0,"vp13":null}},"riportoStorico":null,"storicoMancante":"assente","clienteSelezionato":true,"contestoCoerente":true,"pivaFormalmenteValida":true,"conteggi":{"righe":1,"codiciSconosciuti":0,"righeFuoriPeriodo":0,"codiciariAnomali":0,"codiciariTotale":1,"righeAZero":0}},"response":{"periodi":[{"chiave":"Q3","etichetta":"3° trimestre","mese":null,"trimestre":3,"mesi":[7,8,9],"codiceTrimestre":3,"partecipanteAlGruppo":false,"vp2":10000,"vp3":0,"vp4":2200,"vp5":0,"vp6":2200,"vp7":0,"vp8":0,"vp9":0,"vp10":0,"vp11":0,"vp12":0,"vp13":0,"vp14deb":2200,"vp14cre":0,"saldo":2200,"riporto":{"vp7":0,"vp8":0,"origine":"storico Q2","storicoMancante":true,"vp7Forzato":false,"vp8Forzato":false}}],"totali":{"vp2":10000,"vp3":0,"vp4":2200,"vp5":0,"saldo":2200},"tettoVp7":100,"controlli":[{"name":"Cliente selezionato","status":"ok","value":null,"valoreLocale":"denominazione","desc":"L’elaborazione deve essere associata a un cliente configurato."},{"name":"Importi caricati","status":"ok","value":"1","desc":"Righe lette dal file o dai dati incollati."},{"name":"Codici non riconosciuti","status":"ok","value":"0","desc":"Tutti i codici sono presenti nel codiciario."},{"name":"Righe fuori periodo","status":"ok","value":"Coerenti","desc":"Periodo atteso: Luglio, Agosto, Settembre."},{"name":"Codiciario cliente","status":"ok","value":"1 codici","desc":"Controllo duplicati e percentuali di confluenza."},{"name":"Riporto periodo precedente","status":"warn","value":"Storico precedente non disponibile","desc":"Manca il trimestre precedente finalizzato. Il trimestre può essere gestito autonomamente: verifica e inserisci manualmente gli eventuali riporti VP7 e VP8."},{"name":"Liquidazione IVA di gruppo","status":"ok","value":"Coerente","desc":"Nessuna regola speciale di gruppo applicabile."},{"name":"Acconto e interessi","status":"ok","value":"Coerenti","desc":"Collocazione temporale coerente."},{"name":"Righe a zero","status":"ok","value":"0","desc":"Nessuna riga completamente a zero."},{"name":"Coerenza fra file e periodo","status":"ok","value":"Coerente","desc":"Il file importato è vincolato a cliente, anno, trimestre e periodicità correnti."},{"name":"Regime trimestrale","status":"ok","value":"Ordinario","desc":"Il quarto trimestre è codificato rispettivamente come 5 o 4 nel tracciato."}],"bloccanti":[],"blocca":false}},"T20":{"payload":{"anno":2026,"trimestre":3,"periodicita":"T","regimeTrimestrale":"ordinary","gruppo":{"partecipante":false,"controllante":false,"meseFinale":null},"aggregati":[{"mese":7,"VP2":10000,"VP4":2200}],"manuali":{"Q3":{"subforn":false,"eventi":false,"vp7":null,"vp8":null,"vp9":null,"vp10":null,"vp11":null,"vp12":20,"vp13":null}},"riportoStorico":null,"storicoMancante":"assente","clienteSelezionato":true,"contestoCoerente":true,"pivaFormalmenteValida":true,"conteggi":{"righe":1,"codiciSconosciuti":0,"righeFuoriPeriodo":0,"codiciariAnomali":0,"codiciariTotale":1,"righeAZero":0}},"response":{"periodi":[{"chiave":"Q3","etichetta":"3° trimestre","mese":null,"trimestre":3,"mesi":[7,8,9],"codiceTrimestre":3,"partecipanteAlGruppo":false,"vp2":10000,"vp3":0,"vp4":2200,"vp5":0,"vp6":2200,"vp7":0,"vp8":0,"vp9":0,"vp10":0,"vp11":0,"vp12":20,"vp13":0,"vp14deb":2220,"vp14cre":0,"saldo":2220,"riporto":{"vp7":0,"vp8":0,"origine":"storico Q2","storicoMancante":true,"vp7Forzato":false,"vp8Forzato":false}}],"totali":{"vp2":10000,"vp3":0,"vp4":2200,"vp5":0,"saldo":2220},"tettoVp7":100,"controlli":[{"name":"Cliente selezionato","status":"ok","value":null,"valoreLocale":"denominazione","desc":"L’elaborazione deve essere associata a un cliente configurato."},{"name":"Importi caricati","status":"ok","value":"1","desc":"Righe lette dal file o dai dati incollati."},{"name":"Codici non riconosciuti","status":"ok","value":"0","desc":"Tutti i codici sono presenti nel codiciario."},{"name":"Righe fuori periodo","status":"ok","value":"Coerenti","desc":"Periodo atteso: Luglio, Agosto, Settembre."},{"name":"Codiciario cliente","status":"ok","value":"1 codici","desc":"Controllo duplicati e percentuali di confluenza."},{"name":"Riporto periodo precedente","status":"warn","value":"Storico precedente non disponibile","desc":"Manca il trimestre precedente finalizzato. Il trimestre può essere gestito autonomamente: verifica e inserisci manualmente gli eventuali riporti VP7 e VP8."},{"name":"Liquidazione IVA di gruppo","status":"ok","value":"Coerente","desc":"Nessuna regola speciale di gruppo applicabile."},{"name":"Acconto e interessi","status":"ok","value":"Coerenti","desc":"Collocazione temporale coerente."},{"name":"Righe a zero","status":"ok","value":"0","desc":"Nessuna riga completamente a zero."},{"name":"Coerenza fra file e periodo","status":"ok","value":"Coerente","desc":"Il file importato è vincolato a cliente, anno, trimestre e periodicità correnti."},{"name":"Regime trimestrale","status":"ok","value":"Ordinario","desc":"Il quarto trimestre è codificato rispettivamente come 5 o 4 nel tracciato."}],"bloccanti":[],"blocca":false}}};
let runner;
before(async()=>{runner=await startWorkerBrowser();});
after(async()=>{await runner?.close();});

function api(request) {
  if(request.method()==='GET')return new Response('{"ok":true}',{headers:{'content-type':'application/json'}});
  const payload=JSON.parse(request.postData()),key=payload.periodicita==='M'?'M7':'Q3';
  const fixture=FIXTURES[payload.periodicita+payload.manuali[key].vp12];
  assert.ok(fixture,'il test deve usare soltanto le risposte acquisite');
  assert.deepEqual(payload,fixture.payload,'payload identico alla baseline per gli stessi input');
  return new Response(JSON.stringify(fixture.response),{headers:{'content-type':'application/json'}});
}
async function using(fn,options={}) {
  const h=await runner.open('lipe',{storage:{'lipe.benvenuto':'no'},api,...options});
  try {await fn(h);assert.deepEqual(h.errors,[]);assert.deepEqual(h.missing,[]);}
  finally {await h.close();}
}
async function seed(page,{periodType='M',vp12=20,moduleProfile='single'}={}) {
  await page.evaluate(({periodType,vp12,moduleProfile})=>{
    const client={...defaultClient(),denom:'PROVA LIPE FITTIZIA',piva:'20202020200',cf:'20202020200',
      repCf:'RSSMRA80A01H501U',repRole:'1',transmitterId:'20202020200',periodType,quarterRegime:'ordinary',moduleProfile};
    const mapping=[{...defaultMapping('V22'),id:'test-map',baseRow:'VP2',dueRow:'VP4'}],record={client,mapping};
    Object.assign(state,{configClient:clone(client),configMapping:clone(mapping),loadedConfigKey:client.piva,
      activeClientKey:client.piva,activeRecord:record,year:2026,quarter:3,
      rows:[{id:'r1',code:'V22',taxable:10000,vat:2200,month:7,sourceRow:2,source:'fittizio'}],
      manual:{[periodType==='M'?'M7':'Q3']:{vp12:String(vp12)}},
      importContext:{piva:client.piva,year:2026,quarter:3,periodType}});
    localStorage.setItem(KEYS.clients,JSON.stringify({[client.piva]:record}));
    syncConfigToFields();renderResults();renderExportState();lipeShowSection('results-section');
  },{periodType,vp12,moduleProfile});
  await page.waitForFunction(()=>document.querySelectorAll('#checks-grid .check-item').length>0);
}
async function snapshot(page) {
  return page.evaluate(()=>({
    vp12:computePeriod(periodDescriptors()[0]).vp12,
    vp14:computePeriod(periodDescriptors()[0]).vp14deb,
    manual:JSON.stringify(state.manual),
    issues:checks().filter(c=>c.status==='fail'),
    blocked:hasBlocking(),xml:buildXml().problems,
    buttons:['export-pdf','export-excel','export-xml'].map(id=>document.getElementById(id).disabled),
    status:document.getElementById('export-status').textContent,
    refusals:lipeApiDiagnostica().rifiuti
  }));
}
async function downloadOutputs(page) {
  await page.evaluate(()=>lipeShowSection('exports-section'));
  for(const [id,extension] of [['export-pdf','.pdf'],['export-excel','.xlsx'],['export-xml','.xml']]){
    const downloaded=page.waitForEvent('download');
    await page.locator('#'+id).click();
    const file=await downloaded;
    assert.ok(file.suggestedFilename().endsWith(extension),file.suggestedFilename());
    const stream=await file.createReadStream(),chunks=[];
    for await(const chunk of stream)chunks.push(chunk);
    assert.ok(Buffer.concat(chunks).length>100,'file generato non vuoto');
  }
}

test('LIPE VP12 mensile: valore conservato, controllo bloccante e tutti gli output disabilitati',()=>using(async h=>{
  await seed(h.page);
  const s=await snapshot(h.page);
  assert.equal(s.vp12,20);assert.equal(s.vp14,2220,'formula VP14 invariata');
  assert.ok(s.issues.some(c=>/VP12/.test(c.desc)));assert.equal(s.blocked,true);
  assert.deepEqual(s.buttons,[true,true,true]);
  assert.match(s.status,/VP12.*interessi.*trimestrali.*mensile/);
  assert.equal(s.refusals,0);
}));

test('LIPE VP12 mensile: anche le funzioni export rifiutano senza produrre file o cambiare stato',()=>using(async h=>{
  await seed(h.page);const before=await snapshot(h.page);
  const result=await h.page.evaluate(async()=>{
    const seen=[],originalDownload=downloadBlob,originalWrite=XLSX.writeFile,originalUrl=URL.createObjectURL;
    downloadBlob=()=>seen.push('download');XLSX.writeFile=()=>seen.push('Excel');URL.createObjectURL=()=>{seen.push('blob');return 'blob:test';};
    const before=JSON.stringify({state,local:Object.entries(localStorage).sort()}),messages=[];
    try {
      for(const name of ['exportPdf','exportWorkingPaper','exportXml']){
        window[name]();messages.push(document.getElementById('toast').textContent);
      }
      await new Promise(resolve=>setTimeout(resolve,0));
      return {seen,messages,unchanged:before===JSON.stringify({state,local:Object.entries(localStorage).sort()})};
    }finally{downloadBlob=originalDownload;XLSX.writeFile=originalWrite;URL.createObjectURL=originalUrl;}
  });
  assert.deepEqual(result.seen,[]);
  assert.ok(result.messages.every(m=>/VP12.*trimestrali.*mensile/.test(m)));
  assert.equal(result.unchanged,true);
  assert.equal((await snapshot(h.page)).manual,before.manual);
}));

test('LIPE VP12: rimozione reale dal modulo mensile elimina il rilievo e riabilita PDF/XML/Excel',()=>using(async h=>{
  await seed(h.page);assert.deepEqual((await snapshot(h.page)).buttons,[true,true,true]);
  const input=h.page.locator('[data-manual-key="M7"][data-manual-field="vp12"]');
  await input.fill('0');await input.press('Tab');
  await h.page.waitForFunction(()=>document.getElementById('export-pdf').disabled===false && document.querySelectorAll('#checks-grid .check-item').length>0);
  const s=await snapshot(h.page);
  assert.equal(s.vp12,0);assert.equal(s.vp14,2200);
  assert.deepEqual(s.issues,[]);assert.equal(s.blocked,false);assert.deepEqual(s.xml,[]);
  assert.deepEqual(s.buttons,[false,false,false]);assert.equal(s.refusals,0);
  await downloadOutputs(h.page);
}));

for(const moduleProfile of ['single','mixed','dual-q4'])for(const periodType of ['M','T']) {
  test('LIPE VP12 per modulo: '+periodType+' / '+moduleProfile,()=>using(async h=>{
    await seed(h.page,{periodType,moduleProfile});
    const s=await snapshot(h.page),monthly=periodType==='M';
    assert.equal(s.vp12,20);assert.equal(s.vp14,2220);
    assert.deepEqual(s.buttons,monthly?[true,true,true]:[false,false,false]);
    assert.equal(s.blocked,monthly);
    if(moduleProfile==='single'&&!monthly)assert.deepEqual(s.xml,[]);
    if(moduleProfile!=='single')assert.ok(s.xml.some(x=>/moduli misti o doppi/.test(x)),'limite XML preesistente conservato');
    assert.equal(s.refusals,0);
  }));
}

test('LIPE VP12 trimestrale: PDF/XML/Excel restano generabili con interessi invariati',()=>using(async h=>{
  await seed(h.page,{periodType:'T'});
  await downloadOutputs(h.page);
  assert.deepEqual((await snapshot(h.page)).issues,[]);
}));

for(const width of [1400,1440,768,390,375]) {
  test('LIPE popup: wrapping naturale e nessun overflow a '+width+' px',()=>using(async({page})=>{
    await page.setViewportSize({width,height:width<500?844:900});
    await page.locator('#lipe-benvenuto').waitFor({state:'visible'});
    const r=await page.evaluate(()=>{
      const dialog=document.getElementById('lipe-benvenuto'),span=dialog.querySelector('li span'),bold=span.querySelector('b');
      const walker=document.createTreeWalker(span,NodeFilter.SHOW_TEXT),rects=[];let node;
      while(node=walker.nextNode())for(let i=0;i<node.length;i++){
        const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);
        for(const r of range.getClientRects())if(r.width>0)rects.push({x:r.x,y:r.y,right:r.right,bottom:r.bottom});
      }
      const top=Math.min(...rects.map(r=>r.y)),first=rects.filter(r=>Math.abs(r.y-top)<4);
      const b=dialog.getBoundingClientRect();
      return {text:span.textContent,boldDisplay:getComputedStyle(bold).display,
        titleDisplay:getComputedStyle(dialog.querySelector('li>b')).display,
        firstLineWidth:Math.max(...first.map(r=>r.right))-Math.min(...first.map(r=>r.x)),available:span.clientWidth,
        bounds:[b.left,b.right,b.top,b.bottom],viewport:[innerWidth,innerHeight],
        overflow:document.documentElement.scrollWidth>innerWidth||dialog.scrollWidth>dialog.clientWidth,
        cta:document.getElementById('lipe-benvenuto-chiudi').textContent};
    });
    assert.equal(r.text,'Anagrafica e codici IVA: si fa una volta sola. Il tool impara che cosa significa ogni codice del tuo gestionale, e se lo ricorda.');
    assert.equal(r.boldDisplay,'inline');assert.equal(r.titleDisplay,'block');
    assert.ok(r.firstLineWidth>r.available*.8,'la prima riga deve sfruttare la larghezza utile: '+JSON.stringify(r));
    assert.equal(r.overflow,false);assert.ok(r.bounds[0]>=0&&r.bounds[1]<=r.viewport[0]+1&&r.bounds[2]>=0&&r.bounds[3]<=r.viewport[1]+1);
    assert.equal(r.cta,'Ho capito, cominciamo');
    await page.locator('#lipe-benvenuto-chiudi').click();assert.equal(await page.locator('#lipe-benvenuto').isVisible(),false);
  },{storage:{}}));
}
