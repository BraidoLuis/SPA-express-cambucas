import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [psql, portValue, resultDir] = process.argv.slice(2);
if (!psql || !path.isAbsolute(psql) || !/^\d+$/.test(portValue ?? '') || !resultDir) {
  throw Error('Uso: node tests/postgres/run-payment-postgres-tests.mjs CAMINHO_PSQL PORTA PASTA_RESULTADOS');
}
const port = Number(portValue);
if (port < 1024 || port > 65535) throw Error('Porta local inválida.');
const common = ['-X','-q','-t','-A','-h','127.0.0.1','-p',String(port),'-d','spa_payment_test','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
const actor = n => '10000000-0000-4000-8000-' + String(n).padStart(12,'0');
const pro = actor(1), admin = actor(2);
const report = { startedAt: new Date().toISOString(), engine: null, sourceHashes: {}, assertions: [], concurrency: [], errors: [], differences: [
  'Modelo mínimo de colunas/defaults de apoio, não dump completo de produção.',
  'auth.users contém apenas UUIDs fictícios; auth.uid() usa GUCs de sessão, sem GoTrue/JWT/PostgREST.',
  'Servidor local Windows/locale C/UTC; Supabase é Linux gerenciado.',
  'spa_test_root é superuser apenas para bootstrap/inspeção; owner postgres dos RPCs é NOSUPERUSER/BYPASSRLS como na auditoria.',
  'Sem Storage, Realtime, workers, crons ou provedor de e-mail; filas dos triggers permanecem no banco fictício.'
] };
fs.mkdirSync(resultDir,{recursive:true});
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const file of ['tests/postgres/payment-local-bootstrap.sql','tests/postgres/payment-local-fixtures.sql','docs/sql/payment-concurrency-apply.sql','docs/sql/payment-concurrency-verify.sql','docs/sql/payment-concurrency-rollback.sql','tests/sql/payment-concurrency-regression.sql']) report.sourceHashes[file]=hash(file);
const raw = (sql, user='spa_test_root') => cp.spawnSync(psql,[...common,'-U',user],{input:sql,encoding:'utf8',timeout:20000});
function query(sql,user) {
  const r=raw(sql,user);
  if(r.status!==0) throw Error('psql falhou ('+r.status+'): '+r.stderr);
  return r.stdout.trim();
}
const object = sql => JSON.parse(query(sql).split(/\r?\n/).filter(Boolean).at(-1));
const claims = uid => "select set_config('request.jwt.claim.sub','"+uid+"',true); select set_config('request.jwt.claims','{\"sub\":\""+uid+"\",\"role\":\"authenticated\"}',true); set local role authenticated;";
const begin = uid => "begin; set local lock_timeout='10s'; set local statement_timeout='20s'; "+claims(uid);
const complete = id => "select 'RPC='||public.complete_professional_appointment('"+id+"',true,'dinheiro','Profissional teste')::text;";
const cancel = id => "select to_jsonb(public.update_professional_appointment_status('"+id+"','cancelled','Motivo teste'));";
const pay = id => "with changed as (update public.payments set status='paid',method='pix',notes='Admin teste',confirmed_by=auth.uid(),paid_at=now(),updated_at=now() where appointment_id='"+id+"' and status='pending' returning *) select 'PAY='||to_jsonb(changed)::text from changed;";
const state = id => object("select jsonb_build_object('status',a.status,'payment',(select to_jsonb(p) from payments p where p.appointment_id=a.id),'audits',(select jsonb_agg(to_jsonb(l) order by l.id) from audit_logs l where l.entity_id=a.id::text),'notifications',(select jsonb_agg(to_jsonb(n) order by n.id) from notifications n where n.appointment_id=a.id)) from appointments a where a.id='"+id+"';");
const baseOffset=Number(query("select coalesce(ceil(extract(epoch from(now()-min(start_at)))/3600),0)+10 from appointments;"));
let seq=0;
function fixture() {
  const id=crypto.randomUUID(), offset=baseOffset+(seq++)*2;
  query("insert into appointments(id,client_id,client_name,professional_id,service_id,start_at,end_at,status,outside_schedule,created_by) values('"+id+"','"+actor(4)+"','Cliente ficticia','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now()-interval '"+offset+" hours',now()-interval '"+(offset-1)+" hours','confirmed',true,'"+admin+"');");
  return id;
}
const auditCount = s => (s.audits??[]).length;
const noticeCount = (s,type) => (s.notifications??[]).filter(n=>n.notification_type===type).length;
const tagged = (s,prefix) => JSON.parse(s.split(/\r?\n/).find(line=>line.startsWith(prefix)).slice(prefix.length));
function pass(name, evidence={}) { report.assertions.push({name,passed:true,...evidence}); console.log('PASS '+name); }

