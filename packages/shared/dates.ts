/** Calendar dates at store midnight; settlement periods use [start,end). */
export function storeMidnight(date:string,timezone:string,followingDay=false) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Tanggal periode tidak valid');
  const [y,m,d]=date.split('-').map(Number),original=Date.UTC(y,m-1,d);
  if(new Date(original).toISOString().slice(0,10)!==date)throw new Error('Tanggal periode tidak valid');
  const target=original+(followingDay?86400000:0);
  const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let epoch=target;
  for(let i=0;i<3;i++) {
    const parts=Object.fromEntries(fmt.formatToParts(new Date(epoch)).map(p=>[p.type,p.value]));
    epoch+=target-Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
  }
  return epoch;
}
