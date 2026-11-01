// Read dimensions from the encoded image, never from a URL's advertised size.
function imageDimensions(bytes){
 const b=Buffer.from(bytes||[]);
 if(b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
  return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
 if(b.length>=30&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP"){
  const type=b.toString("ascii",12,16);
  if(type==="VP8X")return {width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
  if(type==="VP8L"&&b[20]===47){const bits=b.readUInt32LE(21);return {width:1+(bits&16383),height:1+((bits>>>14)&16383)};}
  if(type==="VP8 "&&b[23]===157&&b[24]===1&&b[25]===42)
   return {width:b.readUInt16LE(26)&16383,height:b.readUInt16LE(28)&16383};
 }
 if(b.length>4&&b[0]===255&&b[1]===216){
  let offset=2;
  while(offset+4<=b.length){
   if(b[offset++]!==255)continue;
   while(b[offset]===255)offset++;
   const marker=b[offset++];
   if(marker===217||marker===218)break;
   if(marker===1||(marker>=208&&marker<=215))continue;
   if(offset+2>b.length)break;
   const length=b.readUInt16BE(offset);
   if(length<2||offset+length>b.length)break;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)
    return {width:b.readUInt16BE(offset+5),height:b.readUInt16BE(offset+3)};
   offset+=length;
  }
 }
 return null;
}
function portraitScore(photo){
 const width=Number(photo?.width),height=Number(photo?.height);
 if(width>0&&height>0)return Math.min(width,height);
 // Conservative comparison for old records that predate dimension checks.
 const url=String(photo?.url||"");
 if(url.includes("/250x250/"))return 500;
 if(url.includes("/110x140/"))return 220;
 if(url.includes("images.fotmob.com"))return 192;
 return url?150:0;
}
function betterPortrait(candidate,previous){
 if(!candidate?.url)return previous||null;
 if(!previous?.url)return candidate;
 if(candidate.url===previous.url)return {...previous,...candidate};
 const delta=portraitScore(candidate)-portraitScore(previous);
 if(delta!==0)return delta>0?candidate:previous;
 // At equal resolution keep the current, checked reference stable.
 return previous;
}
module.exports={imageDimensions,portraitScore,betterPortrait};
