import test from 'node:test';import assert from 'node:assert/strict';
import {confirmationLabel,paymentRecords} from './workflow-view.js';
import {createVerificationUI} from './verification-ui.js';
test('S18 a linked owner declaration is not a professional verification',()=>{
 assert.equal(confirmationLabel({state:'self_declared'}),'Dichiarato dal titolare');
 assert.equal(confirmationLabel({state:'evidence_backed'}),'Dichiarato dal titolare · evidenza allegata');
 assert.equal(confirmationLabel({state:'legacy_unclassified'}),'Origine da verificare');
});

function verificationHarness(){
 let selected={context_type:'studio',context_id:'studio'},panel=null;const calls=[];
 const record={id:'payment',verifications:[]},controller={refresh:async()=>{},getState:()=>({data:{pensionPayments:[record]}})};
 const service={verifyPaymentFact:async(...args)=>{calls.push(structuredClone(args));}};
 const ui=createVerificationUI({auth:{getState:()=>({phase:'ready',user:{id:'user'},selected})},service,
  route:()=>({id:'workspace',page:'tasse'}),fiscals:controller,payments:controller,openPanel:(...a)=>panel=a,done:()=>{}});
 const controls=[{tagName:'INPUT'},{tagName:'BUTTON'}],error={textContent:'',focus(){}};
 const form={id:'fact-verification-form',dataset:{},isConnected:true,elements:{reason:{value:'Verifica sintetica'}},querySelector:()=>error,querySelectorAll:()=>controls};
 return {ui,service,controller,form,calls,error,controls,panel:()=>panel,personal:()=>selected={context_type:'personal',context_id:'workspace'}};
}
test('professional control unavailable to personal context and late context response discarded',async()=>{
 const h=verificationHarness();h.personal();await h.ui.act('fact-verify:pension_payment:payment');assert.equal(h.panel(),null);
 const late=verificationHarness();late.controller.refresh=async()=>late.personal();await late.ui.act('fact-verify:pension_payment:payment');assert.equal(late.panel(),null);
});
test('professional command has no client actor/role/provenance, retries preserve key and payload',async()=>{
 const h=verificationHarness();await h.ui.act('fact-verify:pension_payment:payment');assert.ok(h.panel());
 h.service.verifyPaymentFact=async(...a)=>{h.calls.push(structuredClone(a));if(h.calls.length===1)throw Object.assign(Error(),{code:'uncertain'});};
 await h.ui.submit(h.form);assert.equal(h.controls[0].disabled,true);h.form.elements.reason.value='changed after timeout';
 await h.ui.submit(h.form);assert.deepEqual(h.calls[0],h.calls[1]);
 assert.deepEqual(Object.keys(h.calls[0][1]).sort(),['expectedRevision','id','kind','reason']);
});
test('professional command handles revocation without declaring success',async()=>{
 const h=verificationHarness();await h.ui.act('fact-verify:pension_payment:payment');
 h.service.verifyPaymentFact=async()=>{throw Object.assign(Error(),{code:'forbidden'});};await h.ui.submit(h.form);
 assert.match(h.error.textContent,/Non sei più autorizzato/);
});
test('S18 professional verification is separate from original declaration',()=>{
 const origin={state:'evidence_backed',actorId:'owner'};
 assert.equal(confirmationLabel(origin,[{state:'studio_verified',actorId:'member'}]),'Dichiarato dal titolare · evidenza allegata · verificato dallo Studio');
 assert.equal(origin.state,'evidence_backed');
 const records=paymentRecords({paymentReconciliation:{payments:[{eventId:'e',paidDate:'2025-01-01',amountCents:50000,confirmation:origin,verifications:[{state:'studio_verified'}]}]}});
 assert.equal(records[0].confirmation,origin);assert.equal(records[0].amountCents,50000);
});
