import axios from 'axios';
const client=axios.create({baseURL:'/api/public/invitations',withCredentials:true,timeout:15000});
export const invitationApi={session:async()=>(await client.get('/session')).data,puzzle:async()=>(await client.get('/puzzle')).data,open:async()=>(await client.post('/open')).data,solve:async(durationSeconds)=>(await client.post('/solve',{durationSeconds})).data,respond:async(value,key)=>(await client.put('/response',value,{headers:{'Idempotency-Key':key}})).data};
