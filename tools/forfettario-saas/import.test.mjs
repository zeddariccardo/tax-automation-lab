import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseBackup,migrationTarget,migrationPreview,bindingDigest,byteDigest,readImportFile,spreadsheetPreview,tabularTargets,digest,graphFromLedger} from './import-model.js';
import {E,canonicalJson,professionalIdentityFromState} from './import-legacy.generated.js';
const fixture=JSON.parse(await readFile(new URL('./import-fixtures.json',import.meta.url)));
const copy=structuredClone;
const records=()=>copy(fixture.portfolio);
const backup=()=>({format:'forfettario-pro-backup-v1',state:copy(fixture.portfolio[0].personalState)});
const transfer=()=>{const r=records()[0],s=r.personalState;const x={format:'PracticeTransferV1',schema:'forfettario-pro-practice-transfer-v1',schemaVersion:1,personalState:s,identity:professionalIdentityFromState(s),metadata:{name:r.professionalMetadata.name,clientCode:r.clientCode}};x.checksum={algorithm:'SHA-256',canonicalization:'RFC8785',value:digest(x)};return x;};
test('new SHA-256 fingerprints match platform/PostgreSQL, separately from frozen legacy IDs',async()=>{
 assert.equal(await byteDigest('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 assert.equal(await bindingDigest({bbb:2,a:1}),'1a7bfef6228b3c4bca9cdf0fdd7a71f6998df71d69abfc2b5c5ea18fbefbec83');
 assert.equal(await bindingDigest({x:1e-7,unused:undefined}),await byteDigest('{"x": 0.0000001}'));
});
test('migration preview distinguishes existing bindings, edited source and current pension conflicts',async()=>{
 const {target}=migrationTarget(parseBackup(backup())[0],null),bindings=[];
 for(const[k,rs]of Object.entries(target.graph))for(const r of rs)bindings.push({source_scope:target.sourceScope,kind:k,legacy_id:r.id,target_id:r.id,content_hash:await bindingDigest(r)});
 const s={bindings,years:[],workspace:{identity:{}},taxYear:{year:2026},pensionDeclaration:null};
 const p=await migrationPreview(target,s);assert.equal(p.counts.invoices,0);assert.equal(p.duplicates,target.graph.invoices.length);assert.deepEqual(p.errors,[]);
 const changed=copy(target);changed.graph.components[0].amountCents++;assert.ok((await migrationPreview(changed,s)).errors.length);
 s.pensionDeclaration={state:'none'};assert.ok((await migrationPreview(target,s)).errors.some(e=>e.includes('contributi')));
});
test('personal backup preserves both years, originals, private plan and exact ledger without writes',()=>{
 const b=backup(),before=canonicalJson(b),[r]=parseBackup(b),{target,warnings}=migrationTarget(r,null);
 assert.equal(target.years.length,2);assert.deepEqual(target.original,b.state);assert.equal(canonicalJson(b),before);
 assert.deepEqual(target.graph,graphFromLedger(b.state.ledger,b.state.profile.activities));
 assert.equal(target.pensionDeclarations.every(d=>d.state==='unknown'),true);assert.ok(warnings.length);assert.ok(target.years.every(y=>y.privateLiquidity));
});
test('canonical transfer integrity, no fuzzy identity, immutable cloud ID conflict',()=>{
 const b=transfer(),[r]=parseBackup(b);assert.equal(r.talId,b.metadata.clientCode);
 const chosen=migrationTarget(r,{id:'w',talId:'TAL-XXXXXXXX',dataRevision:0});
 assert.equal(chosen.target.workspaceId,'w');assert.equal(chosen.target.talId,'TAL-XXXXXXXX');
 assert.equal(chosen.target.legacyTalId,r.talId);assert.ok(chosen.warnings.some(x=>x.includes('riferimento di origine')));
 b.identity.taxCode='00000000702';assert.throws(()=>parseBackup(b),/integrità/);
});
test('invalid backup money, schema and tax-year data rejected before preview',()=>{
 for(const mutate of [b=>b.state.schemaVersion='unknown',b=>b.state.ledger.payments[0].amountCents=1.3,b=>delete b.state.fiscalYears['2025']]){const b=backup();mutate(b);assert.throws(()=>parseBackup(b));}
});
test('empty contribution list stays unknown unless explicit annual confirmation',()=>{
 const [r]=parseBackup(backup());assert.equal(migrationTarget(r,null).target.pensionDeclarations[0].state,'unknown');
 assert.equal(migrationTarget(r,null,{confirmNoContributions:[2025]}).target.pensionDeclarations.find(d=>d.year===2025).state,'none');
});

test('personal backup source scope stays stable after edits; file hash still changes',()=>{
 const b=backup(),first=parseBackup(b)[0];b.state.profile.name='SYNTHETIC MODIFIED';const next=parseBackup(b)[0];
 assert.equal(first.sourceScope,next.sourceScope);assert.notEqual(first.sourceDigest,next.sourceDigest);
});
test('pension facts that cannot be mapped preserve source and keep fiscal deduction unknown',()=>{
 const b=backup();b.state.contributionPayments=[{id:'synthetic-pension',paidDate:'2026-02-01',amountCents:1200,managementId:'GS_PROFESSIONAL',deductible:false}];
 const {target}=migrationTarget(parseBackup(b)[0],null);
 assert.equal(target.graph.pensionPayments.length,0);assert.equal(target.original.contributionPayments[0].amountCents,1200);assert.equal(target.original.contributionPayments[0].deductible,false);
 assert.equal(target.pensionDeclarations.find(d=>d.year===2026).state,'unknown');
});
test('CSV preview uses original S01 mapping, exact Italian cents/dates and real Payment/Allocation',async()=>{
 const d=await readImportFile(new File([fixture.table.csv],'synthetic.csv'));
 const p=spreadsheetPreview({matrix:d.sheets[0].matrix,records:records()});assert.equal(p.counts.ready,3);assert.equal(p.counts.errors,0);
 const positions=records().map(r=>({id:r.clientId,talId:r.clientCode,dataRevision:0}));
 const targets=tabularTargets(p,positions);assert.equal(targets.length,3);
 for(const t of targets){assert.equal(t.graph.components[0].amountCents,100001);assert.equal(t.graph.payments[0].amountCents,50000);assert.equal(t.graph.allocations[0].amountCents,50000);}
});
test('out-of-scope client blocks entire table, TAL ID is never an authorization',async()=>{
 const d=await readImportFile(new File([fixture.table.csv],'s.csv')),p=spreadsheetPreview({matrix:d.sheets[0].matrix,records:records().slice(0,2)});
 assert.equal(p.counts.errors,1);assert.throws(()=>tabularTargets(p,[]));
});
test('same row twice deterministic duplicate, changed same-number row is conflict',async()=>{
 const d=await readImportFile(new File([fixture.table.csv],'s.csv')),m=d.sheets[0].matrix;
 m.push(copy(m[1]));let p=spreadsheetPreview({matrix:m,records:records()});assert.equal(p.counts.duplicates,1);assert.equal(p.counts.ready,3);
 m.at(-1)[3]='2.000,00';p=spreadsheetPreview({matrix:m,records:records()});assert.equal(p.counts.errors,1);
});
test('CSV and actual XLSX including sheet selection produce equivalent normalized command',async()=>{
 const context=vm.createContext({ArrayBuffer,Uint8Array,TextDecoder,TextEncoder});vm.runInContext(await readFile(new URL('../../assets/vendor/sheetjs-0.20.3.min.js',import.meta.url),'utf8'),context);const xlsx=context.XLSX;
 const d=await readImportFile(new File([fixture.table.csv],'s.csv')),wb=xlsx.utils.book_new();
 xlsx.utils.book_append_sheet(wb,xlsx.utils.aoa_to_sheet([['Unused']]),'Non usare');
 xlsx.utils.book_append_sheet(wb,xlsx.utils.aoa_to_sheet(d.sheets[0].matrix),'Entrate');
 const parsed=await readImportFile(new File([xlsx.write(wb,{bookType:'xlsx',type:'array'})],'s.xlsx'),xlsx);
 const a=spreadsheetPreview({matrix:d.sheets[0].matrix,records:records()}),b=spreadsheetPreview({matrix:parsed.sheets[1].matrix,records:records()});
 assert.deepEqual(a.rows,b.rows);
 const sh=wb.Sheets.Entrate;sh.D2.f='1+1';
 const malicious=await readImportFile(new File([xlsx.write(wb,{bookType:'xlsx',type:'array'})],'s.xlsx'),xlsx);
 assert.ok(spreadsheetPreview({matrix:malicious.sheets[1].matrix,records:records()}).rows[0].errors.some(e=>e.includes('formula')));
});
test('oversize and wrong formats refused locally',async()=>{
 await assert.rejects(readImportFile({name:'big.json',size:16*1024*1024}));
 await assert.rejects(readImportFile(new File(['abc'],'synthetic.exe')));
});
