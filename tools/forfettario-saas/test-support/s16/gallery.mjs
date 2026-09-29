import {names,renderState} from './states.mjs';
const select=document.querySelector('#state'),preview=document.querySelector('#preview');
select.innerHTML=names.map(x=>`<option>${x}</option>`).join('');
async function render(){preview.innerHTML=await renderState(select.value);}
select.addEventListener('change',render);
document.addEventListener('submit',e=>e.preventDefault());
document.addEventListener('click',e=>{if(e.target.closest('#preview a'))e.preventDefault();});
await render();
