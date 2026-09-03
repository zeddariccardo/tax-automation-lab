(function(){
'use strict';

const API_PATH='/api/financial-analysis/calcola';
const SCHEMES=['sp_fin','sp_func','sp_sources','sp_pfn','ce_va','ce_ebitda','ce_cogs','ce_contrib','ce_areas','ce_adjusted'];
const DEFAULT_SCHEMES=['sp_fin','sp_func','sp_pfn','ce_va','ce_ebitda','ce_areas'];
const CE_FIELDS=['rev','a2','a3','a4','a5','b6','b7','b8','b9','b10','b10Fixed','b10Receivables','b11','b12','b13','b14','financial','interestExpense','revaluations','taxContribution'];
const SP_FIELDS=['totalAssets','totalSources','equity','currentAssets','nonCurrentAssets','currentLiab','nonCurrentLiab','inventory','cash','tradeReceivables','tradeReceivablesTotal','tradeReceivablesNonCurrent','tradePayables','tradePayablesTotal','tradePayablesNonCurrent','opCurrentAssets','opCurrentLiab','opNonCurrentAssets','opNonCurrentLiab','pfnCash','pfnDebt','financialAssets','nonOpAssets','nonOpLiab'];
const ASSUMPTION_FIELDS=['employeesCurrent','cashFlowDebtService','debtService','purchasesCurrent','vatSalesPct','vatPurchasesPct','interestCoverageExpense','dscrHorizonMonths','cfOtherOperating','cfInterestPaid','cfTaxPaid','cfCapex','cfDisposals','cfOtherInvesting','cfCapital','cfDividends','cfOtherFinancing','cfOtherUnreconstructed','taxSocialDebt','cfDebtFlow','overdueTax','overdueSocial','overdueSuppliers','overdueEmployees','overdueBanks'];
const UNRESOLVED=['currentClass','nature','pfn','function','behavior'];
const TARGETS={
  sp_fin:['sf_noncurrent_assets','sf_current_assets','sf_equity','sf_noncurrent_liab','sf_current_liab'],
  sp_func:['sg_trade_receivables','sg_inventory','sg_other_op_current_assets','sg_trade_payables','sg_other_op_current_liab','sg_op_noncurrent_assets','sg_op_noncurrent_liab','sg_financial_assets','sg_financial_debt','sg_nonop_assets','sg_nonop_liab','sg_equity'],
  sp_sources:['ss_permanent_uses','ss_current_uses','ss_equity','ss_consolidated_sources','ss_current_sources'],
  sp_pfn:['spfn_operating_assets','spfn_operating_liab','spfn_nonop_assets','spfn_nonop_liab','spfn_equity','spfn_debt','spfn_cash'],
  ce_va:['cv_revenue','cv_inventory_products','cv_internal_work','cv_other_revenue','cv_materials','cv_services','cv_leases','cv_other_costs','cv_personnel','cv_da','cv_provisions','cv_financial','cv_revaluations','cv_taxes','cv_other'],
  ce_ebitda:['ce_prod','ce_external','ce_personnel','ce_da_prov','ce_financial','ce_taxes','ce_other'],
  ce_cogs:['cg_revenue','cg_inventory_products','cg_internal_work','cg_other_revenue','cg_prod_direct','cg_prod_indirect','cg_prod_da','cg_logistics','cg_selling','cg_ga','cg_rd','cg_other_operating','cg_da_prov','cg_financial','cg_taxes'],
  ce_contrib:['cc_revenue','cc_variable','cc_mixed_variable','cc_fixed_specific','cc_mixed_fixed','cc_fixed_common','cc_da_prov','cc_financial','cc_taxes'],
  ce_areas:['ca_operating_revenue','ca_operating_costs','ca_financial','ca_revaluations','ca_taxes','ca_other'],
  ce_adjusted:['cad_operating_revenue','cad_operating_costs','cad_below_ebitda','cad_financial','cad_taxes']
};
const SCHEME_META={
  sp_fin:['Stato patrimoniale — criterio finanziario','SP'],sp_func:['Stato patrimoniale — pertinenza gestionale','SP'],sp_sources:['Stato patrimoniale — fonti e impieghi','SP'],sp_pfn:['Capitale investito e posizione finanziaria netta','SP'],
  ce_va:['Conto economico — valore aggiunto','CE'],ce_ebitda:['Conto economico — EBITDA / EBIT','CE'],ce_cogs:['Conto economico — costo del venduto','CE'],ce_contrib:['Conto economico — margine di contribuzione','CE'],ce_areas:['Conto economico — aree gestionali','CE'],ce_adjusted:['EBITDA adjusted','CE']
};
const TARGET_LABELS={
  sf_noncurrent_assets:'Attivo immobilizzato',sf_current_assets:'Attivo corrente',sf_equity:'Patrimonio netto',sf_noncurrent_liab:'Passività consolidate',sf_current_liab:'Passività correnti',
  sg_trade_receivables:'Crediti commerciali',sg_inventory:'Rimanenze',sg_other_op_current_assets:'Altre attività operative correnti',sg_trade_payables:'Debiti commerciali',sg_other_op_current_liab:'Altre passività operative correnti',sg_op_noncurrent_assets:'Attività operative non correnti',sg_op_noncurrent_liab:'Passività operative non correnti',sg_financial_assets:'Attività finanziarie / liquide',sg_financial_debt:'Debiti finanziari',sg_nonop_assets:'Altre attività non operative',sg_nonop_liab:'Altre passività non operative',sg_equity:'Patrimonio netto',
  ss_permanent_uses:'Impieghi permanenti',ss_current_uses:'Impieghi correnti',ss_equity:'Fonti proprie',ss_consolidated_sources:'Fonti consolidate',ss_current_sources:'Fonti correnti',
  spfn_operating_assets:'Attività operative',spfn_operating_liab:'Passività operative',spfn_nonop_assets:'Attività non operative',spfn_nonop_liab:'Passività non operative',spfn_equity:'Patrimonio netto',spfn_debt:'Debito finanziario lordo',spfn_cash:'Liquidità e attività finanziarie incluse',
  cv_revenue:'Ricavi delle vendite',cv_inventory_products:'Variazione prodotti e lavori in corso',cv_internal_work:'Incrementi per lavori interni',cv_other_revenue:'Altri ricavi e proventi',cv_materials:'Materie e variazione materie',cv_services:'Servizi',cv_leases:'Godimento beni di terzi',cv_other_costs:'Oneri diversi di gestione',cv_personnel:'Costo del personale',cv_da:'Ammortamenti e svalutazioni',cv_provisions:'Accantonamenti',cv_financial:'Gestione finanziaria',cv_revaluations:'Rettifiche finanziarie',cv_taxes:'Imposte',cv_other:'Altri componenti',
  ce_prod:'Valore della produzione',ce_external:'Costi operativi esterni',ce_personnel:'Costo del personale',ce_da_prov:'D&A, svalutazioni e accantonamenti',ce_financial:'Gestione finanziaria e rettifiche',ce_taxes:'Imposte',ce_other:'Altri componenti',
  cg_revenue:'Ricavi',cg_inventory_products:'Variazione prodotti e lavori in corso',cg_internal_work:'Incrementi per lavori interni',cg_other_revenue:'Altri ricavi operativi',cg_prod_direct:'Produzione — costi diretti',cg_prod_indirect:'Produzione — costi indiretti',cg_prod_da:'D&A industriale',cg_logistics:'Logistica',cg_selling:'Commerciale',cg_ga:'Amministrazione / corporate',cg_rd:'Ricerca e sviluppo',cg_other_operating:'Altri costi operativi',cg_da_prov:'D&A e accantonamenti non allocati',cg_financial:'Gestione finanziaria',cg_taxes:'Imposte',
  cc_revenue:'Ricavi e proventi operativi',cc_variable:'Costi variabili',cc_mixed_variable:'Quota variabile dei costi misti',cc_fixed_specific:'Costi fissi specifici',cc_mixed_fixed:'Quota fissa dei costi misti',cc_fixed_common:'Costi fissi comuni',cc_da_prov:'D&A, svalutazioni e accantonamenti',cc_financial:'Gestione finanziaria',cc_taxes:'Imposte',
  ca_operating_revenue:'Ricavi e proventi operativi',ca_operating_costs:'Costi operativi',ca_financial:'Gestione finanziaria',ca_revaluations:'Rettifiche finanziarie',ca_taxes:'Imposte',ca_other:'Altri componenti',
  cad_operating_revenue:'Ricavi e proventi operativi',cad_operating_costs:'Costi operativi reported',cad_below_ebitda:'D&A, svalutazioni e accantonamenti',cad_financial:'Gestione finanziaria',cad_taxes:'Imposte'
};
const ROW_LABELS={
  noncurrent_assets:'Attivo immobilizzato',current_assets:'Attivo corrente',uses_total:'Totale impieghi',equity:'Patrimonio netto',noncurrent_liabilities:'Passività consolidate',current_liabilities:'Passività correnti',sources_total:'Totale fonti',balance_difference:'Differenza di quadratura',working_capital:'Capitale circolante netto',
  trade_receivables:'Crediti commerciali',inventory:'Rimanenze',other_op_current_assets:'Altre attività operative correnti',trade_payables:'Debiti commerciali',other_op_current_liabilities:'Altre passività operative correnti',ccno:'CCNO',op_noncurrent_assets:'Attività operative non correnti',op_noncurrent_liabilities:'Passività operative non correnti',fixed_operating_net:'Immobilizzazioni operative nette',cin:'Capitale investito netto operativo',
  permanent_uses:'Impieghi permanenti',current_uses:'Impieghi correnti',consolidated_sources:'Fonti consolidate',current_sources:'Fonti correnti',operating_assets:'Attività operative',operating_liabilities:'Passività operative',nonop_assets:'Attività non operative',nonop_liabilities:'Passività non operative',capital_invested:'Capitale investito netto complessivo',gross_debt:'Debito finanziario lordo',cash:'Liquidità e attività finanziarie incluse',pfn:'Posizione finanziaria netta',
  revenue:'Ricavi',inventory_products:'Variazione prodotti e lavori in corso',internal_work:'Incrementi per lavori interni',other_revenue:'Altri ricavi e proventi',production:'Valore della produzione',materials:'Materie e variazione materie',services:'Servizi',leases:'Godimento beni di terzi',other_costs:'Oneri diversi di gestione',value_added:'Valore aggiunto',personnel:'Costo del personale',ebitda:'EBITDA',da:'Ammortamenti e svalutazioni',provisions:'Accantonamenti',ebit:'EBIT',financial:'Gestione finanziaria',revaluations:'Rettifiche finanziarie',taxes:'Imposte',pbt:'Risultato ante imposte',net:'Risultato netto',
  external:'Costi operativi esterni',da_prov:'D&A, svalutazioni e accantonamenti',cogs:'Costo del venduto',gross_margin:'Margine lordo',logistics:'Logistica',selling:'Commerciale',ga:'Amministrazione / corporate',rd:'Ricerca e sviluppo',other_operating:'Altri costi operativi',variable:'Costi variabili',mixed_variable:'Quota variabile costi misti',contribution_1:'Margine di contribuzione I',fixed_specific:'Costi fissi specifici',mixed_fixed:'Quota fissa costi misti',contribution_2:'Margine di contribuzione II',fixed_common:'Costi fissi comuni',operating_revenue:'Ricavi e proventi operativi',operating_costs:'Costi operativi',ebitda_reported:'EBITDA reported',adjustments:'Rettifiche gestionali',ebitda_adjusted:'EBITDA adjusted'
};
const KPI_META={
  liq_current_ratio:['Current ratio','Liquidità','x'],liq_quick_ratio:['Quick ratio','Liquidità','x'],liq_cash_ratio:['Cash ratio','Liquidità','x'],liq_ccn:['Capitale circolante netto','Liquidità','EUR'],liq_treasury_margin:['Margine di tesoreria','Liquidità','EUR'],
  str_autonomy:['Indice di autonomia finanziaria','Solidità','%'],str_leverage:['Leverage','Solidità','x'],str_debt_equity:['Debito finanziario / Patrimonio netto','Solidità','x'],str_pfn_equity:['PFN / Patrimonio netto','Solidità','x'],str_cover_primary:['Copertura primaria immobilizzazioni','Solidità','x'],str_cover_secondary:['Copertura secondaria immobilizzazioni','Solidità','x'],str_rigidity:['Rigidità degli impieghi','Solidità','%'],str_elasticity:['Elasticità degli impieghi','Solidità','%'],
  prof_ebitda_margin:['EBITDA margin','Redditività','%'],prof_ros:['ROS','Redditività','%'],prof_net_margin:['Net margin','Redditività','%'],prof_roe:['ROE','Redditività','%'],prof_roi:['ROI','Redditività','%'],prof_roa:['ROA operativo','Redditività','%'],prof_roce:['ROCE','Redditività','%'],prof_roa_net:['ROA netto','Redditività','%'],
  debt_pfn:['Posizione finanziaria netta','Indebitamento','EUR'],debt_gross:['Debito finanziario lordo','Indebitamento','EUR'],debt_pfn_ebitda:['PFN / EBITDA','Indebitamento','x'],debt_gross_ebitda:['Debito lordo / EBITDA','Indebitamento','x'],debt_interest_ebit:['Interest coverage EBIT','Indebitamento','x'],debt_interest_ebitda:['Interest coverage EBITDA','Indebitamento','x'],debt_dscr:['DSCR','Indebitamento','x'],
  eff_asset_turnover:['Asset turnover','Efficienza','x'],eff_capital_turnover:['Capital turnover','Efficienza','x'],eff_dso:['DSO','Efficienza','giorni'],eff_dpo:['DPO','Efficienza','giorni'],eff_dio:['DIO','Efficienza','giorni'],eff_ccc:['Cash conversion cycle','Efficienza','giorni'],
  grow_revenue:['Crescita ricavi','Crescita','%'],grow_ebitda:['Crescita EBITDA','Crescita','%'],grow_ebit:['Crescita EBIT','Crescita','%'],grow_net:['Crescita risultato netto','Crescita','%'],grow_equity:['Crescita patrimonio netto','Crescita','%'],
  prod_revenue_employee:['Ricavi per dipendente','Produttività','EUR'],prod_va_employee:['Valore aggiunto per dipendente','Produttività','EUR'],prod_personnel_employee:['Costo del personale per dipendente','Produttività','EUR']
};
const KPI_CODES=Object.keys(KPI_META);
const REASON_LABELS={classification_pending:'Classificazioni da confermare',classification_residual:'Poste non classificate',import_error:'Errori nel file importato',balance_unreconciled:'Stato patrimoniale non quadrato',comparative_missing:'Comparativo non disponibile',scheme_required:'Schema richiesto',components_missing:'Componenti mancanti',missing_input:'Dato integrativo mancante',not_applicable:'Non applicabile',proxy:'Valore basato su proxy',derived_denominator:'Denominatore derivato',point_in_time_basis:'Saldo puntuale',horizon_short:'Orizzonte inferiore a 12 mesi',aggregate_proxy:'Proxy aggregato',capital_reconciliation_failed:'Capitale investito e fonti non riconciliati'};

const q=id=>document.getElementById(id);
const esc=value=>String(value==null?'':value).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const clone=value=>JSON.parse(JSON.stringify(value));
const finite=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?(Object.is(n,-0)?0:n):fallback;};
const optional=value=>value===''||value==null?null:finite(value,null);
const token=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const round2=value=>Math.round((finite(value)+Number.EPSILON)*100)/100;
const fmt=(value,dec=0)=>value==null||!Number.isFinite(value)?'—':new Intl.NumberFormat('it-IT',{minimumFractionDigits:dec,maximumFractionDigits:dec,useGrouping:'always'}).format(Math.abs(value)<1e-9?0:value);
const money=(value,dec=0)=>value==null||!Number.isFinite(value)?'—':new Intl.NumberFormat('it-IT',{style:'currency',currency:STATE.company.currency||'EUR',minimumFractionDigits:dec,maximumFractionDigits:dec,useGrouping:'always'}).format(Math.abs(value)<1e-9?0:value);
const displayKpi=item=>{const unit=KPI_META[item.code]?.[2]||'';if(item.value==null)return'—';if(unit==='%')return fmt(item.value*100,1)+'%';if(unit==='EUR')return money(item.value);if(unit==='giorni')return fmt(item.value,1)+' gg';return fmt(item.value,2)+(unit?' '+unit:'');};
const canonical=value=>Array.isArray(value)?value.map(canonical):(value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):(Object.is(value,-0)?0:value));
const utf8Bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).byteLength;
async function digest(value){const text=JSON.stringify(canonical(value));if(crypto?.subtle){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');}let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return'fnv1a-'+(h>>>0).toString(16);}

const STATE={
  company:{name:'',vat:'',cf:'',currency:'EUR',schema:'',periodFrom:'',periodTo:'',yearCurrent:new Date().getFullYear(),yearPrevious:new Date().getFullYear()-1,days:365},
  accounts:[],attrs:{},selected:new Set(DEFAULT_SCHEMES),reclassMap:{},mappingScheme:'sp_fin',diagnostics:[],loaded:false,
  periods:{current:{available:true},previous:{available:false}},scenarios:{budget:[],forecast:[]},scenarioMeta:{},centers:[],centerCatalog:[],benchmark:[],history:[],adjustments:[],extra:{aiFindings:[]},files:{main:'',budget:'',forecast:'',centers:'',benchmark:''},fileMeta:{}
};
const ANALYSIS={status:'idle',result:null,resultHash:'',resultKey:'',payloadHash:'',error:null,generation:0,requests:0,deduped:0,staleResponses:0,invalidResponses:0,maxConcurrent:0,concurrent:0,lastBytes:0,lastBreakdown:null};
const transport={endpoint:API_PATH,debounceMs:220,timeoutMs:8000,timer:null,inflight:null,queued:null};
window.STATE=STATE;

function toast(message,error=false){const el=q('toast');if(!el)return;el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2800);}
function parseNumber(value){if(typeof value==='number')return Number.isFinite(value)?value:0;let s=String(value??'').trim().replace(/\s/g,'').replace(/€|\$|£|CHF/gi,'');if(!s)return 0;const neg=(s.startsWith('(')&&s.endsWith(')'))||s.startsWith('-');s=s.replace(/[()]/g,'').replace(/^-/,'');const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');if(lc>=0&&ld>=0)s=lc>ld?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(lc>=0)s=(s.split(',')[1]||'').length===3?s.replace(',',''):s.replace(',','.');else if(ld>=0&&(s.split('.')[1]||'').length===3)s=s.replace('.','');const n=Number(s.replace(/[^0-9+.]/g,''));return Number.isFinite(n)?(neg?-Math.abs(n):n):0;}
function infoFor(code){const abbreviated=typeof VOCI_ABBR!=='undefined'?VOCI_ABBR:[],ordinary=typeof VOCI_ORD!=='undefined'?VOCI_ORD:[],all=[...abbreviated,...ordinary];return all.find(row=>token(row.code)===token(code))||null;}
function normalizeIv(value,type){const raw=String(value||'').trim(),t=token(raw).replace(/^CE|^SP/,'');const aliases={AATT:'A_ATT',DATT:'D_ATT',BPAS:'B_PAS',DCE:'D_CE'};const code=aliases[t]||t;const info=infoFor(code);return{code:info?info.code:code,raw,alias:!!aliases[t],unsupported:!info,type};}
function sectionFor(account){const info=infoFor(account.iv);if(info)return info.sec;if(account.type==='CE')return'ce';return finite(account.current)>=0?'sp_attivo':'sp_passivo';}
function accountKey(account){return`${account.type}|${account.code}`;}
function attrsFor(account){const key=accountKey(account);if(!STATE.attrs[key])STATE.attrs[key]={...(account.attrs||{})};return STATE.attrs[key];}
// Import Excel: lettura delle celle originali, prima di qualunque modifica a STATE.
const IMPORT_ACCOUNT_COLUMNS={
  code:['codice conto','codice'],desc:['descrizione conto','descrizione'],
  cur:['importo esercizio corrente','importo corrente','corrente'],
  prev:['importo esercizio precedente','importo precedente','precedente'],
  iv:['voce iv direttiva','voce civilistica','iv direttiva']
};
const importEmpty=value=>value==null||(typeof value==='string'&&!value.trim());
const importName=value=>String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
function importError(src,field,message){
  const cell=XLSX.utils.encode_cell({r:src.r,c:src.c});
  throw new Error(src.sheet+', riga '+(src.r+1)+', cella '+cell+', '+field+': '+message);
}
function importCell(wb,sheet,r,c,field){
  const cell=wb.Sheets[sheet]?.[XLSX.utils.encode_cell({r,c})],src={sheet,r,c,cell,value:cell?.v};
  const errors={0:'#NULL!',7:'#DIV/0!',15:'#VALUE!',23:'#REF!',29:'#NAME?',36:'#NUM!',42:'#N/A',43:'#GETTING_DATA'};
  if(cell?.f&&(importEmpty(cell.v)||cell.t==='z'))importError(src,field,'formula senza risultato salvato; ricalcolare e salvare il file in Excel.');
  if(cell?.t==='e')importError(src,field,'errore Excel '+(errors[cell.v]||cell.w||cell.v||'non specificato'));
  if(typeof src.value==='string'&&/^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA|SPILL!|CALC!)/i.test(src.value.trim()))importError(src,field,'errore Excel '+src.value);
  return src;
}
function importNumber(src,field,empty=0){
  if(importEmpty(src.value))return empty;
  if(src.cell?.t==='d'||(src.cell?.z&&XLSX.SSF.is_date(src.cell.z)))importError(src,field,'data Excel non ammessa come importo.');
  const v=src.value;let n;
  if(typeof v==='number')n=v;
  else if(typeof v==='string'){
    const s=v.trim();
    if(/^[+-]?\d{1,3}[.,]\d{3}$/.test(s))importError(src,field,'numero testuale ambiguo «'+s+'»: usare una cella numerica o decimali espliciti.');
    if(/^[+-]?\d+$/.test(s)||/^[+-]?\d+\.\d+$/.test(s))n=Number(s);
    else if(/^[+-]?\d+,\d+$/.test(s))n=Number(s.replace(',','.'));
    else if(/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(s))n=Number(s.replace(/\./g,'').replace(',','.'));
    else if(/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(s))n=Number(s.replace(/,/g,''));
  }
  if(!Number.isFinite(n))importError(src,field,'numero non valido «'+String(v)+'».');
  return Object.is(n,-0)?0:n;
}
function importText(src,field,{identifier=false}={}){
  if(importEmpty(src.value))return'';
  if(src.cell?.t==='d')importError(src,field,'data non ammessa per questo campo.');
  if(identifier&&typeof src.value==='number'){
    if(!Number.isSafeInteger(src.value)||src.value<0)importError(src,field,'identificativo numerico non valido.');
    const formatted=String(src.cell.w??XLSX.utils.format_cell(src.cell)).trim();
    // Solo zeri realmente conservati dalla formattazione Excel; nessun padding inventato.
    if(/^0\d+$/.test(formatted)&&Number(formatted)===src.value)return formatted;
  }
  return String(src.value).trim();
}
function importDate(wb,src,field){
  if(importEmpty(src.value))return'';
  let y,m,d;
  if(typeof src.value==='number'){
    if(!Number.isInteger(src.value)||src.value<0)importError(src,field,'data Excel non valida.');
    const date=XLSX.SSF.parse_date_code(src.value,{date1904:!!wb.Workbook?.WBProps?.date1904});
    if(date)({y,m,d}=date);
  }else if(src.value instanceof Date){
    y=src.value.getUTCFullYear();m=src.value.getUTCMonth()+1;d=src.value.getUTCDate();
  }else{
    const s=String(src.value).trim(),iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s),it=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if(iso)[y,m,d]=iso.slice(1).map(Number);else if(it)[d,m,y]=it.slice(1).map(Number);
  }
  const date=new Date(Date.UTC(y,m-1,d));
  if(!(y>=1000&&y<=9999)||date.getUTCFullYear()!==y||date.getUTCMonth()+1!==m||date.getUTCDate()!==d)importError(src,field,'data impossibile o formato non valido; usare GG/MM/AAAA o AAAA-MM-GG.');
  return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function importRange(wb,sheet){
  return wb.Sheets[sheet]?.['!ref']?XLSX.utils.decode_range(wb.Sheets[sheet]['!ref']):{s:{r:0,c:0},e:{r:0,c:0}};
}
function importRowUsed(wb,sheet,r){
  const range=importRange(wb,sheet);
  for(let c=range.s.c;c<=range.e.c;c++){const cell=wb.Sheets[sheet]?.[XLSX.utils.encode_cell({r,c})];if(cell&&(cell.f||cell.t==='e'||!importEmpty(cell.v)))return true;}
  return false;
}
function importTable(wb,sheet,columns,required=Object.keys(columns),warnings=[]){
  if(!wb.Sheets[sheet])throw new Error('Foglio “'+sheet+'” assente.');
  const range=importRange(wb,sheet);let header=-1,ix={};
  // Una riga titolo è ammessa; l'header deve comunque corrispondere agli alias espliciti.
  for(let r=range.s.r;r<=Math.min(range.e.r,range.s.r+10);r++){
    const found={};
    for(let c=range.s.c;c<=range.e.c;c++){
      const name=importName(importCell(wb,sheet,r,c,'Intestazione').value);
      const key=Object.keys(columns).find(k=>columns[k].some(alias=>importName(alias)===name));
      if(key){if(found[key]!=null)importError({sheet,r,c},columns[key][0],'intestazione duplicata.');found[key]=c;}
    }
    if(required.every(key=>found[key]!=null)){header=r;ix=found;break;}
  }
  if(header<0)importError({sheet,r:range.s.r,c:range.s.c},'Intestazioni','struttura non valida: richieste '+required.map(k=>columns[k][0]).join(', ')+'.');
  for(let r=range.s.r;r<header;r++){
    const cells=[];for(let c=range.s.c;c<=range.e.c;c++){const src=importCell(wb,sheet,r,c,'Riga titolo');if(!importEmpty(src.value))cells.push(src);}
    if(cells.length>1||(cells.length===1&&typeof cells[0].value!=='string'))importError(cells[0],'Struttura','dati prima dell’intestazione: spostarli sotto le colonne corrette.');
  }
  const get=(r,key)=>ix[key]==null?{sheet,r,c:range.s.c,value:undefined}:importCell(wb,sheet,r,ix[key],columns[key][0]);
  const rows=[];
  for(let r=header+1;r<=range.e.r;r++)if(importRowUsed(wb,sheet,r))rows.push(r);
  for(let c=range.s.c;c<=range.e.c;c++)if(!Object.values(ix).includes(c)&&rows.some(r=>{const cell=wb.Sheets[sheet][XLSX.utils.encode_cell({r,c})];return cell&&(cell.f||cell.t==='e'||!importEmpty(cell.v));})){
    const label=importText(importCell(wb,sheet,header,c,'Intestazione'),'Intestazione')||XLSX.utils.encode_col(c);
    rows.forEach(r=>importCell(wb,sheet,r,c,label));
    warnings.push({level:'warning',text:sheet+': la colonna “'+label+'” non è importabile nel modello attuale; il suo contenuto non viene acquisito.'});
  }
  return{rows,get,header,ix};
}
function importUniqueAccounts(accounts){
  const seen=new Map();
  for(const a of accounts){const key=accountKey(a),previous=seen.get(key);if(previous){
    // Guardrail temporaneo: il template ammette sottoconti, ma sezione|codice
    // oggi li raggruppa. Il supporto per identità di riga indipendenti è un task separato.
    importError(a.importSource,'Codice conto','Il codice conto '+a.code+' compare in più righe che l\'attuale mapping non può distinguere in modo sicuro. '+[previous,a].map(row=>row.importSource.sheet+'!'+XLSX.utils.encode_cell(row.importSource)+' (riga '+row.row+', '+row.desc+')').join('; ')+'. L\'import è stato annullato per evitare una riclassificazione dipendente dall\'ordine delle righe.');
  }seen.set(key,a);}
}
function parseAccountSheet(wb,sheet,type,{scenario=false,warnings=[]}={}){
  const columns=scenario?{...IMPORT_ACCOUNT_COLUMNS,cur:['importo scenario alla data'],section:['sezione']}:IMPORT_ACCOUNT_COLUMNS;
  const required=scenario?['section','code','desc','cur','iv']:Object.keys(columns),table=importTable(wb,sheet,columns,required,warnings),accounts=[];
  for(const r of table.rows){
    const codeSrc=table.get(r,'code'),code=importText(codeSrc,'Codice conto',{identifier:true});
    if(!code)importError(codeSrc,'Codice conto','riga valorizzata senza identificativo.');
    if(scenario&&importName(importText(table.get(r,'section'),'Sezione'))!=='ce')importError(table.get(r,'section'),'Sezione','Budget/Forecast supportano soltanto CE. Le righe SP non sono importabili nel confronto attuale.');
    const normalized=normalizeIv(importText(table.get(r,'iv'),'Voce IV Direttiva'),type),info=infoFor(normalized.code);
    if(!info||(type==='CE')!==(info.sec==='ce'))importError(table.get(r,'iv'),'Voce IV Direttiva','voce non riconosciuta nella sezione '+type+'.');
    accounts.push({type,code,desc:importText(table.get(r,'desc'),'Descrizione conto'),current:importNumber(table.get(r,'cur'),'Importo corrente'),previous:scenario?0:importNumber(table.get(r,'prev'),'Importo precedente'),iv:normalized.code,ivRaw:normalized.raw,row:r+1,importSource:{sheet,r,c:codeSrc.c}});
  }
  importUniqueAccounts(accounts);
  return accounts;
}
function parseAccounts(wb,{requireSP=true,requireCE=true}={}){
  const accounts=[],diagnostics=[];
  for(const [sheet,type,required] of [['Stato Patrimoniale','SP',requireSP],['Conto Economico','CE',requireCE]]){
    if(!wb.Sheets[sheet]&&!required)continue;
    const rows=parseAccountSheet(wb,sheet,type,{warnings:diagnostics});
    if(required&&!rows.length)importError({sheet,r:0,c:0},'Conti','nessuna riga conto utilizzabile.');
    accounts.push(...rows);
  }
  for(const field of ['current','previous']){
    const difference=accounts.filter(a=>a.type==='SP').reduce((sum,a)=>sum+a[field],0);
    if(Math.abs(difference)>.01)throw new Error('Stato Patrimoniale '+(field==='current'?'corrente':'precedente')+': import annullato, differenza di quadratura '+fmt(difference,2)+'.');
  }
  return{accounts,diagnostics,periods:{current:{available:accounts.some(a=>a.current!==0)},previous:{available:accounts.some(a=>a.previous!==0)}}};
}
function parseCompany(wb,warnings=[]){
  const sheet='Anagrafica',company={name:'',vat:'',cf:'',currency:'EUR',schema:'',periodFrom:'',periodTo:''};if(!wb.Sheets[sheet])return company;
  const aliases={name:['denominazione','ragione sociale'],vat:['partita iva'],cf:['codice fiscale'],currency:['valuta'],schema:['schema di bilancio'],periodFrom:['periodo — dal','periodo - dal','periodo dal'],periodTo:['periodo — al','periodo - al','periodo al'],yearCurrent:['esercizio corrente']};
  const sources={},range=importRange(wb,sheet);
  for(let r=range.s.r;r<=range.e.r;r++){
    const label=importText(importCell(wb,sheet,r,0,'Campo'),'Campo'),src=importCell(wb,sheet,r,1,label||'Valore');
    if(r===range.s.r&&importName(label)==='campo'&&importName(src.value)==='valore')continue;
    if(importEmpty(src.value))continue;
    if(!label)importError(src,'Anagrafica','valore privo del nome del campo.');
    const key=Object.keys(aliases).find(k=>aliases[k].some(a=>importName(a)===importName(label)));
    if(!key){warnings.push({level:'warning',text:'Anagrafica: il campo “'+label+'” non è importabile nel modello attuale; il suo contenuto non viene acquisito.'});continue;}
    let value;
    if(key.startsWith('period'))value=importDate(wb,src,label);
    else if(key==='yearCurrent'){value=importNumber(src,label);if(!Number.isInteger(value)||value<1000||value>9999)importError(src,label,'anno non valido.');}
    else if(key==='schema'){const s=importName(importText(src,label));value=['ordinario','ordinaria','ordinary'].includes(s)?'ordinary':['abbreviato','abbreviata','abbrev'].includes(s)?'abbrev':'';if(!value)importError(src,label,'schema non riconosciuto.');}
    else value=importText(src,label,{identifier:['vat','cf'].includes(key)});
    if(key==='currency'){
      value=value.toUpperCase();
      try{new Intl.NumberFormat('it-IT',{style:'currency',currency:value}).format(0);}
      catch(_){importError(src,label,'valuta non valida: usare un codice di tre lettere, per esempio EUR.');}
    }
    if(sources[key]&&company[key]!==value)importError(src,label,'valore discordante con '+sources[key]+'.');
    company[key]=value;sources[key]=sheet+'!'+XLSX.utils.encode_cell(src);
  }
  if(company.periodFrom&&company.periodTo&&company.periodFrom>company.periodTo)throw new Error('Anagrafica: periodo dal successivo al periodo al.');
  if(company.periodTo){const year=Number(company.periodTo.slice(0,4));if(company.yearCurrent&&company.yearCurrent!==year)throw new Error('Anagrafica: esercizio corrente e data finale discordanti.');company.yearCurrent=year;}
  if(company.yearCurrent)company.yearPrevious=company.yearCurrent-1;
  if(company.currency)company.currency=company.currency.toUpperCase();
  return company;
}
function importUnsupportedSheets(wb,consumed,warnings){
  const emptyHeaders={
    'Esiti AI':['Tipo','Codice conto / campo','Elemento da verificare','Stato','Osservazione / assunzione','Fonte utilizzata'],
    Budget:['Sezione','Codice conto','Descrizione conto','Importo scenario alla data','Voce IV Direttiva'],
    Forecast:['Sezione','Codice conto','Descrizione conto','Importo scenario alla data','Voce IV Direttiva'],
    'Catalogo centri':['Codice centro','Descrizione centro'],
    'Allocazioni centri':['Codice conto','Centro di costo','Importo esercizio corrente','Importo esercizio precedente'],
    Benchmark:['Codice KPI','Unità','Q1','Mediana','Q3','Fonte','Anno']
  };
  for(const sheet of wb.SheetNames){
    if(consumed.has(sheet)||['Istruzioni','Voci IV Direttiva'].includes(sheet))continue;
    const range=importRange(wb,sheet);
    let firstRow=range.s.r;
    if(emptyHeaders[sheet]){
      const columns=Object.fromEntries(emptyHeaders[sheet].map((label,i)=>['c'+i,[label]]));
      firstRow=importTable(wb,sheet,columns,Object.keys(columns),warnings).header+1;
    }
    for(let r=firstRow;r<=range.e.r;r++)if(importRowUsed(wb,sheet,r)){
      if(sheet==='Esiti AI')importError({sheet,r,c:0},'Esiti AI','foglio valorizzato non ancora reimportabile: manca il percorso di revisione e chiusura dei rilievi. Nessun esito è stato ignorato; import annullato.');
      importError({sheet,r,c:0},'Foglio','foglio non importabile da questo comando; nessun dato è stato acquisito.');
    }
  }
}
function parseBenchmark(wb,sheet,warnings){
  const columns={code:['codice kpi','codice'],unit:['unità','unita'],q1:['q1','primo quartile'],median:['mediana'],q3:['q3','terzo quartile'],source:['fonte'],year:['anno']},table=importTable(wb,sheet,columns,Object.keys(columns),warnings),seen=new Set();
  return table.rows.map(r=>{
    const code=importText(table.get(r,'code'),'Codice KPI',{identifier:true});
    if(!KPI_CODES.includes(code))importError(table.get(r,'code'),'Codice KPI','identificativo assente o non riconosciuto.');
    if(seen.has(code))importError(table.get(r,'code'),'Codice KPI','codice duplicato '+code+'.');seen.add(code);
    const row={code,unit:importText(table.get(r,'unit'),'Unità'),q1:importNumber(table.get(r,'q1'),'Q1',null),median:importNumber(table.get(r,'median'),'Mediana',null),q3:importNumber(table.get(r,'q3'),'Q3',null),source:importText(table.get(r,'source'),'Fonte'),year:importText(table.get(r,'year'),'Anno')};
    if(row.unit!==KPI_META[code][2])importError(table.get(r,'unit'),'Unità','unità attesa: '+KPI_META[code][2]+'.');
    return row;
  });
}
function parseCenters(wb,sheet,accounts,warnings){
  const columns={code:['codice conto','codice'],desc:['descrizione conto','descrizione'],center:['centro','centro di costo'],cur:['importo corrente','importo esercizio corrente','corrente'],prev:['importo precedente','importo esercizio precedente','precedente']};
  const table=importTable(wb,sheet,columns,['code','center','cur','prev'],warnings);
  return table.rows.map(r=>{
    const code=importText(table.get(r,'code'),'Codice conto',{identifier:true}),center=importText(table.get(r,'center'),'Centro',{identifier:true});
    if(!code)importError(table.get(r,'code'),'Codice conto','riga valorizzata senza identificativo.');
    if(!center)importError(table.get(r,'center'),'Centro','riga valorizzata senza identificativo.');
    if(!accounts.some(a=>a.type==='CE'&&a.code===code))importError(table.get(r,'code'),'Codice conto','conto CE non presente nel bilancio: '+code+'.');
    return{code,center,...(table.ix.desc!=null?{desc:importText(table.get(r,'desc'),'Descrizione conto')}:{}),current:importNumber(table.get(r,'cur'),'Importo corrente'),previous:importNumber(table.get(r,'prev'),'Importo precedente')};
  });
}
function parseCenterCatalog(wb,warnings){
  const sheet='Catalogo centri',table=importTable(wb,sheet,{code:['codice centro'],desc:['descrizione centro']},['code','desc'],warnings),seen=new Set();
  return table.rows.map(r=>{const code=importText(table.get(r,'code'),'Codice centro',{identifier:true});if(!code||seen.has(code))importError(table.get(r,'code'),'Codice centro','codice assente o duplicato.');seen.add(code);return{code,desc:importText(table.get(r,'desc'),'Descrizione centro')};});
}
function prepareImportAccounts(candidate,accounts){
  // Stessa identità e precedenza attributi di prepareAccounts; solo sul candidato.
  for(const account of accounts){
    delete account.importSource;
    if(!account.id)account.id=account.type+'|'+account.code+'|'+(account.row||0);
    const key=accountKey(account);
    candidate.attrs[key]={...inferAttributes(account),...(account.attrs||{}),...(candidate.attrs[key]||{})};
  }
}
function importCandidate(wb,kind,file){
  const candidate={...clone(STATE),selected:new Set(STATE.selected)},warnings=[],consumed=new Set();
  const take=(name)=>{consumed.add(name);return !!wb.Sheets[name];};
  if(kind==='main'||kind==='history'){
    const parsed=parseAccounts(wb),company={...candidate.company,...parseCompany(wb,warnings)};
    ['Stato Patrimoniale','Conto Economico','Anagrafica'].forEach(take);warnings.push(...parsed.diagnostics);
    if(kind==='main'){Object.assign(candidate,{accounts:parsed.accounts,company,periods:parsed.periods,attrs:{},reclassMap:{},loaded:true,diagnostics:[]});candidate.files.main=file;prepareImportAccounts(candidate,candidate.accounts);}
    else{if(!wb.Sheets.Anagrafica||!parseCompany(wb).yearCurrent)throw new Error('Anagrafica: indicare il periodo o l’esercizio del bilancio storico.');prepareImportAccounts(candidate,parsed.accounts);candidate.history=[...candidate.history,{year:company.yearCurrent,accounts:parsed.accounts,field:'current',periods:parsed.periods}].slice(-12);}
  }
  for(const scenario of ['budget','forecast'])if(kind==='main'||kind===scenario){
    const sheet=scenario==='budget'?'Budget':'Forecast';let rows;
    if(take(sheet))rows=parseAccountSheet(wb,sheet,'CE',{scenario:true,warnings});
    else if(kind===scenario){const name=wb.Sheets['Conto Economico']?'Conto Economico':'Dati';take(name);rows=parseAccountSheet(wb,name,'CE',{warnings});}
    if(rows){if(kind===scenario&&!rows.length)throw new Error(sheet+': nessun conto CE utilizzabile.');prepareImportAccounts(candidate,rows);candidate.scenarios[scenario]=rows;candidate.files[scenario]=file;}
  }
  if(kind==='main'||kind==='centers'){
    const catalog=take('Catalogo centri');if(catalog)candidate.centerCatalog=parseCenterCatalog(wb,warnings);
    const name=['Allocazioni centri','Allocazioni',...(kind==='centers'?['Dati']:[])].find(n=>wb.Sheets[n]);
    if(name){take(name);candidate.centers=parseCenters(wb,name,candidate.accounts,warnings);candidate.files.centers=file;}
    else if(kind==='centers')throw new Error('Foglio Allocazioni centri/Allocazioni assente.');
    if(name&&catalog&&candidate.centerCatalog.length)for(const row of candidate.centers)if(!candidate.centerCatalog.some(c=>c.code===row.center))throw new Error(name+': centro '+row.center+' assente dal Catalogo centri.');
  }
  if(kind==='main'||kind==='benchmark'){
    const name=wb.Sheets.Benchmark?'Benchmark':kind==='benchmark'?'Dati':null;
    if(name){take(name);candidate.benchmark=parseBenchmark(wb,name,warnings);candidate.files.benchmark=file;}
  }
  importUnsupportedSheets(wb,consumed,warnings);
  candidate.diagnostics.push(...warnings);
  return candidate;
}
function readWorkbook(file,callback,onSuccess){
  const reader=new FileReader();
  reader.onerror=()=>toast('Import annullato: impossibile leggere il file.',true);
  reader.onload=event=>{
    let candidate;
    try{candidate=callback(XLSX.read(event.target.result,{type:'array',cellNF:true,sheetStubs:true}));}
    catch(error){toast('Import annullato: '+error.message,true);return;}
    // Unica applicazione, dopo la validazione dell'intero file. Nessuna persistenza
    // o invalidazione del risultato durante parsing, controlli e preparazione.
    Object.assign(STATE,candidate);
    updateAll();
    if(onSuccess)onSuccess();
    toast(STATE.accounts.length+' conti disponibili. Import completato'+(STATE.diagnostics.some(d=>d.level==='warning')?' con avvisi: consulta Importa Excel.':'.'));
  };
  reader.readAsArrayBuffer(file);
}

function inferAttributes(account){const c=token(account.iv),sec=sectionFor(account),d=String(account.desc||'').toLowerCase(),out={};if(account.type==='SP'){
  if(sec==='sp_attivo'){out.currentClass=/^B(I|II|III)/.test(c)||c==='CIIO'?'noncurrent':'current';if(/^CI(?:[1-5])?$/.test(c))out.nature='inventory';else if(/^CIV/.test(c))out.nature='cash';else if(c==='CII1'||/client|crediti commercial/.test(d))out.nature='trade_receivable';else if(/^BI(?:[1-7])?$/.test(c)||/^BII/.test(c))out.nature='operating';else out.nature=/finanzi|prestito|cash pooling/.test(d)?'financial_nonoperating':'operating_other';out.pfn=out.nature==='cash'?'cash':out.nature==='financial_nonoperating'?'financial_asset':'exclude';}
  else{out.currentClass=/^AI|^AII|^AIII|^AIV|^AV|^AVI|^AVII|^AVIII|^AIX/.test(c)?'equity':(c==='DO'||c==='C'?'noncurrent':'current');if(out.currentClass==='equity')out.nature='equity';else if(/fornitor/.test(d))out.nature='trade_payable';else if(/mutuo|finanzi|prestito|banca/.test(d))out.nature='financial';else if(/tribut|previd|inps|iva/.test(d))out.nature='tax_operating';else out.nature='operating_other';out.pfn=out.nature==='financial'?'debt':'exclude';}
  for(const key of ['currentClass','nature','pfn'])out[key+'Status']='confirmed';
 }else{out.function=/produz|mater|impiant|macchin/.test(d)?'production_direct':/logistic|trasport/.test(d)?'logistics':/vendit|commercial/.test(d)?'selling':/ricerca|svilupp/.test(d)?'rd':'ga';out.behavior=/mater|provvig|trasport/.test(d)?'variable':'fixed_common';out.functionStatus='confirmed';out.behaviorStatus='confirmed';}
 return out;}
function prepareAccounts(accounts){for(const account of accounts){if(!account.id)account.id=`${account.type}|${account.code}|${account.row||0}`;const key=accountKey(account);STATE.attrs[key]={...inferAttributes(account),...(account.attrs||{}),...(STATE.attrs[key]||{})};}}
function unresolved(key){return STATE.accounts.some(account=>{const attrs=attrsFor(account);if(account.type==='CE'&&['function','behavior'].includes(key))return !attrs[key]||attrs[key+'Status']==='proposed'||attrs[key+'Status']==='missing';if(account.type==='SP'&&['currentClass','nature','pfn'].includes(key))return !attrs[key]||attrs[key+'Status']==='proposed'||attrs[key+'Status']==='missing';return false;});}
function contractAmount(account,field='current'){const raw=finite(account[field]);if(account.type==='CE')return-raw;return sectionFor(account)==='sp_attivo'?raw:-raw;}
function groupsFor(accounts,type){const groups=new Map();for(const account of accounts.filter(row=>row.type===type)){const key=accountKey(account);if(!groups.has(key))groups.set(key,{key,accounts:[]});groups.get(key).accounts.push(account);}return Array.from(groups.values());}
function groupAmount(group,field='current'){return group.accounts.reduce((sum,account)=>sum+contractAmount(account,field),0);}
function defaultTarget(scheme,group){const account=group.accounts[0],attrs=attrsFor(account),c=token(account.iv),sec=sectionFor(account),cl=attrs.currentClass,n=attrs.nature,p=attrs.pfn,d=String(account.desc||'').toLowerCase();
  if(scheme==='sp_fin'){if(sec==='sp_attivo')return cl==='noncurrent'?'sf_noncurrent_assets':'sf_current_assets';if(n==='equity'||cl==='equity')return'sf_equity';return cl==='noncurrent'?'sf_noncurrent_liab':'sf_current_liab';}
  if(scheme==='sp_sources'){if(sec==='sp_attivo')return cl==='noncurrent'?'ss_permanent_uses':'ss_current_uses';if(n==='equity'||cl==='equity')return'ss_equity';return cl==='noncurrent'?'ss_consolidated_sources':'ss_current_sources';}
  if(scheme==='sp_func'){if(sec==='sp_attivo'){if(n==='trade_receivable')return cl==='noncurrent'?'sg_op_noncurrent_assets':'sg_trade_receivables';if(n==='inventory')return'sg_inventory';if(n==='cash'||n==='financial'||n==='financial_nonoperating')return'sg_financial_assets';if(['operating','operating_other','tax_operating'].includes(n))return cl==='noncurrent'?'sg_op_noncurrent_assets':'sg_other_op_current_assets';return'sg_nonop_assets';}if(n==='equity')return'sg_equity';if(n==='trade_payable')return cl==='noncurrent'?'sg_op_noncurrent_liab':'sg_trade_payables';if(n==='financial')return'sg_financial_debt';if(['operating','operating_other','tax_operating'].includes(n))return cl==='noncurrent'?'sg_op_noncurrent_liab':'sg_other_op_current_liab';return'sg_nonop_liab';}
  if(scheme==='sp_pfn'){if(sec==='sp_attivo'){if(p==='cash'||p==='financial_asset')return'spfn_cash';if(['operating','operating_other','inventory','trade_receivable','tax_operating'].includes(n))return'spfn_operating_assets';return'spfn_nonop_assets';}if(n==='equity')return'spfn_equity';if(p==='debt')return'spfn_debt';if(['operating','operating_other','trade_payable','tax_operating'].includes(n))return'spfn_operating_liab';return'spfn_nonop_liab';}
  if(scheme==='ce_va'){if(c==='A1')return'cv_revenue';if(c==='A2'||c==='A3')return'cv_inventory_products';if(c==='A4')return'cv_internal_work';if(/^A5/.test(c))return'cv_other_revenue';if(c==='B6'||c==='B11')return'cv_materials';if(c==='B7')return'cv_services';if(c==='B8')return'cv_leases';if(/^B9/.test(c))return'cv_personnel';if(/^B10/.test(c))return'cv_da';if(c==='B12'||c==='B13')return'cv_provisions';if(c==='B14')return'cv_other_costs';if(/^C/.test(c))return'cv_financial';if(/^D/.test(c))return'cv_revaluations';if(/^20/.test(c))return'cv_taxes';return'cv_other';}
  if(scheme==='ce_ebitda'){if(/^A/.test(c))return'ce_prod';if(/^(B6|B7|B8|B11|B14)/.test(c))return'ce_external';if(/^B9/.test(c))return'ce_personnel';if(/^(B10|B12|B13)/.test(c))return'ce_da_prov';if(/^C|^D/.test(c))return'ce_financial';if(/^20/.test(c))return'ce_taxes';return'ce_other';}
  if(scheme==='ce_cogs'){if(c==='A1')return'cg_revenue';if(c==='A2'||c==='A3')return'cg_inventory_products';if(c==='A4')return'cg_internal_work';if(/^A/.test(c))return'cg_other_revenue';if(/^B10/.test(c)&&/ammort|svalut/.test(d)&&/impiant|stabil|produz|macchin/.test(d))return'cg_prod_da';if(/^(B10|B12|B13)/.test(c))return'cg_da_prov';if(/^C|^D/.test(c))return'cg_financial';if(/^20/.test(c))return'cg_taxes';return{production_direct:'cg_prod_direct',production_indirect:'cg_prod_indirect',logistics:'cg_logistics',selling:'cg_selling',ga:'cg_ga',rd:'cg_rd',other:'cg_other_operating'}[attrs.function]||'cg_other_operating';}
  if(scheme==='ce_contrib'){if(/^A/.test(c))return'cc_revenue';if(/^(B10|B12|B13)/.test(c))return'cc_da_prov';if(/^C|^D/.test(c))return'cc_financial';if(/^20/.test(c))return'cc_taxes';return{variable:'cc_variable',fixed_specific:'cc_fixed_specific',fixed_common:'cc_fixed_common'}[attrs.behavior]||'cc_fixed_common';}
  if(scheme==='ce_areas'){if(/^A/.test(c))return'ca_operating_revenue';if(/^B/.test(c))return'ca_operating_costs';if(/^C/.test(c))return'ca_financial';if(/^D/.test(c))return'ca_revaluations';if(/^20/.test(c))return'ca_taxes';return'ca_other';}
  if(scheme==='ce_adjusted'){if(/^A/.test(c))return'cad_operating_revenue';if(/^(B10|B12|B13)/.test(c))return'cad_below_ebitda';if(/^B/.test(c))return'cad_operating_costs';if(/^C|^D/.test(c))return'cad_financial';if(/^20/.test(c))return'cad_taxes';return'cad_operating_costs';}
  return TARGETS[scheme][0];
}
function allocations(scheme,group,accounts=STATE.accounts,field='current'){const saved=STATE.reclassMap[scheme]?.[group.key];if(accounts===STATE.accounts&&saved?.length)return saved.map(row=>({id:row.id,target:row.target,value:finite(row[field])}));let base=saved;if(!base){const attrs=attrsFor(group.accounts[0]);if(scheme==='ce_contrib'&&attrs.behavior==='mixed'){const share=Math.max(0,Math.min(100,finite(attrs.variablePct,50)))/100,total=groupAmount(group,field);return[{id:'a1',target:'cc_mixed_variable',value:total*share},{id:'a2',target:'cc_mixed_fixed',value:total*(1-share)}];}return[{id:'a1',target:defaultTarget(scheme,group),value:groupAmount(group,field)}];}
  const main=groupsFor(STATE.accounts,group.accounts[0].type).find(item=>item.key===group.key),mainTotal=main?groupAmount(main,field):0,den=Math.abs(mainTotal)>1e-9?mainTotal:(main?groupAmount(main,'current'):0),total=groupAmount(group,field);return base.map((row,index)=>({id:row.id,target:row.target,value:Math.abs(den)<1e-9?(index?0:total):total*(finite(row[field]??row.current)/den)}));}
function schemeAggregate(scheme,accounts=STATE.accounts,field='current'){const output=Object.fromEntries(TARGETS[scheme].map(key=>[key,0])),type=scheme.startsWith('sp_')?'SP':'CE';for(const group of groupsFor(accounts,type))for(const row of allocations(scheme,group,accounts,field))output[row.target]=finite(output[row.target])+finite(row.value);return output;}
function civilisticCe(accounts,field,allowCustom){const sum=regex=>accounts.filter(a=>a.type==='CE'&&regex.test(token(a.iv))).reduce((n,a)=>n+finite(a[field]),0);let out={rev:-sum(/^A1$/),a2:-sum(/^A2$/),a3:-sum(/^A3$/),a4:-sum(/^A4$/),a5:-sum(/^A5/),b6:sum(/^B6$/),b7:sum(/^B7$/),b8:sum(/^B8$/),b9:sum(/^B9/),b10:sum(/^B10/),b10Fixed:sum(/^B10(A|B|C)$/),b10Receivables:sum(/^B10D$/),b11:sum(/^B11$/),b12:sum(/^B12$/),b13:sum(/^B13$/),b14:sum(/^B14$/),financial:-sum(/^C/),interestExpense:sum(/^C17(A|B|C|D|E)$/),revaluations:-sum(/^DCE$/),taxContribution:-sum(/^20/)};if(allowCustom&&STATE.reclassMap.ce_va&&Object.keys(STATE.reclassMap.ce_va).length){const g=schemeAggregate('ce_va',accounts,field);Object.assign(out,{rev:g.cv_revenue,a2:g.cv_inventory_products,a3:0,a4:g.cv_internal_work,a5:g.cv_other_revenue,b6:-g.cv_materials,b11:0,b7:-g.cv_services,b8:-g.cv_leases,b14:-g.cv_other_costs,b9:-g.cv_personnel,b10:-g.cv_da,b12:-g.cv_provisions,b13:0,financial:g.cv_financial,revaluations:g.cv_revaluations,taxContribution:g.cv_taxes});}return Object.fromEntries(CE_FIELDS.map(key=>[key,finite(out[key])]));}
function civilisticSp(accounts,field,allowCustom){const out=Object.fromEntries(SP_FIELDS.map(key=>[key,0]));for(const account of accounts.filter(a=>a.type==='SP')){const amount=contractAmount(account,field),sec=sectionFor(account),attrs=attrsFor(account),cl=attrs.currentClass,n=attrs.nature,p=attrs.pfn;if(sec==='sp_attivo')out.totalAssets+=amount;else out.totalSources+=amount;if(n==='equity')out.equity+=amount;if(sec==='sp_attivo'){if(cl==='current')out.currentAssets+=amount;else if(cl==='noncurrent')out.nonCurrentAssets+=amount;if(n==='inventory')out.inventory+=amount;if(n==='cash')out.cash+=amount;if(n==='trade_receivable'){out.tradeReceivablesTotal+=amount;if(cl==='current')out.tradeReceivables+=amount;else if(cl==='noncurrent')out.tradeReceivablesNonCurrent+=amount;}const operating=['operating','operating_other','inventory','trade_receivable','tax_operating'].includes(n);if(operating){if(cl==='current')out.opCurrentAssets+=amount;else if(cl==='noncurrent')out.opNonCurrentAssets+=amount;}if(p==='cash'||p==='financial_asset'){out.pfnCash+=amount;if(p==='financial_asset')out.financialAssets+=amount;}if(!operating&&!['cash','financial_asset'].includes(p))out.nonOpAssets+=amount;}else{if(n!=='equity'){if(cl==='current')out.currentLiab+=amount;else if(cl==='noncurrent')out.nonCurrentLiab+=amount;}if(n==='trade_payable'){out.tradePayablesTotal+=amount;if(cl==='current')out.tradePayables+=amount;else if(cl==='noncurrent')out.tradePayablesNonCurrent+=amount;}const operating=['operating','operating_other','trade_payable','tax_operating'].includes(n);if(operating){if(cl==='current')out.opCurrentLiab+=amount;else if(cl==='noncurrent')out.opNonCurrentLiab+=amount;}if(p==='debt')out.pfnDebt+=amount;if(n!=='equity'&&!operating&&p!=='debt')out.nonOpLiab+=amount;}}
 if(allowCustom){if(STATE.reclassMap.sp_fin&&Object.keys(STATE.reclassMap.sp_fin).length){const g=schemeAggregate('sp_fin',accounts,field);Object.assign(out,{nonCurrentAssets:g.sf_noncurrent_assets,currentAssets:g.sf_current_assets,equity:g.sf_equity,nonCurrentLiab:g.sf_noncurrent_liab,currentLiab:g.sf_current_liab});}if(STATE.reclassMap.sp_func&&Object.keys(STATE.reclassMap.sp_func).length){const g=schemeAggregate('sp_func',accounts,field);Object.assign(out,{tradeReceivables:g.sg_trade_receivables,inventory:g.sg_inventory,opCurrentAssets:g.sg_trade_receivables+g.sg_inventory+g.sg_other_op_current_assets,tradePayables:g.sg_trade_payables,opCurrentLiab:g.sg_trade_payables+g.sg_other_op_current_liab,opNonCurrentAssets:g.sg_op_noncurrent_assets,opNonCurrentLiab:g.sg_op_noncurrent_liab,nonOpAssets:g.sg_financial_assets+g.sg_nonop_assets,nonOpLiab:g.sg_financial_debt+g.sg_nonop_liab});}if(STATE.reclassMap.sp_pfn&&Object.keys(STATE.reclassMap.sp_pfn).length){const g=schemeAggregate('sp_pfn',accounts,field);Object.assign(out,{pfnDebt:g.spfn_debt,pfnCash:g.spfn_cash,equity:g.spfn_equity});}}
 return Object.fromEntries(SP_FIELDS.map(key=>[key,finite(out[key])]));}
function contractPeriod(accounts,field,selected,{sp=true,custom=false}={}){return{ce:civilisticCe(accounts,field,custom),...(sp?{sp:civilisticSp(accounts,field,custom)}:{}),schemes:Object.fromEntries(selected.map(scheme=>[scheme,schemeAggregate(scheme,accounts,field)]))};}
function centerAccounts(name){return STATE.centers.filter(row=>row.center===name).map(row=>{const source=STATE.accounts.find(a=>a.type==='CE'&&a.code===row.code);return source?{...source,current:finite(row.current),previous:finite(row.previous)}:null;}).filter(Boolean);}
function adjustmentTotal(field){return STATE.adjustments.reduce((sum,row)=>sum+finite(field==='previous'?(row.previousEffect??row.previous):(row.currentEffect??row.effect)),0);}
function taxSocialDebtAggregate(accounts=STATE.accounts,field='current'){return accounts.filter(account=>account.type==='SP'&&sectionFor(account)==='sp_passivo'&&attrsFor(account).nature==='tax_operating').reduce((sum,account)=>sum+contractAmount(account,field),0);}
function historySlots(){const slots=new Map(),put=(year,accounts,field,priority)=>{if(!year||!Array.isArray(accounts)||!accounts.length)return;const previous=slots.get(year);if(!previous||priority>previous.priority)slots.set(year,{year,accounts,field,priority});};for(const item of STATE.history){prepareAccounts(item.accounts||[]);put(item.year,item.accounts,'current',3);if(item.periods?.previous?.available)put(Number(item.year)-1,item.accounts,'previous',1);}if(STATE.loaded){put(STATE.company.yearCurrent,STATE.accounts,'current',4);if(STATE.periods.previous.available)put(STATE.company.yearPrevious,STATE.accounts,'previous',2);}return Array.from(slots.values()).sort((a,b)=>a.year-b.year).slice(-5);}
function validBenchmark(){const seen=new Set(),rows=[];for(const row of STATE.benchmark){const code=String(row.code||'');if(seen.has(code)||!KPI_CODES.includes(code))continue;seen.add(code);const q1=optional(row.q1),median=optional(row.median),q3=optional(row.q3);if(q1==null||median==null||q3==null||!(q1<median&&median<q3))continue;rows.push({kpi:code,unit:KPI_META[code][2],q1,median,q3});}return rows.sort((a,b)=>a.kpi.localeCompare(b.kpi));}
function buildPayload(){if(!STATE.loaded)throw new Error('not_loaded');const selected=SCHEMES.filter(name=>STATE.selected.has(name));if(!selected.length)throw new Error('no_schemes');const assumptions=Object.fromEntries(ASSUMPTION_FIELDS.map(key=>[key,null]));const aliases={employeesCurrent:'employeesCurrent',cashFlowDebtService:'cashFlowDebtService',debtService:'debtService',purchasesCurrent:'purchasesCurrent',vatSalesPct:'vatSalesPct',vatPurchasesPct:'vatPurchasesPct',interestCoverageExpense:'interestCoverageExpense',dscrHorizonMonths:'dscrHorizonMonths',cfOtherOperating:'cfOtherOperating',cfInterestPaid:'cfInterestPaid',cfTaxPaid:'cfTaxPaid',cfCapex:'cfCapex',cfDisposals:'cfDisposals',cfOtherInvesting:'cfOtherInvesting',cfCapital:'cfCapital',cfDividends:'cfDividends',cfOtherFinancing:'cfOtherFinancing',cfOtherUnreconstructed:'cfOtherUnreconstructed'};for(const [target,source] of Object.entries(aliases))assumptions[target]=optional(STATE.extra[source]);assumptions.taxSocialDebt=taxSocialDebtAggregate();const newDebt=optional(STATE.extra.cfNewDebt),repayment=optional(STATE.extra.cfDebtRepayment);assumptions.cfDebtFlow=newDebt==null&&repayment==null?null:Math.abs(newDebt||0)-Math.abs(repayment||0);for(const [target,source] of [['overdueTax','adequacyOverdueTax'],['overdueSocial','adequacyOverdueSocial'],['overdueSuppliers','adequacyOverdueSuppliers'],['overdueEmployees','adequacyOverdueEmployees'],['overdueBanks','adequacyOverdueBanks']])assumptions[target]=optional(STATE.extra[source]);assumptions.useAdjustedEbitda=STATE.extra.useAdjustedEbitda===true||STATE.extra.useAdjustedEbitda==='true';const scenarioSelected=selected.includes('ce_va')?['ce_va']:[],names=Array.from(new Set(STATE.centers.map(row=>row.center))).sort(),history=historySlots();return{version:1,sourceSchema:['abbrev','ordinary'].includes(STATE.company.schema)?STATE.company.schema:null,comparative:{present:!!STATE.periods.previous.available,days:Math.max(1,Math.min(3660,Math.round(finite(STATE.company.days,365))))},selected,periods:{current:contractPeriod(STATE.accounts,'current',selected,{custom:true}),previous:contractPeriod(STATE.accounts,'previous',selected,{custom:true})},adjustments:{current:adjustmentTotal('current'),previous:adjustmentTotal('previous')},assumptions,quality:{unresolved:Object.fromEntries(UNRESOLVED.map(key=>[key,unresolved(key)])),importErrors:STATE.diagnostics.some(row=>row.level==='error'),aixPending:STATE.accounts.some(row=>row.technicalResult&&row.resultStatus!=='confirmed')},scenarios:Object.fromEntries(['budget','forecast'].map(kind=>[kind,STATE.scenarios[kind]?.length?contractPeriod(STATE.scenarios[kind],'current',scenarioSelected,{sp:false,custom:true}):null])),centers:names.map((name,slot)=>({slot,period:contractPeriod(centerAccounts(name),'current',[],{sp:false})})),history:history.map((item,slot)=>({slot,period:contractPeriod(item.accounts,item.field,[],{custom:false})})),benchmark:validBenchmark()};}

function localBlockers(){const blockers=[];if(!STATE.loaded)blockers.push({code:'not_loaded',message:'Carica un bilancio.'});if(!STATE.company.schema)blockers.push({code:'schema_required',message:'Seleziona lo schema di origine.'});const errors=STATE.diagnostics.filter(row=>row.level==='error');if(errors.length)blockers.push({code:'import_errors',message:`Correggi ${errors.length} errori nel file importato.`});if((STATE.extra.aiFindings||[]).some(row=>row.blocking&&!row.closed))blockers.push({code:'ai_blocking',message:'Chiudi le verifiche AI bloccanti.'});for(const scheme of STATE.selected){for(const group of groupsFor(STATE.accounts,scheme.startsWith('sp_')?'SP':'CE')){const total=groupAmount(group,'current'),allocated=allocations(scheme,group).reduce((sum,row)=>sum+row.value,0);if(Math.abs(total-allocated)>.01){blockers.push({code:'mapping_unbalanced',message:'Completa la ripartizione delle mappature.'});return blockers;}}}return blockers;}
function isValidResult(value,selected){if(!value||typeof value!=='object'||Array.isArray(value)||value.contractVersion!==1)return false;if(!value.core?.current?.ce||!value.core?.current?.sp||!value.core?.previous?.ce||!value.core?.previous?.sp)return false;if(!Array.isArray(value.reclassifications)||value.reclassifications.length!==selected.length)return false;if(!Array.isArray(value.kpis)||value.kpis.length!==42||new Set(value.kpis.map(row=>row.code)).size!==42)return false;if(!value.cashFlow||!value.adequacy||!value.dupont||!value.benchmark||!value.bridge||!value.scenarios||!Array.isArray(value.centers)||!Array.isArray(value.history)||!value.gate||typeof value.gate.allowed!=='boolean')return false;let good=true;const visit=item=>{if(typeof item==='number'&&!Number.isFinite(item))good=false;else if(Array.isArray(item))item.forEach(visit);else if(item&&typeof item==='object')Object.values(item).forEach(visit);};visit(value);return good&&value.kpis.every(row=>KPI_CODES.includes(row.code)&&['green','yellow','orange','gray'].includes(row.status)&&Array.isArray(row.reasonCodes));}
function invalidate(code,message){ANALYSIS.status='error';ANALYSIS.result=null;ANALYSIS.resultHash='';ANALYSIS.resultKey='';ANALYSIS.error={code,message};renderAll();}
function statusMessage(code){if(code==='timeout')return'Il servizio di calcolo non ha risposto in tempo.';if(code==='invalid_response'||code==='invalid_json')return'Il servizio ha restituito una risposta non valida.';if(/^http_/.test(code))return'Il servizio di calcolo non è disponibile.';if(code==='stale_response')return'La risposta ricevuta appartiene a uno stato precedente.';return'Impossibile completare il calcolo.';}
function schedule(force=false){ANALYSIS.generation++;const generation=ANALYSIS.generation;clearTimeout(transport.timer);if(!STATE.loaded){ANALYSIS.status='idle';ANALYSIS.result=null;ANALYSIS.resultHash='';ANALYSIS.resultKey='';renderAll();return;}let payload,json;try{payload=buildPayload();json=JSON.stringify(canonical(payload));}catch(error){invalidate(error.message,'Completa i dati richiesti prima del calcolo.');return;}if(!force&&ANALYSIS.status==='ready'&&ANALYSIS.resultKey===json){ANALYSIS.deduped++;return;}if(!force&&transport.inflight?.json===json){transport.inflight.generation=generation;ANALYSIS.deduped++;return;}if(!force&&transport.queued?.json===json){transport.queued.generation=generation;ANALYSIS.deduped++;return;}ANALYSIS.status='loading';ANALYSIS.result=null;ANALYSIS.resultHash='';ANALYSIS.resultKey='';ANALYSIS.error=null;renderAll();transport.timer=setTimeout(()=>prepareRequest(payload,json,generation,force),transport.debounceMs);}
async function prepareRequest(payload,json,generation,force){if(generation!==ANALYSIS.generation)return;const hash=await digest(payload);if(generation!==ANALYSIS.generation)return;if(!force&&transport.inflight?.hash===hash){transport.inflight.generation=generation;ANALYSIS.deduped++;return;}if(!force&&transport.queued?.hash===hash){transport.queued.generation=generation;ANALYSIS.deduped++;return;}const job={payload,json,hash,generation};if(transport.inflight){transport.queued=job;return;}sendRequest(job);}
async function sendRequest(job){transport.inflight=job;ANALYSIS.status='loading';ANALYSIS.payloadHash=job.hash;ANALYSIS.requests++;ANALYSIS.concurrent++;ANALYSIS.maxConcurrent=Math.max(ANALYSIS.maxConcurrent,ANALYSIS.concurrent);ANALYSIS.lastBytes=utf8Bytes(job.json);ANALYSIS.lastBreakdown=Object.fromEntries(Object.keys(job.payload).map(key=>[key,utf8Bytes(JSON.stringify(job.payload[key]))]));const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),transport.timeoutMs);transport.inflight.controller=controller;let code='';try{const response=await window.TAL_API.request(transport.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:job.json,cache:'no-store',credentials:'same-origin',signal:controller.signal});if(!response.ok)throw new Error('http_'+response.status);let result;try{result=await response.json();}catch(_){throw new Error('invalid_json');}if(!isValidResult(result,job.payload.selected)){ANALYSIS.invalidResponses++;throw new Error('invalid_response');}if(job.generation!==ANALYSIS.generation||transport.queued){ANALYSIS.staleResponses++;code='stale_response';}else{ANALYSIS.status='ready';ANALYSIS.result=result;ANALYSIS.resultHash=job.hash;ANALYSIS.resultKey=job.json;ANALYSIS.error=null;renderAll();window.dispatchEvent(new CustomEvent('fa-analysis-ready',{detail:{hash:job.hash}}));}}
 catch(error){window.TAL_API.invalidate();code=error?.name==='AbortError'?'timeout':String(error?.message||'network_error');if(job.generation===ANALYSIS.generation&&!transport.queued)invalidate(code,statusMessage(code));}
 finally{clearTimeout(timeout);ANALYSIS.concurrent=Math.max(0,ANALYSIS.concurrent-1);transport.inflight=null;const next=transport.queued;transport.queued=null;if(next)sendRequest(next);else if(code==='stale_response'&&job.generation===ANALYSIS.generation)invalidate(code,statusMessage(code));}}
