// Text and attribute boundary; HTML fragments must be constructed only by views.
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const localHref=value=>escapeHtml(typeof value==='string'&&value.startsWith('#/')?value:'#/ingresso');
