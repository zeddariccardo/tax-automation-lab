/* Shared public-site navigation behavior. */
(function(){
  'use strict';
  function init(){
    document.querySelectorAll('.tal-global-header').forEach(function(header){
      var frame=header.querySelector('.tal-gh-frame');
      var nav=header.querySelector('.tal-gh-nav');
      if(!frame||!nav||frame.querySelector('.tal-gh-menu-toggle')) return;
      var loc=(document.documentElement.lang||'it').toLowerCase();
      var open=loc.indexOf('es')===0?'Abrir el menú':(loc.indexOf('en')===0?'Open menu':'Apri il menu');
      var close=loc.indexOf('es')===0?'Cerrar el menú':(loc.indexOf('en')===0?'Close menu':'Chiudi il menu');
      var label=loc.indexOf('es')===0?'Menú':'Menu';
      var btn=document.createElement('button');
      btn.type='button';
      btn.className='tal-gh-menu-toggle';
      btn.textContent=label;
      btn.setAttribute('aria-label',open);
      btn.setAttribute('aria-expanded','false');
      btn.setAttribute('aria-controls','tal-primary-nav');
      if(!nav.id) nav.id='tal-primary-nav';
      frame.appendChild(btn);
      function setOpen(on){
        header.classList.toggle('tal-menu-open',on);
        btn.setAttribute('aria-expanded',String(on));
        btn.setAttribute('aria-label',on?close:open);
      }
      btn.addEventListener('click',function(){setOpen(!header.classList.contains('tal-menu-open'));});
      nav.querySelectorAll('a,button').forEach(function(item){
        item.addEventListener('click',function(){
          if(window.matchMedia('(max-width:760px)').matches) setOpen(false);
        });
      });
      document.addEventListener('keydown',function(event){if(event.key==='Escape') setOpen(false);});
      window.addEventListener('resize',function(){
        if(!window.matchMedia('(max-width:760px)').matches) setOpen(false);
      },{passive:true});
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
