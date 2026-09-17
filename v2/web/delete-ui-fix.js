(()=>{
  const originalFetch=window.fetch.bind(window);
  function toast(message){
    let el=document.getElementById('hqToast');
    if(!el){
      el=document.createElement('div');
      el.id='hqToast';
      Object.assign(el.style,{position:'fixed',left:'50%',bottom:'28px',transform:'translateX(-50%)',zIndex:'99999',background:'#17191c',color:'#f2d47a',border:'1px solid #6f5a21',borderRadius:'12px',padding:'10px 16px',boxShadow:'0 10px 30px rgba(0,0,0,.35)',fontFamily:'inherit'});
      document.body.appendChild(el);
    }
    el.textContent=message;
    el.style.display='block';
    clearTimeout(el._timer);
    el._timer=setTimeout(()=>{el.style.display='none';},1800);
  }
  window.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:(input?.url||'');
    const response=await originalFetch(input,init);
    const match=url.match(/\/api\/v2\/tasks\/([0-9a-f-]+)\/archive(?:\?|$)/i);
    if(match&&response.ok){
      const id=match[1];
      document.querySelectorAll(`[data-task="${CSS.escape(id)}"]`).forEach(el=>el.remove());
      const dialog=document.getElementById('taskDialog');
      if(dialog?.open)dialog.close();
      toast('تم حذف الأمر من القائمة');
    }
    return response;
  };
})();
