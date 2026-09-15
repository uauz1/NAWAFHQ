(function(){'use strict';
if(!window.THREE||window.__NAWAF_PERF_PATCHED__)return;
window.__NAWAF_PERF_PATCHED__=true;
var T=window.THREE;
var NativeRenderer=T.WebGLRenderer;
function FastRenderer(options){
  options=Object.assign({},options||{}, {antialias:false,powerPreference:'high-performance',precision:'mediump'});
  var r=new NativeRenderer(options);
  var nativeSetPixelRatio=r.setPixelRatio.bind(r);
  r.setPixelRatio=function(v){return nativeSetPixelRatio(Math.min(Number(v)||1,1));};
  try{
    var sm=r.shadowMap;
    var enabled=false;
    Object.defineProperty(sm,'enabled',{configurable:true,enumerable:true,get:function(){return enabled},set:function(v){enabled=false}});
  }catch(e){try{r.shadowMap.enabled=false}catch(_){}}
  return r;
}
FastRenderer.prototype=NativeRenderer.prototype;
Object.setPrototypeOf(FastRenderer,NativeRenderer);
T.WebGLRenderer=FastRenderer;

var NativePoint=T.PointLight;
function FastPointLight(color,intensity,distance,decay){
  var l=new NativePoint(color,Math.min(Number(intensity)||1,4),distance,decay);
  l.castShadow=false;
  return l;
}
FastPointLight.prototype=NativePoint.prototype;
Object.setPrototypeOf(FastPointLight,NativePoint);
T.PointLight=FastPointLight;

var NativeDirectional=T.DirectionalLight;
function FastDirectionalLight(color,intensity){
  var l=new NativeDirectional(color,Math.min(Number(intensity)||1,4.2));
  try{
    l.castShadow=false;
    l.shadow.mapSize.set(512,512);
  }catch(e){}
  return l;
}
FastDirectionalLight.prototype=NativeDirectional.prototype;
Object.setPrototypeOf(FastDirectionalLight,NativeDirectional);
T.DirectionalLight=FastDirectionalLight;

document.documentElement.dataset.performanceMode='1';
})();
