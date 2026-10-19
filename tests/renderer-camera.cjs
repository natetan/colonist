const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('tools/renderer-lab.js','utf8'),context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function captureMapCamera('),source.indexOf('async function render(')),context);
function view(fit,height,center){return {screenWidth:1000,screenHeight:700,mapCenter:{x:15,y:-8},hexagonHeight:height,initialFitScale:fit,scale:{x:fit,set(n){this.x=n;}},toWorld(){return center;},moveCenter(x,y){this.center={x,y};}};}
const old=view(.6,120,{x:195,y:-98});old.scale.x=1.2;
const saved=context.captureMapCamera(old),next=view(.6,120);context.restoreMapCamera(next,saved);assert.equal(next.scale.x,1.2);assert.deepEqual(next.center,{x:195,y:-98});
const resized=view(.3,60);context.restoreMapCamera(resized,saved);assert.equal(resized.scale.x,.6);assert.deepEqual(resized.center,{x:105,y:-53});
const fresh=view(.4,80);context.restoreMapCamera(fresh,null);assert.equal(fresh.scale.x,.4);assert.equal(fresh.center,undefined);
console.log('PASS: camera pan and relative zoom survive scene recreation and viewport resizing; fresh boards retain default fit');
