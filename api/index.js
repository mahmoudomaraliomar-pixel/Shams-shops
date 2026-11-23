const U=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,T=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
const r=async c=>(await(await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+T},body:JSON.stringify(c)})).json()).result;
const L=async k=>{const a=(await r(['HGETALL',k]))||[],o=[];for(let i=1;i<a.length;i+=2)o.push(JSON.parse(a[i]));return o.sort((x,y)=>y.id-x.id)};
const K=['cats','products','orders'],HOLD=['تم التأكيد','تم الشحن','تم التسليم'];
const G=async(k,id)=>{const v=await r(['HGET',k,String(id)]);return v?JSON.parse(v):null};
const need=o=>{const m={};for(const i of o.items)m[i.pid]=(m[i.pid]||0)+i.q;return m};
const adj=async(o,sg)=>{for(const[id,q]of Object.entries(need(o))){const p=await G('products',id);if(p&&p.stock!=null){p.stock=Math.max(0,p.stock+sg*q);await r(['HSET','products',String(p.id),JSON.stringify(p)])}}};
export default async(q,s)=>{const a=q.query.a,b=q.body||{},ok=process.env.ADMIN_PASSWORD&&q.headers['x-admin']===process.env.ADMIN_PASSWORD;
try{
if(q.method==='GET'){if(!K.includes(a))return s.status(400).json({});if(a==='orders'&&!ok)return s.status(401).json({});return s.json(await L(a))}
if(a==='neworder'){const ps=await L('products'),items=[];
for(const i of b.items||[]){const p=ps.find(x=>x.id==i.id);if(p)items.push({pid:p.id,name:p.name,size:i.size||'',q:Math.max(1,+i.q|0),price:Math.round(p.price*(1-(p.disc||0)/100))})}
if(!items.length||!b.name||!b.phone)return s.status(400).json({});
for(const[id,q]of Object.entries(need({items}))){const p=ps.find(x=>x.id==id);if(p&&p.stock!=null&&p.stock<q)return s.status(409).json({error:'stock',name:p.name,left:p.stock})}
const o={id:Date.now(),date:new Date().toISOString(),status:'جديد',name:b.name,phone:b.phone,city:b.city,address:b.address,note:b.note||'',items,total:items.reduce((t,i)=>t+i.price*i.q,0)};
await r(['HSET','orders',String(o.id),JSON.stringify(o)]);return s.json({id:o.id})}
if(!ok)return s.status(401).json({});
if(a==='status'){const o=await G('orders',b.id);if(!o)return s.status(404).json({});const want=HOLD.includes(b.status);
if(want&&!o.held){for(const[id,q]of Object.entries(need(o))){const p=await G('products',id);if(p&&p.stock!=null&&p.stock<q)return s.status(409).json({error:'stock',name:p.name,left:p.stock})}await adj(o,-1);o.held=true}
else if(!want&&o.held){await adj(o,1);o.held=false}
o.status=b.status;await r(['HSET','orders',String(o.id),JSON.stringify(o)]);return s.json({ok:1})}
if(!K.includes(a))return s.status(400).json({});
if(a==='orders'&&b.op==='del'){const o=await G('orders',b.id);if(o&&o.held)await adj(o,1)}
await r(b.op==='del'?['HDEL',a,String(b.id)]:['HSET',a,String(b.item.id),JSON.stringify(b.item)]);return s.json({ok:1})
}catch(e){return s.status(500).json({})}}
