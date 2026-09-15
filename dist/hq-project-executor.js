(function(){
'use strict';
const PROJECTS={mueen:{name:'مُعِين',liveUrl:'https://mueen-islamic-app.vercel.app/',repo:'https://github.com/uauz1/mueen-islamic-app'},qaddha:{name:'قدّها',liveUrl:'https://qaddha.vercel.app/',repo:'https://github.com/uauz1/game'}};
function runTask(taskId){if(window.NawafAgents?.runTask)return window.NawafAgents.runTask(taskId);return Promise.resolve(false)}
function permissionBlock(){return ''}
function scan(){return false}
window.NawafProjectExecutor={runTask,projects:PROJECTS,scan,permissionBlock,legacy:false};
})();
