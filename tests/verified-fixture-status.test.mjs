import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedFixtureStatuses} from '../assets/verified-fixture-status.mjs';
const event=(id='401928518',date='2026-11-04T18:00Z')=>({id,date,status:{type:{completed:false,state:'pre',name:'STATUS_SCHEDULED'}},competitions:[{}]});
test('official postponement updates the event and competition on the exact original day',()=>{
 const data={events:[event()]};applyVerifiedFixtureStatuses(data,'2026-11-04');
 assert.equal(data.events[0].status.type.name,'STATUS_POSTPONED');
 assert.equal(data.events[0].competitions[0].status.type.name,'STATUS_POSTPONED');
 assert.match(data.events[0].statusVerification.sourceUrl,/rfef.es/);
});
test('other fixtures, future rescheduled events and verified finals stay intact',()=>{
 const final=event();final.status.type={completed:true,state:'post',name:'STATUS_FULL_TIME'};
 const data={events:[event('other'),event('401928518','2026-11-10T18:00Z'),final]};
 const before=structuredClone(data);applyVerifiedFixtureStatuses(data,'2026-11-04');assert.deepEqual(data,before);
 const old={events:[event()]};const snapshot=structuredClone(old);applyVerifiedFixtureStatuses(old,'2026-11-05');assert.deepEqual(old,snapshot);
});
