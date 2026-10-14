import fs from "node:fs";
const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const date=process.env.BOARD_DATE||`${parts.year}-${parts.month}-${parts.day}`;
const board=JSON.parse(fs.readFileSync("data/boards/"+date+".json","utf8"));
if(board.date!==date||board.immutable!==true||!board.frozenAt||!Array.isArray(board.top5)||board.top5.length===0)throw Error("No valid frozen board to release");
const compact={schema:"footyedge-release-top5-v1",date:board.date,frozenAt:board.frozenAt,immutable:true,top5:board.top5};
fs.mkdirSync("published",{recursive:true});
fs.writeFileSync("published/footyedge-top5.json",JSON.stringify(compact));
console.log("Prepared immutable release projection",date,compact.top5.length);
