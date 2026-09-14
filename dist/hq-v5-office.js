(function(){'use strict';
const KEY='nawaf-hq-v5';
function boot(){
 const T=window.THREE,wrap=document.querySelector('.hq-3d-stage');if(!wrap||!T)return;
 if(wrap.dataset.sceneReady==='1')return;wrap.dataset.sceneReady='1';
 const state=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}})();
 const host=document.createElement('div');host.className='office-scene';wrap.prepend(host);
 const scene=new T.Scene();scene.background=new T.Color(0x070c13);scene.fog=new T.FogExp2(0x070c13,.028);
 const camera=new T.PerspectiveCamera(35,wrap.clientWidth/Math.max(1,wrap.clientHeight),.1,80);
 const low=matchMedia('(pointer:coarse)').matches||(navigator.deviceMemory&&navigator.deviceMemory<=4);
 const renderer=new T.WebGLRenderer({antialias:!low,alpha:false,powerPreference:low?'low-power':'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:1.45));renderer.setSize(wrap.clientWidth,wrap.clientHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=!low;host.appendChild(renderer.domElement);
 const mat=(color,metal=.15,rough=.55,extra={})=>new T.MeshStandardMaterial({color,metalness:metal,roughness:rough,...extra});
 const box=(parent,w,h,d,color,x,y,z,metal=.12,rough=.55)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color,metal,rough));m.position.set(x,y,z);m.castShadow=m.receiveShadow=!low;parent.add(m);return m};
 const floor=new T.Mesh(new T.CylinderGeometry(10.8,11.3,.45,8),mat(0x111927,.55,.34));floor.position.y=-.28;floor.rotation.y=Math.PI/8;floor.receiveShadow=true;scene.add(floor);
 const inset=new T.Mesh(new T.CylinderGeometry(9.9,10,.08,64),mat(0x0b111b,.3,.38));inset.position.y=.01;scene.add(inset);
 for(let i=0;i<4;i++){const ring=new T.Mesh(new T.TorusGeometry(3.1+i*1.75,.018,6,120),new T.MeshBasicMaterial({color:i%2?0x24354d:0x4a3e28,transparent:true,opacity:.62}));ring.rotation.x=Math.PI/2;ring.position.y=.08;scene.add(ring)}
 const roomNames=['الإدارة العامة','التقنية والبحث','المنتج والتجربة','الجودة والمراجعة'],colors=[0xd8ae5d,0x678dff,0xb07cff,0x55cfab],roomGroups=[],bots=[];
 const positions=[[-5.4,-3.4],[5.4,-3.4],[-5.4,3.4],[5.4,3.4]];
 function screen(parent,x,y,z,color){const s=new T.Mesh(new T.PlaneGeometry(1.05,.56),new T.MeshBasicMaterial({color,transparent:true,opacity:.8,side:T.DoubleSide}));s.position.set(x,y,z);parent.add(s)}
 function bot(parent,x,z,color,busy,phase){const g=new T.Group();g.position.set(x,.12,z);const body=new T.Mesh(new T.CapsuleGeometry(.17,.32,4,10),mat(busy?0xdce9ff:0xaeb8c5,.25,.28));body.position.y=.48;g.add(body);const head=new T.Mesh(new T.SphereGeometry(.23,18,14),mat(0xe8edf3,.22,.2));head.scale.y=.82;head.position.y=.91;g.add(head);const face=box(g,.3,.09,.025,0x0a111a,0,.9,-.205,.5,.2);[-.07,.07].forEach(px=>{const eye=new T.Mesh(new T.SphereGeometry(.018,8,6),new T.MeshBasicMaterial({color:busy?0x69f0ae:color}));eye.position.set(px,.91,-.225);g.add(eye)});if(busy){const light=new T.PointLight(0x69f0ae,1.4,2);light.position.set(0,.65,0);g.add(light)}parent.add(g);bots.push({g,phase,busy})}
 positions.forEach((pos,i)=>{const g=new T.Group();g.position.set(pos[0],0,pos[1]);g.userData={room:i,name:roomNames[i]};scene.add(g);roomGroups.push(g);const color=colors[i];
  const slab=box(g,4.35,.16,3.35,0x161f2b,0,.12,0,.38,.34);slab.userData=g.userData;
  box(g,4.35,1.35,.07,0x1b2634,0,.76,1.63,.18,.45);box(g,.07,1.35,3.35,0x182330,-2.14,.76,0,.18,.45);
  const glass=new T.Mesh(new T.BoxGeometry(2.4,1.05,.035),new T.MeshPhysicalMaterial({color,transparent:true,opacity:.16,roughness:.08,metalness:.1,transmission:.35}));glass.position.set(.75,.82,1.58);g.add(glass);
  box(g,1.8,.09,.72,0x9b7b50,.45,.54,-.22,.16,.42);box(g,.07,.48,.07,0x36404d,-.35,.3,-.22,.45,.3);box(g,.07,.48,.07,0x36404d,1.25,.3,-.22,.45,.3);screen(g,.45,1.02,-.57,color);
  const dept=state.employees?.filter(e=>e.department===roomNames[i])||[];const people=dept.length?dept:[state.employees?.[i]].filter(Boolean);
  people.slice(0,2).forEach((e,n)=>bot(g,-.45+n*1.5,-.95,color,['WORKING','RESEARCHING','REVIEWING'].includes(e.status),i+n*.7));
  const bar=box(g,2.1,.035,.06,color,.7,1.45,1.57,.2,.25);bar.userData=g.userData;
  const light=new T.PointLight(color,2.4,5.5,2);light.position.set(0,2,.1);g.add(light);
 });
 const hub=new T.Group();scene.add(hub);box(hub,3.05,.32,3.05,0x151f2c,0,.25,0,.55,.26);box(hub,2.25,.12,2.25,0x26364a,0,.51,0,.65,.22);
 const core=new T.Mesh(new T.OctahedronGeometry(.72,2),new T.MeshPhysicalMaterial({color:0xe5bd69,emissive:0x8b5e16,emissiveIntensity:2.5,metalness:.35,roughness:.08,transparent:true,opacity:.92}));core.position.y=1.48;hub.add(core);
 const wire=new T.Mesh(new T.TorusKnotGeometry(1.12,.018,100,8),new T.MeshBasicMaterial({color:0x8ba6ff,transparent:true,opacity:.45}));wire.position.y=1.45;hub.add(wire);
 const beam=new T.Mesh(new T.CylinderGeometry(.1,.8,2.4,24,1,true),new T.MeshBasicMaterial({color:0xd8ae5d,transparent:true,opacity:.06,side:T.DoubleSide}));beam.position.y=1.45;hub.add(beam);
 scene.add(new T.HemisphereLight(0x88a8de,0x120e0a,1.45));const key=new T.DirectionalLight(0xffdfa6,2.8);key.position.set(-7,13,-8);key.castShadow=!low;scene.add(key);const rim=new T.DirectionalLight(0x587dff,2);rim.position.set(10,8,10);scene.add(rim);
 let theta=.68,targetTheta=.68,radius=22,targetRadius=22,height=16,targetHeight=16,drag=false,moved=false,lastX=0;
 function aim(){camera.position.set(Math.sin(theta)*radius,height,Math.cos(theta)*radius);camera.lookAt(0,.45,0)}aim();
 function focus(i){if(i<0){targetTheta=.68;targetRadius=22;targetHeight=16}else{const p=positions[i];targetTheta=Math.atan2(p[0],p[1]);targetRadius=17;targetHeight=11.5}roomGroups.forEach((g,n)=>g.scale.setScalar(n===i?1.07:1))}
 wrap.addEventListener('hq:focus-room',e=>focus(e.detail.index));wrap.addEventListener('hq:overview',()=>focus(-1));
 renderer.domElement.addEventListener('pointerdown',e=>{drag=true;moved=false;lastX=e.clientX});window.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-lastX;if(Math.abs(dx)>2)moved=true;targetTheta+=dx*.005;lastX=e.clientX});renderer.domElement.style.touchAction='none';
 const ray=new T.Raycaster(),mouse=new T.Vector2();renderer.domElement.addEventListener('click',e=>{if(moved)return;const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1));ray.setFromCamera(mouse,camera);const hits=ray.intersectObjects(roomGroups,true);for(const hit of hits){let o=hit.object;while(o&&o.parent&&!Number.isInteger(o.userData.room))o=o.parent;if(Number.isInteger(o?.userData?.room)){focus(o.userData.room);wrap.dispatchEvent(new CustomEvent('hq:scene-room',{detail:o.userData}));break}}});
 const clock=new T.Clock();let last=0;function loop(now=0){if(!wrap.isConnected){renderer.dispose();return}requestAnimationFrame(loop);if(document.hidden||now-last<(low?34:16))return;last=now;const t=clock.getElapsedTime();theta+=(targetTheta-theta)*.065;radius+=(targetRadius-radius)*.07;height+=(targetHeight-height)*.07;aim();core.rotation.y=t*.52;core.rotation.x=t*.18;wire.rotation.y=-t*.22;wire.rotation.x=t*.08;bots.forEach(b=>{b.g.position.y=.12+Math.sin(t*1.8+b.phase)*.022;if(b.busy)b.g.rotation.y=Math.sin(t*.8+b.phase)*.08});renderer.render(scene,camera)}loop();
 new ResizeObserver(()=>{if(!wrap.clientWidth||!wrap.clientHeight)return;camera.aspect=wrap.clientWidth/wrap.clientHeight;camera.updateProjectionMatrix();renderer.setSize(wrap.clientWidth,wrap.clientHeight)}).observe(wrap)
}
window.NawafHQ3D=boot;const start=()=>setTimeout(boot,100);document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();window.addEventListener('nawaf:state-updated',()=>{const old=document.querySelector('.hq-3d-stage');if(old){old.dataset.sceneReady='';old.querySelector('.office-scene')?.remove();setTimeout(boot,80)}})
})();