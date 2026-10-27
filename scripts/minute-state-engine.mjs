// FootyEdge Original: experimental minute-state generator. All unknown telemetry stays null.
// Designed for optional verified player event profiles; no tracking-data claims.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function simulateMinuteMatch({home,away,rand,minutes=90}){
 if(typeof rand!=="function")throw Error("Seeded random generator required");
 for(const t of [home,away]){
  if(!t||!Number.isFinite(t.goalRate)||t.goalRate<0||t.goalRate>5)throw Error("Verified baseline goalRate required");
 }
 const goals=[0,0],events=[],teams=[home,away];let zone=1,possessor=rand()<.5?0:1;
 for(let minute=1;minute<=minutes;minute++){
  const attacking=teams[possessor],defending=teams[1-possessor];
  const press=clamp(Number.isFinite(defending.ppda)?10/Math.max(3,defending.ppda):1,.5,2);
  const stamina=(minute>=75?0.86:minute>=60?0.94:1);
  const intensity=clamp((attacking.tempo??1)*stamina,.5,1.5);
  const zoneBoost=Number.isFinite(attacking.zoneDominance)?clamp(attacking.zoneDominance,.7,1.3):1;
  const defensiveFriction=Number.isFinite(defending.defensiveZoneStrength)?clamp(defending.defensiveZoneStrength,.7,1.3):1;
  const advance=clamp(.30*intensity*zoneBoost/(press*defensiveFriction),.05,.8);
  if(rand()<advance)zone=Math.min(3,zone+1);
  if(zone===3){
   const chance=clamp(attacking.goalRate/90*3.0*intensity*zoneBoost/defensiveFriction,0,.2);
   const shot=rand()<clamp(chance*9,0,.9);
   if(shot){
    const xg=clamp(chance/Math.max(.01,clamp(chance*9,0,.9)),.005,.7);
    const goal=rand()<xg;
    events.push({minute,team:possessor,type:"shot",xg,goal});
    if(goal)goals[possessor]++;
   }
   zone=1;possessor=1-possessor;
  }else if(rand()<.22*press){possessor=1-possessor;zone=1}
 }
 return {homeGoals:goals[0],awayGoals:goals[1],events};
}
