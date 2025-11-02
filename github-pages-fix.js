(function(){
  function buildFuelMenu(){
    var li=document.createElement('li');
    li.className='menu-dropdown';
    li.setAttribute('data-feature','fuel_management');
    li.setAttribute('data-requires-permission','fuel_management');
    var a=document.createElement('a');
    a.href='#';
    a.innerHTML='<i class="fas fa-gas-pump"></i> Fuel Management';
    var ul=document.createElement('ul');
    ul.className='submenu';
    var items=[
      {f:'vessel_offloading',t:'Vessel Offloading',h:'vessel.html'},
      {f:'fuel_storage',t:'Fuel Storage Status',h:'fuelstor.html'},
      {f:'tank_transfer',t:'Tank-to-Tank Transfer',h:'tank-transfer.html'},
      {f:'truck_loading',t:'Fuel Truck Loading',h:'fueltruck.html'},
      {f:'quality_analysis',t:'Fuel Quality Analysis',h:'fuelqual.html'},
      {f:'fuel_distribution',t:'Fuel Distribution',h:'fueldist.html'},
      {f:'fuel_consumption_analysis',t:'Consumption Analysis',h:'fuelanalys.html'}
    ];
    items.forEach(function(it){
      var liChild=document.createElement('li');
      liChild.setAttribute('data-feature',it.f);
      liChild.setAttribute('data-requires-permission',it.f);
      var aChild=document.createElement('a');
      aChild.href=it.h;
      aChild.textContent=it.t;
      liChild.appendChild(aChild);
      ul.appendChild(liChild);
    });
    li.appendChild(a);
    li.appendChild(ul);
    return li;
  }
  function ensureFuelMenu(menu){
    if(!menu) return;
    var existing=menu.querySelector('[data-feature="fuel_management"]');
    var fuelDropdown=existing;
    if(!existing){
      var newMenu=buildFuelMenu();
      var before=menu.querySelector('[data-feature="environment_view"]')||menu.querySelector('[data-feature="security_view"]');
      if(before&&before.parentNode===menu){
        menu.insertBefore(newMenu,before);
      }else{
        menu.appendChild(newMenu);
      }
      fuelDropdown=newMenu;
    } else {
      var submenu=existing.querySelector('ul.submenu');
      if(!submenu){
        submenu=document.createElement('ul');
        submenu.className='submenu';
        existing.appendChild(submenu);
      }
      var defs={
        vessel_offloading:{t:'Vessel Offloading',h:'vessel.html'},
        fuel_storage:{t:'Fuel Storage Status',h:'fuelstor.html'},
        tank_transfer:{t:'Tank-to-Tank Transfer',h:'tank-transfer.html'},
        truck_loading:{t:'Fuel Truck Loading',h:'fueltruck.html'},
        quality_analysis:{t:'Fuel Quality Analysis',h:'fuelqual.html'},
        fuel_distribution:{t:'Fuel Distribution',h:'fueldist.html'},
        fuel_consumption_analysis:{t:'Consumption Analysis',h:'fuelanalys.html'}
      };
      Object.keys(defs).forEach(function(key){
        if(!existing.querySelector('[data-feature="'+key+'"]')){
          var li=document.createElement('li');
          li.setAttribute('data-feature',key);
          li.setAttribute('data-requires-permission',key);
          var a=document.createElement('a');
          a.href=defs[key].h;
          a.textContent=defs[key].t;
          li.appendChild(a);
          submenu.appendChild(li);
        }
      });
    }
    if(fuelDropdown&&!fuelDropdown.querySelector('a')){
      var a=document.createElement('a');
      a.href='#';
      a.innerHTML='<i class="fas fa-gas-pump"></i> Fuel Management';
      fuelDropdown.insertBefore(a,fuelDropdown.firstChild);
    }
  }
  function init(){
    var menu=document.getElementById('roleBasedMenu');
    if(menu){
      ensureFuelMenu(menu);
      return;
    }
    var obs=new MutationObserver(function(muts,observer){
      var m=document.getElementById('roleBasedMenu');
      if(m){ ensureFuelMenu(m); observer.disconnect(); }
    });
    obs.observe(document.documentElement||document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