class Session {
  constructor(name) {
    this.name=name; this.out=''; this.err=''; this.exited=false;
    this.child=cp.spawn(psql,[...common,'-U','authenticator'],{env:{...process.env,PGAPPNAME:name},stdio:['pipe','pipe','pipe']});
    this.child.stdout.on('data',b=>this.out+=b.toString());
    this.child.stderr.on('data',b=>this.err+=b.toString());
    this.done=new Promise(resolve=>{
      this.child.on('error',e=>{this.err+=e.message;this.exited=true;resolve(-1);});
      this.child.on('exit',code=>{this.exited=true;resolve(code);});
    });
  }
  send(sql) { this.child.stdin.write(sql+'\n'); }
  close() { if(!this.exited) this.child.stdin.end('\\quit\n'); }
  async marker(text) {
    const start=Date.now();
    while(!this.out.includes(text)) {
      if(this.exited || Date.now()-start>12000) throw Error('Barreira não atingida '+text+': '+this.err);
      await new Promise(r=>setTimeout(r,20));
    }
  }
}
async function blocked(a,b) {
  const start=Date.now();
  while(Date.now()-start<8000) {
    const s=object("select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'wait',wait_event_type,'blockers',pg_blocking_pids(pid))), '[]'::jsonb) from pg_stat_activity where application_name in ('"+a.name+"','"+b.name+"');");
    const ap=object("select coalesce(jsonb_agg(pid),'[]'::jsonb) from pg_stat_activity where application_name='"+a.name+"';")[0];
    const waiting=s.find(row=>row.wait==='Lock'&&row.blockers.includes(ap));
    if(waiting) return {waiterPid:waiting.pid,blockerPid:ap,waitEventType:'Lock',observedAt:new Date().toISOString()};
    if(b.exited) throw Error('Sessão B terminou antes de esperar: '+b.err);
    await new Promise(r=>setTimeout(r,30));
  }
  throw Error('Espera real no PostgreSQL não observada.');
}
async function concurrency(name,aMode,bMode,expected) {
  const id=fixture(), before=state(id);
  const suffix=crypto.randomUUID().slice(0,8);
  const a=new Session('spa-payment-'+suffix+'-A'), b=new Session('spa-payment-'+suffix+'-B');
  try {
    const aActor=aMode==='admin'?admin:pro;
    const first=aMode==='admin'?"select id from payments where appointment_id='"+id+"' for no key update;":aMode==='complete'?complete(id)+" select 'PAY='||to_jsonb(p)::text from payments p where appointment_id='"+id+"';":cancel(id);
    a.send(begin(aActor)+first+"\n\\echo A_LOCKED\n");
    await a.marker('A_LOCKED');
    b.send(begin(bMode==='admin'?admin:pro)+(bMode==='admin'?
      "with changed as(update payments set status='paid',method='pix',notes='Admin B',confirmed_by=auth.uid(),paid_at=now(),updated_at=now() where appointment_id='"+id+"' and status='pending' returning *) select 'ROWS='||count(*) from changed;":
      bMode==='complete'?complete(id):cancel(id))+" commit;\n\\echo B_DONE\n");
    const evidence=await blocked(a,b);
    a.send((aMode==='admin'?pay(id):'')+"commit;\n\\echo A_DONE\n");
    a.close();b.close();
    const [ac,bc]=await Promise.all([a.done,b.done]);
    assert.equal(ac,0,a.err);
    if(expected==='denied') {
      assert.notEqual(bc,0);
      assert.match(b.err,/P0001/);
      assert.doesNotMatch(b.err,/40P01|55P03|57014/);
    } else assert.equal(bc,0,b.err);
    const after=state(id);
    if(aMode==='cancel') {
      assert.equal(after.status,'cancelled');assert.equal(after.payment.status,'cancelled');
      assert.equal(auditCount(after),auditCount(before)+1);
      assert.equal(noticeCount(after,'appointment_cancelled'),3);
    } else {
      assert.equal(after.status,'completed');assert.equal(after.payment.status,'paid');
      assert.deepEqual(after.payment,tagged(a.out,'PAY='));
      assert.equal(after.payment.amount,before.payment.amount);
      assert.equal(auditCount(after),auditCount(before)+1);
      assert.equal(noticeCount(after,'admin_payment_confirmed'),1);
      assert.equal(noticeCount(after,'admin_appointment_completed'),1);
    }
    if(aMode==='admin') {
      assert.equal(tagged(b.out,'RPC=').payment_updated,false);
      assert.equal(after.payment.confirmed_by,admin);
    }
    if(bMode==='admin') assert.match(b.out,/ROWS=0/);
    report.concurrency.push({name,passed:true,connections:2,barrier:evidence,sessionAExit:ac,sessionBExit:bc,sessionBSQLState:bc===0?null:'P0001',finalStatus:after.status,finalPaymentStatus:after.payment.status});
    pass(name);
    fs.writeFileSync(path.join(resultDir,name+'.log'),'A stdout\n'+a.out+'\nA stderr\n'+a.err+'\nB stdout\n'+b.out+'\nB stderr\n'+b.err);
  } finally { a.close();b.close(); if(!a.exited)a.child.kill();if(!b.exited)b.child.kill(); }
}
function file(file,vars={}) {
 const r=cp.spawnSync(psql,[...common,'-U','spa_test_root',...Object.entries(vars).flatMap(([k,v])=>['-v',k+'='+v]),'-f',file],{encoding:'utf8',timeout:30000});
 fs.writeFileSync(path.join(resultDir,path.basename(file)+'.log'),r.stdout+r.stderr);
 assert.equal(r.status,0,r.stderr);
 pass(file,{exitCode:r.status});
}
const regressionVars={appointment_id:'40000000-0000-4000-8000-000000000001',professional_id:pro,admin_id:admin,inactive_id:actor(3),client_id:actor(4),unlinked_id:actor(5),other_professional_id:actor(6),inactive_link_id:actor(7)};
try {
 const engine=object("select jsonb_build_object('version',version(),'database',current_database(),'host',inet_server_addr(),'port',inet_server_port(),'clusterRoot',current_user,'isSuperuser',current_setting('is_superuser'),'ownerIsSuperuser',(select rolsuper from pg_roles where rolname='postgres'),'ownerBypassRLS',(select rolbypassrls from pg_roles where rolname='postgres'));");
 assert.equal(engine.database,'spa_payment_test');assert.equal(engine.host,'127.0.0.1');assert.match(engine.version,/PostgreSQL 17\.6 /);
 assert.equal(engine.ownerIsSuperuser,false);assert.equal(engine.ownerBypassRLS,true);report.engine=engine;
 // Comparar triggers/constraints/policies com a origem do bootstrap não é prova de produção:
 // os hashes de produção foram confirmados pelo usuário, não por uma conexão remota.
 file('docs/sql/payment-concurrency-verify.sql');
 const acl=object("select jsonb_object_agg(r.rolname||':'||p.proname,has_function_privilege(r.oid,p.oid,'EXECUTE')) from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace where r.rolname in ('anon','authenticated','service_role') and n.nspname='public' and p.proname in ('complete_professional_appointment','update_professional_appointment_status');");
 for(const [key,value] of Object.entries(acl)) assert.equal(value,key.startsWith('authenticated:'));
 pass('ACL dos dois RPCs',{acl});
 const principalBefore=state(regressionVars.appointment_id);
 file('tests/sql/payment-concurrency-regression.sql',regressionVars);
 assert.deepEqual(state(regressionVars.appointment_id),principalBefore);
 pass('ROLLBACK transacional preservou atendimento/pagamento/auditoria/notificações');
 const paidId=fixture();
 query(begin(admin)+pay(paidId)+'commit;','authenticator');
 const paidBefore=state(paidId);
 const result=tagged(query(begin(pro)+complete(paidId)+'commit;','authenticator'),'RPC=');
 assert.equal(result.payment_updated,false);
 assert.deepEqual(state(paidId).payment,paidBefore.payment);
 pass('Admin confirmou antes; pagamento preservado integralmente');
 const directId=fixture();
 const direct=raw(begin(pro)+"with changed as(update payments set method='outro',notes='Tentativa direta',amount=999 where appointment_id='"+directId+"' returning *) select count(*) from changed; rollback;",'authenticator');
 assert.equal(direct.status,0,direct.stderr);assert.match(direct.stdout,/\b0\b/);
 assert.equal(state(directId).payment.method,null);assert.equal(state(directId).payment.amount,123.45);
 pass('UPDATE direto profissional de payments bloqueado');
 for(const [name,prepare,restore] of [
  ['Perfil dono inativo',"update profiles set active=false where id='"+pro+"'","update profiles set active=true where id='"+pro+"'"],
  ['Vínculo dono inativo',"update professionals set active=false where profile_id='"+pro+"'","update professionals set active=true where profile_id='"+pro+"'"],
  ['Perfil cliente com vínculo dono',"update profiles set role='client' where id='"+pro+"'","update profiles set role='professional' where id='"+pro+"'"],
  ['Perfil admin com vínculo dono',"update profiles set role='admin' where id='"+pro+"'","update profiles set role='professional' where id='"+pro+"'"]
 ]) {
   const id=fixture(), before=state(id);query(prepare);
   try {
     for(const operation of [complete(id),cancel(id)]) {
       const denied=raw(begin(pro)+operation+'commit;','authenticator');
       assert.notEqual(denied.status,0);assert.match(denied.stderr,/42501/);
       assert.deepEqual(state(id),before);
     }
     pass(name+' rejeitado pelos dois RPCs');
   } finally {query(restore);}
 }
 for(const role of ['anon','service_role']) {
  for(const operation of [complete(directId),cancel(directId)]) {
   const denied=raw("begin;set local role "+role+";"+operation+"commit;",'authenticator');
   assert.notEqual(denied.status,0);assert.match(denied.stderr,/42501/);
  }
  pass('EXECUTE negado para '+role);
 }
 await concurrency('admin_durante_conclusao','admin','complete','success');
 await concurrency('profissional_antes_admin','complete','admin','success');
 await concurrency('duas_conclusoes','complete','complete','denied');
 await concurrency('cancelamento_antes_conclusao','cancel','complete','denied');
 await concurrency('conclusao_antes_cancelamento','complete','cancel','denied');
 // Revogação começa antes do RPC, que deve validar a versão após esperar o lock.
 for(const table of ['profiles','professionals']) {
   const id=fixture(), before=state(id), suffix=crypto.randomUUID().slice(0,8);
   const a=new Session('spa-payment-'+suffix+'-A'),b=new Session('spa-payment-'+suffix+'-B');
   const condition=table==='profiles'?'id':'profile_id';
   try {
     a.send(begin(admin)+"update "+table+" set active=false where "+condition+"='"+pro+"';\n\\echo A_LOCKED\n");await a.marker('A_LOCKED');
     b.send(begin(pro)+complete(id)+'commit;\n');
     const evidence=await blocked(a,b);
     a.send('commit;\n');a.close();b.close();
     const [ac,bc]=await Promise.all([a.done,b.done]);
     assert.equal(ac,0,a.err);assert.notEqual(bc,0);assert.match(b.err,/42501/);assert.deepEqual(state(id),before);
     report.concurrency.push({name:table+'_inativado_enquanto_RPC_aguarda',passed:true,connections:2,barrier:evidence,sessionAExit:ac,sessionBExit:bc,sessionBSQLState:'42501'});
     pass(table+' revalidado após espera de lock');
   } finally {a.close();b.close();if(!a.exited)a.child.kill();if(!b.exited)b.child.kill();query("update "+table+" set active=true where "+condition+"='"+pro+"';");}
 }
 file('docs/sql/payment-concurrency-rollback.sql');
 const oldHashes=object("select jsonb_object_agg(proname,md5(replace(pg_get_functiondef(oid),E'\\r\\n',E'\\n'))) from pg_proc where oid in('public.complete_professional_appointment(uuid,boolean,text,text)'::regprocedure,'public.update_professional_appointment_status(uuid,public.appointment_status,text)'::regprocedure);");
 assert.equal(oldHashes.complete_professional_appointment,'943cea9e0ea657ace328db46d34ce47d');
 assert.equal(oldHashes.update_professional_appointment_status,'a59f05173ea6811e1c22e5eec3539ce9');
 pass('Rollback real restaurou os fingerprints originais',{hashes:oldHashes});
 file('docs/sql/payment-concurrency-apply.sql');
 file('docs/sql/payment-concurrency-verify.sql');
 file('tests/sql/payment-concurrency-regression.sql',regressionVars);
} catch(error) {
 report.errors.push({message:error.message,stack:error.stack});console.error(error);
 process.exitCode=1;
} finally {
 report.finishedAt=new Date().toISOString();report.passed=report.errors.length===0;
 fs.writeFileSync(path.join(resultDir,'payment-postgres-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,assertions:report.assertions.length,concurrencyCases:report.concurrency.length,resultDir}));
}
