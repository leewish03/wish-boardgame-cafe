import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

assert.ok(!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL, 'Chat socket regression requires memory-only configuration');
const { initRoomManager, rooms } = await import('../server/shared/roomManager.js');
const { roomRepository } = await import('../server/core/RoomRepository.js');
const server=http.createServer(), io=new Server(server), clients=[], checks=[];
initRoomManager(io);
io.on('connection',socket=>socket.on('test:barrier',(_payload,ack)=>ack({success:true})));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const emit=(client,event,payload={})=>new Promise((resolve,reject)=>client.timeout(2000).emit(event,payload,(error,result)=>error?reject(error):resolve(result)));
async function connect(){
  const client=Client(`http://127.0.0.1:${server.address().port}`,{transports:['websocket'],reconnection:false});clients.push(client);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('connection timeout')),2000);client.once('connect',()=>{clearTimeout(timer);resolve();});client.once('connect_error',error=>{clearTimeout(timer);reject(error);});});return client;
}
const save=roomRepository.saveRoom;
let code,writeCount=0;
try{
  const sender=await connect(),observer=await connect();
  const created=await emit(sender,'room:create',{nickname:'Chat boundary host',gameType:'DALMUTI',turnTimeLimit:0});assert.equal(created.success,true);code=created.roomCode;
  assert.equal((await emit(observer,'room:join',{roomCode:code,nickname:'Chat boundary observer'})).success,true);
  await emit(observer,'test:barrier');
  const senderMessages=[],observerMessages=[];
  sender.on('chat:message',message=>senderMessages.push(message));observer.on('chat:message',message=>observerMessages.push(message));
  roomRepository.saveRoom=async(...args)=>{writeCount++;return save.apply(roomRepository,args);};
  async function check(name,text,expected){
    const before={writes:writeCount,sender:senderMessages.length,observer:observerMessages.length,ids:(rooms[code].chatMessages||[]).map(message=>message.id)};
    const ack=await emit(sender,'chat:message',{roomCode:code,text});await emit(observer,'test:barrier');
    const after={writes:writeCount,sender:senderMessages.length,observer:observerMessages.length,ids:(rooms[code].chatMessages||[]).map(message=>message.id)};
    const record={name,inputType:typeof text,inputLength:typeof text==='string'?text.length:null,ack,writeDelta:after.writes-before.writes,senderDelta:after.sender-before.sender,observerDelta:after.observer-before.observer};
    try{
      assert.equal(ack.success,expected,`${name}: ACK success must be ${expected}`);
      if(expected){assert.equal(record.writeDelta,1);assert.equal(record.senderDelta,1);assert.equal(record.observerDelta,1);assert.equal(ack.message.text,text.trim());assert.equal(rooms[code].chatMessages.filter(message=>message.id===ack.message.id).length,1);}
      else{assert.match(ack.error,/메시지.*(문자|입력|300)/,'validation error must explain usable text/length');assert.equal(record.writeDelta,0,'invalid input must never reach persistence');assert.equal(record.senderDelta,0);assert.equal(record.observerDelta,0);assert.deepEqual(after.ids,before.ids,'invalid input must not mutate history');}
      record.passed=true;console.log('PASS '+name);
    }catch(error){record.passed=false;record.failure=error.message;console.error('FAIL '+name+': '+error.message);}
    checks.push(record);
  }
  await check('exactly 300 characters accepted once','가'.repeat(300),true);
  await check('301 characters rejected before persistence or broadcast','x'.repeat(301),false);
  for(const [name,value] of [['null',null],['number',42],['object',{}],['array',[]],['boolean',true],['missing',undefined],['empty',''],['blank',' \n\t ']])await check(name+' rejected with actionable ACK',value,false);
  await check('raw 301 characters cannot bypass bound through trim',' '+ 'x'.repeat(299)+' ',false);
  await check('valid padded 300 characters preserve trim',' '+ 'x'.repeat(298)+' ',true);
  await check('UTF16 300 limit matches native input maxlength','😀'.repeat(150),true);
  await check('UTF16 302 rejected','😀'.repeat(151),false);
  await check('valid message after all failures proves process survival','next valid message',true);
}finally{
  roomRepository.saveRoom=save;
  if(code)delete rooms[code];
  clients.forEach(client=>client.disconnect());
  await new Promise(resolve=>io.close(resolve));
  const out=process.env.CHAT_SOCKET_EVIDENCE||'.omo/evidence/ui-ux/task-4a-socket-results.json';
  mkdirSync('.omo/evidence/ui-ux',{recursive:true});writeFileSync(out,JSON.stringify({invocation:'node tests/room_chat_socket.test.js',memoryOnly:true,cleanup:{clientsDisconnected:true,ephemeralServerClosed:true,repositoryRestored:true},checks},null,2));
}
if(checks.some(check=>!check.passed))process.exitCode=1;
