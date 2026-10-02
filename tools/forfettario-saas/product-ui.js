// Presentation-only navigation. No requests, persistence, fiscal facts or actions.
export function entryHero(){
 const words=['fatture','tasse','documenti','dichiarazioni','pagamenti','fatture'];
 return `<h1 class="entry-title product-hero-title"><span class="sr-only">semplifica fatture, tasse, documenti, dichiarazioni e pagamenti</span><span class="hero-phrase" aria-hidden="true"><span class="hero-fixed">semplifica</span><span class="hero-window"><span class="hero-track">${words.map((w,i)=>`<span class="hero-word ${i===1||i===3?'petrol':'violet'}">${w}</span>`).join('')}</span></span></span></h1>`;
}
