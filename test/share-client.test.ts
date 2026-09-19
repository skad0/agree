import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { SHARE_JS } from "../src/share-client.js";

function fixture(navigator: object) {
  const status={textContent:""};let selected=false;let focus="";
  const button=(name:string)=>({hidden:true,handler:undefined as undefined|(()=>Promise<void>),addEventListener(_event:string,handler:()=>Promise<void>){this.handler=handler;},focus(){focus=name;}});
  const copy=button("copy"),native=button("native");
  const field={focus(){focus="url";},select(){selected=true;}};
  const nodes:Record<string,unknown>={'[role=status]':status,'[data-share-copy]':copy,'[data-share-native]':native,'.share-url':field};
  const dataset={shareUrl:'https://example.org/he/issues/elections-on-time',shareText:'הסבר',shareTitle:'שאלה',copied:'copied',copyFailed:'copy failed',shareFailed:'share failed'};
  runInNewContext(SHARE_JS,{document:{querySelectorAll:()=>[{dataset,querySelector:(selector:string)=>nodes[selector]}]},navigator});
  return {copy,native,status,dataset,get selected(){return selected;},get focus(){return focus;}};
}

test("clipboard success announces only a copy; failure selects the visible URL",async()=>{
  let copied='';
  const success=fixture({clipboard:{writeText:async(value:string)=>{copied=value;}}});
  assert.equal(success.copy.hidden,false);assert.equal(success.native.hidden,true);
  await success.copy.handler!();assert.equal(copied,success.dataset.shareUrl);assert.equal(success.status.textContent,'copied');
  for(const navigator of [{},{clipboard:{writeText:async()=>{throw Error('permission denied');}}}]){
    const failure=fixture(navigator);await failure.copy.handler!();
    assert.equal(failure.status.textContent,'copy failed');assert.equal(failure.selected,true);assert.equal(failure.focus,'url');
  }
});

test("native share receives stable content, cancellation is silent and errors remain recoverable",async()=>{
  let payload:any;
  const success=fixture({share:async(value:unknown)=>{payload=value;}});
  assert.equal(success.native.hidden,false);await success.native.handler!();
  assert.equal(payload.url,success.dataset.shareUrl);assert.equal(payload.text,'הסבר');assert.equal(success.status.textContent,'');assert.equal(success.focus,'native');
  for(const name of ['AbortError','NotAllowedError']){
    const failure=fixture({share:async()=>{throw {name};}});await failure.native.handler!();
    assert.equal(failure.status.textContent,name==='AbortError'?'':'share failed');assert.equal(failure.focus,'native');
  }
});