function retryAnalysis(){schedule(true);}
function resultReady(){return ANALYSIS.status==='ready'&&ANALYSIS.result&&ANALYSIS.resultHash===ANALYSIS.payloadHash&&ANALYSIS.resultKey===JSON.stringify(canonical(buildPayload()));}
function exportGate(){const local=localBlockers();if(local.length){toast(local[0].message,true);return false;}if(!resultReady()){toast(ANALYSIS.error?.message||'Attendi un risultato valido del servizio.',true);return false;}if(!ANALYSIS.result.gate.allowed){toast('Export bloccato dai controlli analitici: '+(ANALYSIS.result.gate.blocking||[]).join(', '),true);return false;}return true;}

const NAV=[['Configurazione',[['archive','Clienti'],['import','Importa da Excel'],['setup','Anagrafica'],['schemes','Schemi'],['mapping','Mappatura'],['exceptions','Eccezioni']]],["Analisi",[['executive','Dashboard'],['reclass','Riclassificazioni'],['kpi','KPI'],['cashflow','Cash flow'],['adequacy','Adeguati assetti'],['dupont','DuPont'],['bridge','Bridge'],['planning','Budget e forecast'],['centers','Centri di costo'],['benchmark','Benchmark'],['history','Storico'],['adjust','Rettifiche']]],["Risultati e dati",[['reportcenter','Report Center'],['method','Metodologia']]]];
function installAdvancedViews(){const main=document.querySelector('.app-main main');if(!main||q('view-mapping'))return;main.insertAdjacentHTML('beforeend',`
<section class="fs-view" id="view-mapping"><span class="step-label">Configurazione</span><h2 class="page-title">Mappatura analitica</h2><p class="page-lead">Codici, descrizioni, split e destinazioni restano nel browser. Al servizio arrivano soltanto i totali tecnici per enum.</p><div class="rule"></div><div class="panel"><div class="field"><label for="mapping-method">Metodologia</label><select id="mapping-method" onchange="setMappingScheme(this.value)"></select></div><div class="checks-grid" id="mapping-summary" style="margin-top:15px"></div></div><div id="mapping-content"></div></section>
<section class="fs-view" id="view-executive"><span class="step-label">Analisi</span><h2 class="page-title">Dashboard</h2><div class="rule"></div><div id="executive-content"></div></section>
<section class="fs-view" id="view-cashflow"><span class="step-label">Analisi</span><h2 class="page-title">Cash flow gestionale</h2><p class="page-lead">Il prospetto è calcolato dal servizio; gli input documentali restano nel browser.</p><div class="rule"></div><div class="panel"><div class="grid g3">${[['cf-interest-paid','Interessi pagati'],['cf-tax-paid','Imposte pagate'],['cf-other-operating','Altri flussi operativi'],['cf-capex','Investimenti'],['cf-disposals','Dismissioni'],['cf-other-investing','Altri flussi di investimento'],['cf-new-debt','Nuovi finanziamenti'],['cf-debt-repayment','Rimborsi finanziamenti'],['cf-capital','Apporti di capitale'],['cf-dividends','Dividendi'],['cf-other-financing','Altri flussi finanziari'],['cf-other-unreconstructed','Altri movimenti documentati']].map(x=>`<div class="field"><label for="${x[0]}">${x[1]}</label><input id="${x[0]}" type="number" step="0.01"></div>`).join('')}</div><div class="btn-row"><button class="btn" onclick="saveCashFlowInputs()">Ricalcola</button><button class="btn ghost" onclick="clearCashFlowInputs()">Azzera input</button><button class="btn secondary" onclick="exportCashFlowExcel()">Excel</button><button class="btn secondary" onclick="printCashFlowReport()">PDF</button></div></div><div id="cashflow-content"></div></section>
<section class="fs-view" id="view-adequacy"><span class="step-label">Analisi</span><h2 class="page-title">Adeguati assetti e DSCR</h2><div class="rule"></div><div class="panel"><div class="grid g3">${[['ad-overdue-tax','Debiti tributari scaduti'],['ad-overdue-social','Debiti previdenziali scaduti'],['ad-overdue-suppliers','Debiti fornitori scaduti'],['ad-overdue-employees','Retribuzioni scadute'],['ad-overdue-banks','Rate finanziarie scadute']].map(x=>`<div class="field"><label for="${x[0]}">${x[1]}</label><input id="${x[0]}" type="number" min="0" step="0.01"></div>`).join('')}</div><div class="btn-row"><button class="btn" onclick="saveAdequacyInputs()">Ricalcola</button><button class="btn secondary" onclick="exportAdequacyExcel()">Excel</button><button class="btn secondary" onclick="printAdequacyReport()">PDF</button></div></div><div id="adequacy-content"></div></section>
<section class="fs-view" id="view-dupont"><span class="step-label">Analisi</span><h2 class="page-title">Analisi DuPont</h2><div class="rule"></div><div id="dupont-content"></div></section>
<section class="fs-view" id="view-bridge"><span class="step-label">Analisi</span><h2 class="page-title">Bridge corrente / comparativo</h2><div class="rule"></div><div id="bridge-content"></div></section>
<section class="fs-view" id="view-history"><span class="step-label">Analisi</span><h2 class="page-title">Storico</h2><div class="rule"></div><div class="panel"><label class="upload-zone"><span class="upload-icon">H</span><span><b>Carica un esercizio storico</b><span>Template Financial Statement</span></span><input accept=".xlsx,.xls" onchange="importHistory(event)" type="file"></label><div class="btn-row"><button class="btn ghost" onclick="clearHistory()">Azzera storico</button><button class="btn secondary" onclick="exportHistoryExcel()">Excel</button></div></div><div id="history-content"></div></section>
<section class="fs-view" id="view-reportcenter"><span class="step-label">Risultati</span><h2 class="page-title">Report Center</h2><div class="rule"></div><div id="reportcenter-content"></div><div class="btn-row"><button class="btn" onclick="exportAdvancedExcel()">Report Excel</button><button class="btn secondary" onclick="printAdvancedReport()">Report PDF</button></div></section>`);}
function renderNav(){const host=q('workspace-nav');if(!host)return;host.innerHTML=NAV.map(([title,items])=>`<div class="sb-cap sb-groupcap">${esc(title)}</div>${items.map(([key,label],index)=>`<button class="fs-link" type="button" data-view="${key}" onclick="setView('${key}')"><span class="ws-ic">${index+1}</span><span>${esc(label)}</span></button>`).join('')}`).join('');}
function setSidebar(open){q('sidebar')?.classList.toggle('open',open);q('sb-backdrop')?.classList.toggle('show',open);document.body.classList.toggle('sidebar-open',open);q('sb-toggle')?.setAttribute('aria-expanded',String(open));}
function setSiteNav(open){const header=document.querySelector('.tal-global-header'),button=q('talGhMenuToggle');header?.classList.toggle('tal-menu-open',open);button?.setAttribute('aria-expanded',String(open));button?.setAttribute('aria-label',open?'Chiudi la navigazione del sito':'Apri la navigazione del sito');}
function setView(key){if(['executive','reclass','kpi','cashflow','adequacy','dupont','bridge','planning','centers','benchmark','history','reportcenter'].includes(key)&&!STATE.company.schema){toast('Seleziona prima lo schema di origine.',true);key='setup';}document.querySelectorAll('.fs-view').forEach(el=>el.classList.toggle('active',el.id==='view-'+key));document.querySelectorAll('.fs-link').forEach(el=>el.classList.toggle('active',el.dataset.view===key));history.replaceState(null,'','#/'+key);setSidebar(false);window.scrollTo({top:0});}
function servicePanel(){if(ANALYSIS.status==='loading')return'<div class="callout" role="status">Calcolo in corso sul servizio sicuro…</div>';if(ANALYSIS.status==='error')return`<div class="callout bad" role="alert"><b>Calcolo non disponibile.</b> ${esc(ANALYSIS.error?.message||'Riprova.')} <button class="btn tiny" onclick="retryAnalysis()">Riprova</button></div>`;if(!STATE.loaded)return'<div class="empty-state"><h3>Nessun bilancio elaborato</h3><p>Importa un file o usa i dati dimostrativi.</p></div>';return'';}
function renderReclass(){const host=q('reclass-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}host.innerHTML=ANALYSIS.result.reclassifications.map(model=>`<section class="reclass-section"><div class="reclass-head"><h2>${esc(SCHEME_META[model.scheme]?.[0]||model.scheme)}</h2></div><div class="table-scroll"><table class="xr"><thead><tr><th>Voce</th><th class="r">${esc(STATE.company.yearCurrent)}</th><th class="r">${STATE.periods.previous.available?esc(STATE.company.yearPrevious):'N/D'}</th></tr></thead><tbody>${model.rows.map(row=>`<tr class="${row.kind==='grand'?'xr-grand':row.kind==='sub'?'xr-sub':row.kind==='alert'?'xr-alert':''}"><td>${esc(ROW_LABELS[row.code]||TARGET_LABELS[row.target]||row.code)}${row.target?drilldown(model.scheme,row.target):''}</td><td class="r">${money(row.current)}</td><td class="r">${STATE.periods.previous.available?money(row.previous):'—'}</td></tr>`).join('')}</tbody></table></div></section>`).join('');}
function drilldown(scheme,target){const rows=[];for(const group of groupsFor(STATE.accounts,scheme.startsWith('sp_')?'SP':'CE'))for(const allocation of allocations(scheme,group))if(allocation.target===target)rows.push(`<li><span class="cell-code">${esc(group.accounts[0].code)}</span> ${esc(group.accounts[0].desc)} — ${money(allocation.value)}</li>`);return rows.length?`<details class="account-drill"><summary>Dettaglio conti (${rows.length})</summary><ul>${rows.join('')}</ul></details>`:'';}
function renderKpis(){const host=q('kpi-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();q('kpi-summary').innerHTML='';return;}const result=ANALYSIS.result;q('kpi-summary').innerHTML=`<div class="summary-bar"><span class="item"><span class="label">KPI</span><span class="value">42</span></span><span class="item"><span class="label">Benchmark</span><span class="value">${result.benchmark.score==null?'—':fmt(result.benchmark.score,0)+'/100'}</span></span></div>`;host.innerHTML=`<div class="kpi-grid">${result.kpis.map(item=>{const meta=KPI_META[item.code]||[item.code,'Altro',''];return`<article class="kpi-card ${item.status}"><span class="kpi-family">${esc(meta[1])}</span><h3>${esc(meta[0])}</h3><div class="kpi-value">${displayKpi(item)}</div><p class="kpi-note">${esc((item.reasonCodes||[]).map(code=>REASON_LABELS[code]||code).join(' · ')||'Dato disponibile')}</p></article>`;}).join('')}</div>`;}
function tablePanel(title,rows){return`<section class="reclass-section"><div class="reclass-head"><h2>${esc(title)}</h2></div><div class="table-scroll"><table class="xr"><tbody>${rows.map(row=>`<tr class="${row[2]||''}"><td>${esc(row[0])}</td><td class="r">${row[1]}</td></tr>`).join('')}</tbody></table></div></section>`;}
function renderExecutive(){const host=q('executive-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}const {ce,sp}=ANALYSIS.result.core.current,gate=ANALYSIS.result.gate;host.innerHTML=`<div class="checks-grid"><article class="check-item ${gate.allowed?'ok':'fail'}"><span class="name">Esito analitico</span><span class="value">${gate.allowed?'Pronto':'Da verificare'}</span><span class="desc">${esc((gate.blocking||[]).join(', ')||'Controlli backend superati')}</span></article><article class="check-item"><span class="name">Ricavi</span><span class="value">${money(ce.rev)}</span></article><article class="check-item"><span class="name">EBITDA</span><span class="value">${money(ce.ebitda)}</span></article><article class="check-item"><span class="name">EBIT</span><span class="value">${money(ce.ebit)}</span></article><article class="check-item"><span class="name">Risultato netto</span><span class="value">${money(ce.net)}</span></article><article class="check-item"><span class="name">PFN</span><span class="value">${money(sp.pfn)}</span></article></div>`;}
function renderCash(){const host=q('cashflow-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}const m=ANALYSIS.result.cashFlow;if(!m.available){host.innerHTML='<div class="callout warn">Cash flow non disponibile senza comparativo.</div>';return;}const labels={openingCash:'Disponibilità liquide iniziali',cfo:'Flusso operativo',cfi:'Flusso di investimento',cff:'Flusso finanziario',calculatedChange:'Variazione calcolata',actualChange:'Variazione effettiva',residual:'Differenza residua',closingCash:'Disponibilità liquide finali'};host.innerHTML=tablePanel('Rendiconto gestionale',Object.entries(labels).map(([key,label])=>[label,money(m[key]),key==='residual'?'xr-grand':'']));}
function renderAdequacy(){const host=q('adequacy-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}const labels={equity:'Patrimonio netto',interest_sustainability:'Sostenibilità oneri finanziari',capital_adequacy:'Adeguatezza patrimoniale',liquidity:'Liquidità',tax_social_debt:'Debiti tributari e previdenziali',cash_return_assets:'Cash return on assets',cfo_assets:'CFO / Attivo',dscr:'DSCR',capital_loss_review:'Perdita del capitale'};host.innerHTML=tablePanel('Indicatori di adeguatezza',ANALYSIS.result.adequacy.metrics.map(row=>[labels[row.code]||row.code,row.value==null?'—':fmt(row.value,2),row.quality==='green'?'':'xr-sub']));}
function renderDupont(){const host=q('dupont-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}const m=ANALYSIS.result.dupont;if(!m.available){host.innerHTML='<div class="callout warn">Analisi non disponibile.</div>';return;}host.innerHTML=tablePanel('DuPont — esercizio corrente',Object.entries(m.current||{}).map(([key,value])=>[key,fmt(value,3)]));}
function renderBridge(){const host=q('bridge-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}const m=ANALYSIS.result.bridge;if(!m.available){host.innerHTML='<div class="callout warn">Bridge non disponibile senza comparativo.</div>';return;}host.innerHTML=tablePanel('Bridge EBITDA',m.ebitda.map((value,index)=>['Componente '+(index+1),money(value)]))+tablePanel('Bridge PFN',m.pfn.map((value,index)=>['Componente '+(index+1),money(value)]));}
function renderPlanning(){const host=q('planning-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}host.innerHTML=['budget','forecast'].map(kind=>tablePanel(kind==='budget'?'Budget':'Forecast',(ANALYSIS.result.scenarios[kind]||[]).map(row=>[(ROW_LABELS[row.code]||row.code),`${money(row.actual)} → ${money(row.scenario)}`]))).join('');}
function renderCenters(){const host=q('centers-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}const names=Array.from(new Set(STATE.centers.map(row=>row.center))).sort();host.innerHTML=ANALYSIS.result.centers.map(row=>tablePanel(names[row.slot]||`Centro ${row.slot+1}`,[['Ricavi',money(row.ce.rev)],['Valore aggiunto',money(row.ce.valueAdded)],['EBITDA',money(row.ce.ebitda)],['EBIT',money(row.ce.ebit)]])).join('')||'<div class="empty-state"><h3>Nessun centro caricato</h3></div>';}
function renderHistory(){const host=q('history-content');if(!host)return;if(!resultReady()){host.innerHTML=servicePanel();return;}const slots=historySlots();host.innerHTML=tablePanel('Serie storica',ANALYSIS.result.history.map((row,index)=>[String(slots[index]?.year||`Periodo ${index+1}`),`Ricavi ${money(row.revenue)} · EBITDA ${money(row.ebitda)} · PFN ${money(row.pfn)}`])) ;}
function renderBenchmark(){const host=q('benchmark-content');if(!host)return;const invalid=STATE.benchmark.filter(row=>{const q1=optional(row.q1),m=optional(row.median),q3=optional(row.q3);return q1==null||m==null||q3==null||!(q1<m&&m<q3);});host.innerHTML=`<div class="checks-grid"><article class="check-item ${invalid.length?'warn':'ok'}"><span class="name">Benchmark validi</span><span class="value">${validBenchmark().length}</span><span class="desc">${invalid.length?invalid.length+' righe incomplete/non ordinate':'Q1 < mediana < Q3'}</span></article></div>`;}
function renderReportCenter(){const host=q('reportcenter-content');if(!host)return;const local=localBlockers();if(!resultReady()){host.innerHTML=servicePanel()+tablePanel('Controlli locali',local.map(row=>[row.code,esc(row.message)]));return;}const backend=ANALYSIS.result.gate;host.innerHTML=`<div class="panel ${backend.allowed&&!local.length?'ok':''}"><span class="eyebrow">Esito immediato</span><h2>${backend.allowed&&!local.length?'Analisi pronta':'Da verificare'}</h2><p>Gate analitico backend: <b>${backend.allowed?'superato':'bloccato'}</b> · gate locale import/mapping: <b>${local.length?'bloccato':'superato'}</b></p></div>${tablePanel('Blocker',local.map(row=>[row.code,row.message]).concat((backend.blocking||[]).map(code=>[code,'Controllo analitico backend'])))}`;}
function renderMapping(){const host=q('mapping-content'),select=q('mapping-method');if(!host||!select)return;select.innerHTML=SCHEMES.map(name=>`<option value="${name}" ${STATE.mappingScheme===name?'selected':''}>${esc(SCHEME_META[name][0])}</option>`).join('');if(!STATE.loaded){host.innerHTML='<div class="empty-state"><h3>Nessun conto disponibile</h3></div>';return;}const scheme=STATE.mappingScheme,type=scheme.startsWith('sp_')?'SP':'CE',groups=groupsFor(STATE.accounts,type);q('mapping-summary').innerHTML=`<article class="check-item ok"><span class="name">Conti</span><span class="value">${groups.length}</span></article><article class="check-item"><span class="name">Split personalizzati</span><span class="value">${Object.keys(STATE.reclassMap[scheme]||{}).length}</span></article>`;host.innerHTML=groups.map(group=>{const rows=STATE.reclassMap[scheme]?.[group.key]||allocations(scheme,group).map(row=>({id:row.id,target:row.target,current:row.value,previous:allocations(scheme,group,STATE.accounts,'previous').find(x=>x.id===row.id)?.value||0}));return`<article class="mapping-account"><div class="mapping-source"><b><span class="cell-code">${esc(group.accounts[0].code)}</span> ${esc(group.accounts[0].desc)}</b><span>${money(groupAmount(group))}</span><button class="btn ghost tiny" onclick="splitAllocation('${scheme}','${encodeURIComponent(group.key)}')">Suddividi</button></div><div class="mapping-lines">${rows.map(row=>`<div class="mapping-line"><select onchange="updateAllocation('${scheme}','${encodeURIComponent(group.key)}','${row.id}','target',this.value)">${TARGETS[scheme].map(target=>`<option value="${target}" ${row.target===target?'selected':''}>${esc(TARGET_LABELS[target]||target)}</option>`).join('')}</select><input value="${round2(row.current)}" onchange="updateAllocation('${scheme}','${encodeURIComponent(group.key)}','${row.id}','current',this.value)"><input value="${round2(row.previous)}" onchange="updateAllocation('${scheme}','${encodeURIComponent(group.key)}','${row.id}','previous',this.value)"><button class="lk del" onclick="removeAllocation('${scheme}','${encodeURIComponent(group.key)}','${row.id}')">Rimuovi</button></div>`).join('')}</div><button class="lk" onclick="resetAccountMapping('${scheme}','${encodeURIComponent(group.key)}')">Ripristina proposta</button></article>`;}).join('');}
function renderExceptions(){const host=q('exception-list');if(!host)return;const rows=[];for(const account of STATE.accounts){const attrs=attrsFor(account);for(const key of UNRESOLVED)if(attrs[key]&&attrs[key+'Status']!=='confirmed')rows.push({account,key,value:attrs[key]});}q('exception-summary').innerHTML=`<div class="summary-bar"><span class="item"><span class="label">Decisioni aperte</span><span class="value">${rows.length}</span></span></div>`;host.innerHTML=rows.map(row=>`<div class="panel"><b>${esc(row.account.code)} · ${esc(row.account.desc)}</b><p>${esc(row.key)}: ${esc(row.value)}</p><button class="btn tiny" onclick="confirmDecision('${row.account.type}','${encodeURIComponent(row.account.code)}','${row.key}')">Conferma</button></div>`).join('')||'<div class="all-done">Nessuna decisione aperta.</div>';}
function renderDiagnostics(){q('import-status').innerHTML=STATE.loaded?`<div class="callout ok"><b>${STATE.accounts.length} conti caricati.</b> Il calcolo analitico è eseguito dal servizio senza inviare codici o descrizioni.</div>`:'';q('diagnostics-list').innerHTML=STATE.diagnostics.map(row=>`<div class="callout ${row.level==='error'?'bad':'warn'}">${esc(row.text)}</div>`).join('')||'<div class="callout ok">Nessuna anomalia di import.</div>';}
function renderSchemes(){q('scheme-grid').innerHTML=`<div class="scheme-grid">${SCHEMES.map(name=>`<label class="scheme-card"><input type="checkbox" value="${name}" ${STATE.selected.has(name)?'checked':''}><span><b>${esc(SCHEME_META[name][0])}</b><small>${esc(name)}</small></span></label>`).join('')}</div>`;}
function renderAdjustments(){q('adjust-content').innerHTML=STATE.adjustments.map((row,index)=>`<div class="panel"><b>${esc(row.description||row.category||'Rettifica')}</b><p>Corrente ${money(finite(row.currentEffect??row.effect))} · precedente ${money(finite(row.previousEffect))}</p><button class="lk del" onclick="deleteAdjustment(${index})">Rimuovi</button></div>`).join('')||'<div class="empty-state"><h3>Nessuna rettifica</h3></div>';}
function renderArchive(){const configs=loadArchiveData();q('archive-list').innerHTML=Object.entries(configs).map(([key,row])=>`<div class="saved-item"><span class="info"><b>${esc(row.company?.name||key)}</b><small>${esc(key)}</small></span><button class="lk" onclick="loadArchive('${encodeURIComponent(key)}')">Apri</button><button class="lk del" onclick="deleteConfig('${encodeURIComponent(key)}')">Elimina</button></div>`).join('')||'<div class="muted-empty">Nessuna configurazione salvata.</div>';}
function renderMethod(){q('method-content').innerHTML='<div class="method-grid"><article><h3>Confine di elaborazione</h3><p>File, identità, codici, descrizioni, mapping e drill-down restano nel browser. Il servizio riceve esclusivamente aggregati tecnici numerici necessari al calcolo, senza persistenza.</p></article><article><h3>Fonte dei risultati</h3><p>Riclassificazioni, KPI, cash flow, DSCR, DuPont, benchmark, bridge e gate analitico provengono esclusivamente dalla risposta backend.</p></article></div>';}
function renderContext(){q('fa-context').innerHTML=STATE.loaded?`<b>${esc(STATE.company.name||'Società senza denominazione')}</b>${esc(STATE.company.yearCurrent)}`:'<b>Nessuna società</b>Carica il bilancio per iniziare';}
function renderAll(){renderContext();renderNav();renderDiagnostics();renderSchemes();renderExceptions();renderMapping();renderReclass();renderKpis();renderExecutive();renderCash();renderAdequacy();renderDupont();renderBridge();renderPlanning();renderCenters();renderHistory();renderBenchmark();renderReportCenter();renderAdjustments();renderArchive();renderMethod();syncInputs();}
function updateAll(){renderAll();schedule(false);}

function syncInputs(){const map={an_name:STATE.company.name,an_schema:STATE.company.schema,an_vat:STATE.company.vat,an_cf:STATE.company.cf,an_currency:STATE.company.currency,an_from:STATE.company.periodFrom,an_to:STATE.company.periodTo,an_days:STATE.company.days,'kpi-ebitda-base':STATE.extra.useAdjustedEbitda?'adjusted':'reported','extra-emp-current':STATE.extra.employeesCurrent,'extra-emp-previous':STATE.extra.employeesPrevious,'extra-purchases':STATE.extra.purchasesCurrent,'extra-vat-sales':STATE.extra.vatSalesPct,'extra-vat-purchases':STATE.extra.vatPurchasesPct,'extra-cashflow':STATE.extra.cashFlowDebtService,'extra-debtservice':STATE.extra.debtService,'cf-interest-paid':STATE.extra.cfInterestPaid,'cf-tax-paid':STATE.extra.cfTaxPaid,'cf-other-operating':STATE.extra.cfOtherOperating,'cf-capex':STATE.extra.cfCapex,'cf-disposals':STATE.extra.cfDisposals,'cf-other-investing':STATE.extra.cfOtherInvesting,'cf-new-debt':STATE.extra.cfNewDebt,'cf-debt-repayment':STATE.extra.cfDebtRepayment,'cf-capital':STATE.extra.cfCapital,'cf-dividends':STATE.extra.cfDividends,'cf-other-financing':STATE.extra.cfOtherFinancing,'cf-other-unreconstructed':STATE.extra.cfOtherUnreconstructed,'ad-overdue-tax':STATE.extra.adequacyOverdueTax,'ad-overdue-social':STATE.extra.adequacyOverdueSocial,'ad-overdue-suppliers':STATE.extra.adequacyOverdueSuppliers,'ad-overdue-employees':STATE.extra.adequacyOverdueEmployees,'ad-overdue-banks':STATE.extra.adequacyOverdueBanks};for(const [id,value] of Object.entries(map)){const el=q(id);if(el&&document.activeElement!==el)el.value=value??'';}}
function saveCompany(){for(const [key,id] of [['name','an_name'],['schema','an_schema'],['vat','an_vat'],['cf','an_cf'],['currency','an_currency'],['periodFrom','an_from'],['periodTo','an_to']])STATE.company[key]=q(id)?.value||'';STATE.company.days=Math.max(1,finite(q('an_days')?.value,365));const year=STATE.company.periodTo?new Date(STATE.company.periodTo).getFullYear():STATE.company.yearCurrent;if(Number.isFinite(year)){STATE.company.yearCurrent=year;STATE.company.yearPrevious=year-1;}saveConfig(false);updateAll();toast('Configurazione salvata.');}
function importExcel(event,kind){
  const file=event.target.files?.[0];if(!file)return;
  if(['budget','forecast','centers'].includes(kind)&&!STATE.loaded){toast('Import annullato: caricare prima il bilancio.',true);return;}
  readWorkbook(file,wb=>importCandidate(wb,kind,file.name),()=>{if(kind==='main')setView('schemes');});
  event.target.value='';
}
function importMain(event){importExcel(event,'main');}
function importScenario(event,kind){if(['budget','forecast'].includes(kind))importExcel(event,kind);}
function importCenters(event){importExcel(event,'centers');}
function importBenchmark(event){importExcel(event,'benchmark');}
function importHistory(event){importExcel(event,'history');}
function clearHistory(){STATE.history=[];updateAll();}
function resetSession(){Object.assign(STATE,{accounts:[],attrs:{},reclassMap:{},diagnostics:[],loaded:false,periods:{current:{available:true},previous:{available:false}},scenarios:{budget:[],forecast:[]},centers:[],benchmark:[],history:[],adjustments:[],extra:{aiFindings:[]}});ANALYSIS.result=null;ANALYSIS.resultHash='';ANALYSIS.resultKey='';ANALYSIS.status='idle';renderAll();setView('archive');}
function applySchemes(){STATE.selected=new Set(Array.from(document.querySelectorAll('#scheme-grid input:checked')).map(el=>el.value));updateAll();setView('exceptions');}
function selectRecommended(){STATE.selected=new Set(DEFAULT_SCHEMES);renderSchemes();}
function selectAllSchemes(){STATE.selected=new Set(SCHEMES);renderSchemes();}
function clearSchemes(){STATE.selected=new Set();renderSchemes();}
function setMappingScheme(value){STATE.mappingScheme=value;renderMapping();}
function materialize(scheme,key){const decoded=decodeURIComponent(key),group=groupsFor(STATE.accounts,scheme.startsWith('sp_')?'SP':'CE').find(item=>item.key===decoded);if(!group)return null;STATE.reclassMap[scheme]??={};if(!STATE.reclassMap[scheme][decoded]){const cur=allocations(scheme,group,STATE.accounts,'current'),prev=allocations(scheme,group,STATE.accounts,'previous');STATE.reclassMap[scheme][decoded]=cur.map(row=>({id:row.id,target:row.target,current:row.value,previous:prev.find(x=>x.id===row.id)?.value||0}));}return STATE.reclassMap[scheme][decoded];}
function updateAllocation(scheme,key,id,prop,value){const rows=materialize(scheme,key),row=rows?.find(item=>item.id===id);if(!row)return;row[prop]=prop==='target'?value:parseNumber(value);updateAll();}
function splitAllocation(scheme,key){const rows=materialize(scheme,key);if(!rows)return;rows.push({id:'a'+Date.now().toString(36),target:rows[0].target,current:0,previous:0});updateAll();}
function removeAllocation(scheme,key,id){const decoded=decodeURIComponent(key),rows=materialize(scheme,key);if(!rows||rows.length<=1)return;STATE.reclassMap[scheme][decoded]=rows.filter(row=>row.id!==id);updateAll();}
function resetAccountMapping(scheme,key){const decoded=decodeURIComponent(key);if(STATE.reclassMap[scheme])delete STATE.reclassMap[scheme][decoded];updateAll();}
function resetSchemeMapping(scheme){delete STATE.reclassMap[scheme];updateAll();}
function confirmDecision(type,code,key){const account=STATE.accounts.find(row=>row.type===type&&row.code===decodeURIComponent(code));if(!account)return;attrsFor(account)[key+'Status']='confirmed';updateAll();}
function confirmGroup(key){STATE.accounts.forEach(account=>{const attrs=attrsFor(account);if(attrs[key])attrs[key+'Status']='confirmed';});updateAll();}
function setDecision(type,code,key,value){const account=STATE.accounts.find(row=>row.type===type&&row.code===decodeURIComponent(code));if(!account)return;const attrs=attrsFor(account);attrs[key]=value;attrs[key+'Status']='confirmed';updateAll();}
function setVariablePct(type,code,value){setDecision(type,code,'variablePct',Math.max(0,Math.min(100,parseNumber(value))));}
function addAdjustment(){const current=parseNumber(q('adj-amount-current')?.value),previous=parseNumber(q('adj-amount-previous')?.value),direction=parseNumber(q('adj-direction')?.value)||1;STATE.adjustments.push({description:q('adj-desc')?.value||'Rettifica gestionale',category:q('adj-category')?.value||'',note:q('adj-note')?.value||'',currentEffect:Math.abs(current)*direction,previousEffect:Math.abs(previous)*direction});updateAll();}
function deleteAdjustment(index){STATE.adjustments.splice(index,1);updateAll();}
function setAdjustedKpiMode(value){STATE.extra.useAdjustedEbitda=value==='adjusted';updateAll();}
function saveExtraKpi(){for(const [key,id] of [['employeesCurrent','extra-emp-current'],['employeesPrevious','extra-emp-previous'],['purchasesCurrent','extra-purchases'],['vatSalesPct','extra-vat-sales'],['vatPurchasesPct','extra-vat-purchases'],['cashFlowDebtService','extra-cashflow'],['debtService','extra-debtservice']])STATE.extra[key]=q(id)?.value??'';updateAll();}
function saveCashFlowInputs(){for(const [key,id] of [['cfInterestPaid','cf-interest-paid'],['cfTaxPaid','cf-tax-paid'],['cfOtherOperating','cf-other-operating'],['cfCapex','cf-capex'],['cfDisposals','cf-disposals'],['cfOtherInvesting','cf-other-investing'],['cfNewDebt','cf-new-debt'],['cfDebtRepayment','cf-debt-repayment'],['cfCapital','cf-capital'],['cfDividends','cf-dividends'],['cfOtherFinancing','cf-other-financing'],['cfOtherUnreconstructed','cf-other-unreconstructed']])STATE.extra[key]=q(id)?.value??'';updateAll();}
function clearCashFlowInputs(){['cfInterestPaid','cfTaxPaid','cfOtherOperating','cfCapex','cfDisposals','cfOtherInvesting','cfNewDebt','cfDebtRepayment','cfCapital','cfDividends','cfOtherFinancing','cfOtherUnreconstructed'].forEach(key=>STATE.extra[key]='');updateAll();}
function saveAdequacyInputs(){for(const [key,id] of [['adequacyOverdueTax','ad-overdue-tax'],['adequacyOverdueSocial','ad-overdue-social'],['adequacyOverdueSuppliers','ad-overdue-suppliers'],['adequacyOverdueEmployees','ad-overdue-employees'],['adequacyOverdueBanks','ad-overdue-banks']])STATE.extra[key]=q(id)?.value??'';updateAll();}
function setFirstYearMode(value){STATE.periods.previous.available=value!=='yes';updateAll();}

function downloadBlob(name,data,type='application/json'){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const ARCHIVE_KEY='tal_financial_analysis_configs_v3';
function configKey(){return(STATE.company.vat||STATE.company.cf||STATE.company.name||'configurazione').trim();}
function configSnapshot(){return{version:4,company:clone(STATE.company),accounts:clone(STATE.accounts),attrs:clone(STATE.attrs),selected:Array.from(STATE.selected),reclassMap:clone(STATE.reclassMap),adjustments:clone(STATE.adjustments),extra:clone(STATE.extra),periods:clone(STATE.periods),scenarios:clone(STATE.scenarios),scenarioMeta:clone(STATE.scenarioMeta),centers:clone(STATE.centers),centerCatalog:clone(STATE.centerCatalog),benchmark:clone(STATE.benchmark),history:clone(STATE.history),diagnostics:clone(STATE.diagnostics),files:clone(STATE.files),fileMeta:clone(STATE.fileMeta),loaded:STATE.loaded};}
function loadArchiveData(){try{return JSON.parse(localStorage.getItem(ARCHIVE_KEY)||'{}');}catch(_){return{};}}
function saveConfig(show=true){const key=configKey();if(!key)return;const all=loadArchiveData();all[key]=configSnapshot();localStorage.setItem(ARCHIVE_KEY,JSON.stringify(all));if(show)toast('Configurazione salvata nel browser.');renderArchive();}
function applyConfig(data){if(!data)return;STATE.company={...STATE.company,...data.company};STATE.accounts=clone(data.accounts||[]);STATE.attrs=clone(data.attrs||{});STATE.selected=new Set(data.selected||DEFAULT_SCHEMES);STATE.reclassMap=clone(data.reclassMap||{});STATE.adjustments=clone(data.adjustments||[]);STATE.extra={aiFindings:[],...(data.extra||{})};STATE.periods=clone(data.periods||STATE.periods);STATE.scenarios=clone(data.scenarios||{budget:[],forecast:[]});STATE.scenarioMeta=clone(data.scenarioMeta||{});STATE.centers=clone(data.centers||[]);STATE.centerCatalog=clone(data.centerCatalog||[]);STATE.benchmark=clone(data.benchmark||[]);STATE.history=clone(data.history||[]);STATE.diagnostics=clone(data.diagnostics||[]);STATE.files=clone(data.files||STATE.files);STATE.fileMeta=clone(data.fileMeta||{});STATE.loaded=!!(data.loaded||STATE.accounts.length);prepareAccounts(STATE.accounts);for(const kind of ['budget','forecast'])prepareAccounts(STATE.scenarios[kind]||[]);for(const item of STATE.history)prepareAccounts(item.accounts||[]);updateAll();}
function loadConfig(){applyConfig(loadArchiveData()[configKey()]);}
function loadArchive(key){applyConfig(loadArchiveData()[decodeURIComponent(key)]);setView('setup');}
function deleteConfig(key){const all=loadArchiveData();delete all[decodeURIComponent(key)];localStorage.setItem(ARCHIVE_KEY,JSON.stringify(all));renderArchive();}
function exportConfig(){downloadBlob(`Analisi_config_${configKey()}.json`,JSON.stringify(configSnapshot(),null,2));}
function importConfig(event){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{applyConfig(JSON.parse(reader.result));toast('Configurazione ripristinata.');}catch(_){toast('Backup non valido.',true);}};reader.readAsText(file);}
function exportAllConfigs(){downloadBlob('Analisi_backup_archivio.json',JSON.stringify(loadArchiveData(),null,2));}
function importAllConfigs(event){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);localStorage.setItem(ARCHIVE_KEY,JSON.stringify(data));renderArchive();toast('Archivio ripristinato.');}catch(_){toast('Backup non valido.',true);}};reader.readAsText(file);}

function workbookFor(parts=['summary','reclass','kpi','cash','adequacy','dupont','bridge','scenarios','centers','history']){const result=ANALYSIS.result,wb=XLSX.utils.book_new(),add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name.slice(0,31));if(parts.includes('summary'))add('Sintesi',[['ANALISI DI BILANCIO'],['Anno',STATE.company.yearCurrent],['Ricavi',result.core.current.ce.rev],['EBITDA',result.core.current.ce.ebitda],['EBIT',result.core.current.ce.ebit],['Risultato netto',result.core.current.ce.net],['PFN',result.core.current.sp.pfn],['Gate analitico',result.gate.allowed?'SUPERATO':'BLOCCATO']]);if(parts.includes('reclass'))for(const model of result.reclassifications)add(model.scheme,[['Voce','Corrente','Precedente'],...model.rows.map(row=>[ROW_LABELS[row.code]||TARGET_LABELS[row.target]||row.code,row.current,row.previous])]);if(parts.includes('kpi'))add('KPI',[['Codice','Indicatore','Valore','Stato','Reason code'],...result.kpis.map(row=>[row.code,KPI_META[row.code]?.[0]||row.code,row.value,row.status,(row.reasonCodes||[]).join(', ')])]);if(parts.includes('cash'))add('Cash flow',[['Voce','Valore'],...Object.entries(result.cashFlow).filter(([,value])=>typeof value==='number'||value===null).map(([key,value])=>[key,value])]);if(parts.includes('adequacy'))add('Adeguati assetti',[['Codice','Valore','Qualità','Segnale'],...result.adequacy.metrics.map(row=>[row.code,row.value,row.quality,row.signal])]);if(parts.includes('dupont'))add('DuPont',[['Fattore','Corrente','Precedente'],...Object.keys(result.dupont.current||{}).map(key=>[key,result.dupont.current[key],result.dupont.previous?.[key]??null])]);if(parts.includes('bridge'))add('Bridge',[['Sezione','Componente','Valore'],...(result.bridge.ebitda||[]).map((value,index)=>['EBITDA',index+1,value]),...(result.bridge.pfn||[]).map((value,index)=>['PFN',index+1,value])]);if(parts.includes('scenarios'))add('Scenari',[['Scenario','Voce','Actual','Scenario'],...Object.entries(result.scenarios).flatMap(([kind,rows])=>rows.map(row=>[kind,row.code,row.actual,row.scenario]))]);if(parts.includes('centers'))add('Centri',[['Slot','Ricavi','EBITDA','EBIT'],...result.centers.map(row=>[row.slot,row.ce.rev,row.ce.ebitda,row.ce.ebit])]);if(parts.includes('history'))add('Storico',[['Slot','Ricavi','EBITDA','EBIT','Risultato','PFN'],...result.history.map(row=>[row.slot,row.revenue,row.ebitda,row.ebit,row.net,row.pfn])]);return wb;}
async function writeWorkbookFile(wb,name){XLSX.writeFile(wb,name);return true;}
async function exportExcel(){if(!exportGate())return;await window.writeWorkbookFile(workbookFor(),`FinancialAnalysis_${STATE.company.yearCurrent}.xlsx`);}
async function exportKpiExcel(){if(!exportGate())return;await window.writeWorkbookFile(workbookFor(['kpi']),`KPI_${STATE.company.yearCurrent}.xlsx`);}
async function exportCashFlowExcel(){if(!exportGate())return;await window.writeWorkbookFile(workbookFor(['cash']),`CashFlow_${STATE.company.yearCurrent}.xlsx`);}
async function exportAdequacyExcel(){if(!exportGate())return;await window.writeWorkbookFile(workbookFor(['adequacy']),`AdeguatiAssetti_${STATE.company.yearCurrent}.xlsx`);}
async function exportHistoryExcel(){if(!exportGate())return;await window.writeWorkbookFile(workbookFor(['history']),`Storico_${STATE.company.yearCurrent}.xlsx`);}
async function exportAdvancedExcel(){if(!exportGate())return;await window.writeWorkbookFile(workbookFor(),`ReportAnalisi_${STATE.company.yearCurrent}.xlsx`);}
function pdfHtml(title,sections){return`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:15mm}body{font:11px Arial;color:#171717}h1{font-size:22px;margin:0 0 5mm}h2{font-size:14px;margin:7mm 0 2mm;border-bottom:2px solid #145368;padding-bottom:2mm}table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}th{background:#145368;color:white;text-align:left}th,td{padding:5px 7px;border-bottom:1px solid #ddd}td.r{text-align:right;font-variant-numeric:tabular-nums}.meta{color:#555;margin-bottom:8mm}</style></head><body><h1>${esc(title)}</h1><p class="meta">${esc(STATE.company.name||'Società')} · ${esc(STATE.company.yearCurrent)}</p>${sections}</body></html>`;}
function pdfTable(title,rows){return`<h2>${esc(title)}</h2><table><thead><tr><th>Voce</th><th>Corrente</th><th>Precedente</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row[0])}</td><td class="r">${esc(row[1])}</td><td class="r">${esc(row[2]??'')}</td></tr>`).join('')}</tbody></table>`;}
function openPdf(title,sections){const win=window.open('','_blank');if(!win){toast('Consenti l’apertura della finestra PDF.',true);return;}win.document.write(pdfHtml(title,sections));win.document.close();win.focus();setTimeout(()=>win.print(),100);}
function reclassPdfSections(){return ANALYSIS.result.reclassifications.map(model=>pdfTable(SCHEME_META[model.scheme]?.[0]||model.scheme,model.rows.map(row=>[ROW_LABELS[row.code]||TARGET_LABELS[row.target]||row.code,money(row.current),money(row.previous)]))).join('');}
function printReclassReport(){if(!exportGate())return;openPdf('Bilanci riclassificati',reclassPdfSections());}
function printKpiReport(){if(!exportGate())return;openPdf('KPI',pdfTable('Indicatori',ANALYSIS.result.kpis.map(row=>[KPI_META[row.code]?.[0]||row.code,displayKpi(row),row.status])));}
function printCashFlowReport(){if(!exportGate())return;openPdf('Cash flow gestionale',pdfTable('Cash flow',Object.entries(ANALYSIS.result.cashFlow).filter(([,value])=>typeof value==='number'||value===null).map(([key,value])=>[key,money(value),''])));}
function printAdequacyReport(){if(!exportGate())return;openPdf('Adeguati assetti',pdfTable('Indicatori',ANALYSIS.result.adequacy.metrics.map(row=>[row.code,row.value==null?'—':fmt(row.value,2),row.quality])));}
function printAdvancedReport(){if(!exportGate())return;openPdf('Analisi di bilancio',reclassPdfSections()+pdfTable('KPI principali',ANALYSIS.result.kpis.map(row=>[KPI_META[row.code]?.[0]||row.code,displayKpi(row),row.status])));}
function printReport(){return printAdvancedReport();}

function sheetDownload(name,rows){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Dati');XLSX.writeFile(wb,name);}
function downloadMainTemplate(){
  const wb=XLSX.utils.book_new(),add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
  add('Istruzioni',[
    ['Import Analisi di Bilancio'],
    ['Compilare Anagrafica, Stato Patrimoniale e Conto Economico. Conti e segni restano quelli del bilancio di verifica.'],
    ['Sono letti anche Budget e Forecast (solo CE), Catalogo centri, Allocazioni centri e Benchmark nel formato del template AI.'],
    ['Esiti AI valorizzato non è ancora reimportabile: manca il percorso di revisione e chiusura dei rilievi. L’import viene annullato.'],
    ['I codici duplicati nella stessa sezione sono temporaneamente bloccati: il mapping attuale non distingue le righe. Non sono concettualmente invalidi.'],
    ['Il supporto dei duplicati richiede un intervento separato sull’identità delle righe. Non sostituire o inventare codici conto.'],
    ['Campi e colonne non gestiti sono dichiarati nel riepilogo di import. Gli export analitici sono report e non sono template reimportabili.']
  ]);
  add('Anagrafica',[['Campo','Valore'],['Denominazione',''],['Partita IVA',''],['Codice fiscale',''],['Valuta','EUR'],['Schema di bilancio',''],['Periodo — dal',''],['Periodo — al','']]);
  const headers=['Codice conto','Descrizione conto','Importo esercizio corrente','Importo esercizio precedente','Voce IV Direttiva'];
  add('Stato Patrimoniale',[headers]);add('Conto Economico',[headers]);
  XLSX.writeFile(wb,'Template_Financial_Statement.xlsx');
}
function downloadScenarioTemplate(){
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Codice conto','Descrizione conto','Importo esercizio corrente','Importo esercizio precedente','Voce IV Direttiva']]),'Conto Economico');
  XLSX.writeFile(wb,'Template_Scenario_Analisi.xlsx');
}
function downloadCentersTemplate(){sheetDownload('Template_Centri.xlsx',[['Codice conto','Centro','Importo corrente','Importo precedente']]);}
function downloadBenchmarkTemplate(){sheetDownload('Template_Benchmark.xlsx',[['Codice KPI','Unità','Q1','Mediana','Q3','Fonte','Anno']]);}
function setKpiDisplayMode(){}
function openReclassPdfModes(){printReclassReport();}
function closeReclassPdfModes(){}
function toggleReclassDetail(){}
function confirmTechnicalResult(){STATE.accounts.filter(row=>row.technicalResult).forEach(row=>row.resultStatus='confirmed');updateAll();}

function loadFixture(fixture){const data=clone(fixture||{});STATE.company={...STATE.company,...(data.company||{})};STATE.accounts=data.accounts||[];STATE.attrs={};prepareAccounts(STATE.accounts);STATE.selected=new Set(data.selected||SCHEMES);STATE.periods=data.periods||{current:{available:true},previous:{available:true}};STATE.scenarios=data.scenarios||{budget:[],forecast:[]};prepareAccounts(STATE.scenarios.budget||[]);prepareAccounts(STATE.scenarios.forecast||[]);STATE.centers=data.centers||[];STATE.centerCatalog=data.centerCatalog||[];STATE.benchmark=data.benchmark||[];STATE.history=data.history||[];for(const item of STATE.history)prepareAccounts(item.accounts||[]);STATE.adjustments=data.adjustments||[];STATE.extra={aiFindings:[],...(data.extra||{})};STATE.diagnostics=data.diagnostics||[];STATE.reclassMap={};for(const custom of data.customMappings||[]){const key=`${custom.scheme.startsWith('sp_')?'SP':'CE'}|${custom.code}`,group=groupsFor(STATE.accounts,custom.scheme.startsWith('sp_')?'SP':'CE').find(row=>row.key===key);if(!group)continue;const current=groupAmount(group,'current'),previous=groupAmount(group,'previous');STATE.reclassMap[custom.scheme]??={};STATE.reclassMap[custom.scheme][key]=custom.allocations.map((row,index)=>({id:'a'+(index+1),target:row.target,current:current*row.share,previous:previous*row.share}));}if(data.forceUnresolved){const account=STATE.accounts.find(row=>row.code===data.forceUnresolved.code);if(account)attrsFor(account)[data.forceUnresolved.prop+'Status']='proposed';}if(data.forceSchemaBlank)STATE.company.schema='';STATE.loaded=true;STATE.files={main:'bilancio-fittizio.xlsx',budget:'',forecast:'',centers:'',benchmark:''};ANALYSIS.status='idle';ANALYSIS.result=null;ANALYSIS.payloadHash='';ANALYSIS.resultHash='';ANALYSIS.resultKey='';renderAll();schedule(false);return{accounts:STATE.accounts.length,schemes:STATE.selected.size};}
function loadDemo(){loadFixture({company:{name:'Alfa Dimostrativa S.r.l.',schema:'abbrev',yearCurrent:2026,yearPrevious:2025,periodFrom:'2026-01-01',periodTo:'2026-12-31',days:365},accounts:[{type:'SP',code:'100',desc:'Capitale fittizio',current:-200000,previous:-180000,iv:'AI',attrs:{currentClass:'equity',nature:'equity',pfn:'exclude'}},{type:'SP',code:'200',desc:'Impianti fittizi',current:500000,previous:450000,iv:'BII',attrs:{currentClass:'noncurrent',nature:'operating',pfn:'exclude'}},{type:'SP',code:'300',desc:'Rimanenze fittizie',current:100000,previous:90000,iv:'CI',attrs:{currentClass:'current',nature:'inventory',pfn:'exclude'}},{type:'SP',code:'400',desc:'Crediti fittizi',current:220000,previous:190000,iv:'CIIE',attrs:{currentClass:'current',nature:'trade_receivable',pfn:'exclude'}},{type:'SP',code:'500',desc:'Banca fittizia',current:80000,previous:70000,iv:'CIV',attrs:{currentClass:'current',nature:'cash',pfn:'cash'}},{type:'SP',code:'600',desc:'Fornitori fittizi',current:-260000,previous:-230000,iv:'DE',attrs:{currentClass:'current',nature:'trade_payable',pfn:'exclude'}},{type:'SP',code:'700',desc:'Mutuo fittizio',current:-370000,previous:-390000,iv:'DO',attrs:{currentClass:'noncurrent',nature:'financial',pfn:'debt'}},{type:'SP',code:'800',desc:'Utile fittizio',current:-70000,previous:-64000,iv:'AIX',attrs:{currentClass:'equity',nature:'equity',pfn:'exclude'}},{type:'CE',code:'R1',desc:'Ricavi fittizi',current:-900000,previous:-820000,iv:'A1'},{type:'CE',code:'C1',desc:'Materie fittizie',current:380000,previous:350000,iv:'B6',attrs:{function:'production_direct',behavior:'variable'}},{type:'CE',code:'C2',desc:'Servizi fittizi',current:190000,previous:175000,iv:'B7',attrs:{function:'ga',behavior:'fixed_common'}},{type:'CE',code:'C3',desc:'Personale fittizio',current:210000,previous:195000,iv:'B9A',attrs:{function:'production_indirect',behavior:'fixed_common'}},{type:'CE',code:'C4',desc:'Ammortamenti fittizi',current:40000,previous:36000,iv:'B10B',attrs:{function:'production_indirect',behavior:'fixed_common'}},{type:'CE',code:'C5',desc:'Interessi fittizi',current:10000,previous:12000,iv:'C17E'},{type:'CE',code:'C6',desc:'Imposte fittizie',current:30000,previous:26000,iv:'20A'}],selected:SCHEMES,periods:{current:{available:true},previous:{available:true}},extra:{employeesCurrent:12,cashFlowDebtService:100000,debtService:85000,aiFindings:[]}});setView('executive');}

function configureForTests(options={}){const host=location.hostname.toLowerCase(),local=['localhost','127.0.0.1','::1'].includes(host)||host.endsWith('.localhost');if(!local)return false;if(Number.isFinite(options.debounceMs))transport.debounceMs=Math.max(0,Math.min(2000,options.debounceMs));if(Number.isFinite(options.timeoutMs))transport.timeoutMs=Math.max(20,Math.min(30000,options.timeoutMs));if(typeof options.endpoint==='string'&&options.endpoint.startsWith('/'))transport.endpoint=options.endpoint;return true;}
function diagnostics(){return clone({...ANALYSIS,result:undefined});}
window.FA_APP={buildPayload:()=>clone(buildPayload()),configureForTests,diagnostics,exportGate,loadFixture,measurePayload:()=>{const payload=buildPayload();return{total:utf8Bytes(JSON.stringify(payload)),sections:Object.fromEntries(Object.keys(payload).map(key=>[key,utf8Bytes(JSON.stringify(payload[key]))]))};},result:()=>clone(ANALYSIS.result),retry:retryAnalysis};
Object.assign(window,{addAdjustment,applySchemes,clearCashFlowInputs,clearHistory,clearSchemes,closeReclassPdfModes,confirmDecision,confirmGroup,confirmTechnicalResult,deleteAdjustment,deleteConfig,downloadBenchmarkTemplate,downloadCentersTemplate,downloadMainTemplate,downloadScenarioTemplate,exportAdequacyExcel,exportAdvancedExcel,exportAllConfigs,exportCashFlowExcel,exportConfig,exportExcel,exportHistoryExcel,exportKpiExcel,importAllConfigs,importBenchmark,importCenters,importConfig,importHistory,importMain,importScenario,loadArchive,loadConfig,loadDemo,openReclassPdfModes,printAdequacyReport,printAdvancedReport,printCashFlowReport,printKpiReport,printReclassReport,printReport,removeAllocation,resetAccountMapping,resetSchemeMapping,resetSession,retryAnalysis,saveAdequacyInputs,saveCashFlowInputs,saveCompany,saveConfig,saveExtraKpi,selectAllSchemes,selectRecommended,setAdjustedKpiMode,setDecision,setFirstYearMode,setKpiDisplayMode,setMappingScheme,setVariablePct,setView,splitAllocation,toggleReclassDetail,updateAllocation,updateAll,writeWorkbookFile});

document.addEventListener('DOMContentLoaded',()=>{installAdvancedViews();renderNav();const toggle=q('sb-toggle'),backdrop=q('sb-backdrop'),close=q('sb-close-mobile'),siteToggle=q('talGhMenuToggle'),siteNav=q('talGhNav');toggle?.addEventListener('click',()=>setSidebar(!q('sidebar')?.classList.contains('open')));backdrop?.addEventListener('click',()=>setSidebar(false));close?.addEventListener('click',()=>{setSidebar(false);toggle?.focus();});siteToggle?.addEventListener('click',()=>setSiteNav(!document.querySelector('.tal-global-header')?.classList.contains('tal-menu-open')));siteNav?.querySelectorAll('a,button').forEach(item=>item.addEventListener('click',()=>{if(matchMedia('(max-width:760px)').matches)setSiteNav(false);}));document.addEventListener('keydown',event=>{if(event.key==='Escape'){setSidebar(false);setSiteNav(false);}});renderAll();setView((location.hash||'#/archive').replace(/^#\/?/,'')||'archive');});
})();
