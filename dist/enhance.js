/* Interaction layer: keeps the original dashboard and adds detail access to every live surface. */
document.addEventListener("click",function(e){
  var activity=e.target.closest(".feed div");
  if(activity){modal('<h2>تفاصيل حدث الشركة</h2><p class="muted">🔵 حدث داخلي من سجل الشركة المشترك</p><p>'+activity.innerText+'</p><p>تم تسجيل هذا الحدث تلقائيًا عند تغير حالة موظف أو مهمة أو موافقة.</p>');return}
  var approval=e.target.closest(".approval");
  if(approval&&!e.target.closest("button")){var title=approval.querySelector("strong").innerText;modal('<h2>'+title+'</h2><p class="muted">🟠 قرار ينتظر موافقة نواف</p><p>فتح إجراءات الاعتماد من الأزرار أدناه لتشغيل التدفق المرتبط وتحديث الموظفين والمشروع والتقارير.</p>')}
});
document.addEventListener("mouseover",function(e){var b=e.target.closest(".robot");if(b)b.setAttribute("aria-label","موظف AI — اضغط لفتح مساحة عمله")});
