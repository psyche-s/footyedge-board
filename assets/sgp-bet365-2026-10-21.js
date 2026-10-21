(() => {
  const add=(parent,tag,cls,label)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(label!==undefined)el.textContent=String(label);
    parent.appendChild(el);return el;
  };
  const style=add(document.head,"style");
  style.textContent=".ticketPaper .feBoost{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#e4f1e7;border:1px solid #b9d5c2;border-radius:12px;padding:13px;margin:0 0 12px}.ticketPaper .feBoost small{font-size:10px;font-weight:850;color:#607568}.ticketPaper .feBoost strong{display:block;font-size:27px;font-weight:950;color:#108452}.ticketPaper .fePayout{grid-column:1/-1;border-top:1px solid #bad0bd;padding-top:9px;font-size:11px;line-height:1.55;color:#496050}.ticketPaper .feCombined{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid #c7dac9;padding:10px;border-radius:9px;margin:8px 0;font-size:11px;color:#506956}.ticketPaper .feCombined strong{font-size:23px;font-weight:950;color:#138a53}.ticketPaper .feBetLeg{padding:14px 0;border-bottom:1px solid #d8d0c6}.ticketPaper .feBetLegHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.ticketPaper .feBetLegHead b{font-size:16px;line-height:1.4;color:#161b17}.ticketPaper .feBetLegHead em{font-style:normal;white-space:nowrap;font-size:13px;font-weight:950;color:#168452;background:#e6f2e8;border-radius:7px;padding:5px 7px}.ticketPaper .feBetLeg small{display:block;font-size:10px;color:#807970;margin-top:4px}.ticketPaper .feBetLeg p{font-size:11px;color:#526153;line-height:1.6;margin:9px 0 0}.ticketPaper .feBetLink{display:flex;min-height:45px;align-items:center;justify-content:center;background:#138251;color:white;text-decoration:none;border-radius:10px;padding:12px;font-size:12px;font-weight:900;text-align:center;margin-top:15px}.ticketPaper .feBetNote{font-size:10px;line-height:1.6;color:#777168;margin:12px 0 0}";
  const old=renderDesk;
  renderDesk=function(desk,date,live){
    old(desk,date,live);
    const s=desk?sgpForLeague(desk):null,offer=s?.bookmakerOffer;
    if(!offer||!Array.isArray(s.legs)||s.legs.length!==4||desk.date!==date)return;
    const box=document.getElementById("sgpSlip");box.replaceChildren();
    const odds=add(box,"div","feBoost");
    const a=add(odds,"div");add(a,"small","","BET365 REGULAR");add(a,"strong","",offer.displayOdds);
    const b=add(odds,"div");add(b,"small","",offer.profitBoostPercent+"% PROFIT BOOST");add(b,"strong","",offer.boostedOdds);
    add(odds,"div","fePayout","$"+Number(offer.stakeExampleCAD).toFixed(2)+" CAD wager → $"+Number(offer.returnExampleCAD).toFixed(2)+" CAD potential return (including $"+Number(offer.boostExampleCAD).toFixed(2)+" boost)");
    const summary=add(box,"div","feCombined");add(summary,"span","","Overall SGP confidence · indicative");add(summary,"strong","",s.combinedConfidencePercent+"%");
    s.legs.forEach((leg,i)=>{
      const section=add(box,"section","feBetLeg"),head=add(section,"div","feBetLegHead"),label=add(head,"div");
      add(label,"b","",(i+1)+". "+leg.label);add(label,"small","",leg.category);
      add(head,"em","",(leg.confidencePercent??leg.rating)+"%");
      add(section,"p","",cleanReason(leg.why));
    });
    if(offer.url==="https://www.on.bet365.ca/s/r/gFzcf"){
      const link=add(box,"a","feBetLink","Add to Your Bet Slip ↗");
      link.href=offer.url;link.target="_blank";link.rel="noopener noreferrer nofollow";
    }
    document.getElementById("sgpTitle").textContent="SPORTING × LASK SGP";
    document.getElementById("sgpMeta").textContent="BET365 · UCL · WED OCT 21";
    document.getElementById("sgpLegBadge").textContent="4 LEGS";
    document.getElementById("sgpIntro").textContent="Sporting CP vs LASK Linz · Wed Oct 21 · 3:00 PM ET";
    document.getElementById("sgpCount").textContent="4 LEGS · "+s.combinedConfidencePercent+"% INDICATIVE CONFIDENCE";
    const caution=document.getElementById("sgpCaution");caution.textContent="";caution.hidden=true;
  };
})();