(function(){
 // ESPN Sporting player 272722 is FotMob's Colombian forward 792303.
 const corrections=[{
  id:"272722",teamId:"2250",
  names:["luis suarez","suarez","luis javier suarez charris"],
  url:"https://images.fotmob.com/image_resources/playerimages/792303.png"
 }];
 function correctedPlayerPhoto(id,name,teamId){
  const normalized=String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const match=corrections.find(player=>
   (id?player.id===String(id):player.teamId===String(teamId))&&
   (!teamId||player.teamId===String(teamId))&&player.names.includes(normalized));
  return match?.url||"";
 }
 if(typeof module==="object")module.exports=correctedPlayerPhoto;
 else window.FE_CORRECTED_PLAYER_PHOTO=correctedPlayerPhoto;
})();
