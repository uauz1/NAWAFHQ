(()=>{
  const adminLinks={
    'مُعِين':'https://mueen-islamic-app.vercel.app/admin.html'
  };
  function enhance(){
    document.querySelectorAll('.project').forEach(card=>{
      const title=card.querySelector('h3')?.textContent?.trim();
      const href=adminLinks[title];
      if(!href||card.querySelector('[data-project-admin-link]'))return;
      const actions=card.querySelector('.project-actions');
      if(!actions)return;
      const link=document.createElement('a');
      link.className='link-btn';
      link.dataset.projectAdminLink='true';
      link.href=href;
      link.target='_blank';
      link.rel='noreferrer';
      link.textContent=`لوحة تحكم ${title}`;
      actions.prepend(link);
    });
  }
  const observer=new MutationObserver(enhance);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('DOMContentLoaded',enhance);
  enhance();
})();