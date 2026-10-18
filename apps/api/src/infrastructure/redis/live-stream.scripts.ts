export const LIVE_PUBLIC = 'slogan:live:public';
export const LIVE_EXPIRIES = 'slogan:live:presence-expiries';
export const liveOwner = (id: string) => `slogan:live:owner:${id}`;
export const dueLivePresence = `
local now=redis.call('TIME')
return redis.call('ZRANGEBYSCORE',KEYS[1],'-inf',now[1]*1000+math.floor(now[2]/1000),'LIMIT',0,100)`;
export const publishLive = `
if redis.call('EXISTS',KEYS[2])==1 then return 0 end
redis.call('XADD',KEYS[1],'MAXLEN','~',1000,'*','scope',ARGV[1],'resourceId',ARGV[2] or '','kind',ARGV[3] or '')
redis.call('EXPIRE',KEYS[1],3600)
redis.call('SET',KEYS[2],'1','EX',3600)
return 1`;
export const renewLivePresence = `
local previous=redis.call('SET',KEYS[1],'1','EX',ARGV[2],'GET')
local prior=previous and 1 or 0
local now=redis.call('TIME')
redis.call('ZADD',KEYS[3],now[1]*1000+math.floor(now[2]/1000)+ARGV[2]*1000,ARGV[1])
if prior==0 then
 redis.call('XADD',KEYS[2],'MAXLEN','~',1000,'*','scope','partners')
 redis.call('EXPIRE',KEYS[2],3600)
end
if #KEYS==4 then
 local generation=''
 if redis.call('SET',KEYS[4],ARGV[3],'EX',math.max(300,ARGV[2]*3),'NX') then generation=ARGV[3] end
 return {prior,generation}
end
return prior`;
export const expireLivePresence = `
local generation=ARGV[2]
if generation and redis.call('GET',KEYS[4])~=generation then return -1 end
local ttl=redis.call('PTTL',KEYS[1])
if ttl>0 then
 if generation then redis.call('PEXPIRE',KEYS[4],math.max(300000,ttl*3)) end
 if ARGV[3]=='deadline' then return {ttl,redis.call('ZSCORE',KEYS[3],ARGV[1]) or '0'} end
 return ttl
end
if generation then redis.call('DEL',KEYS[4]) end
if redis.call('ZREM',KEYS[3],ARGV[1])==1 then
 redis.call('XADD',KEYS[2],'MAXLEN','~',1000,'*','scope','partners')
 redis.call('EXPIRE',KEYS[2],3600)
end
return 0`;

/** Bounded takeover/failed-send repair. Replacing each chain fences its prior expiry delivery. */
export const repairLivePresence = `
local owners=redis.call('ZRANGE',KEYS[1],0,99)
local result={}
for _,owner in ipairs(owners) do
 local ttl=redis.call('PTTL','social:presence:'..owner)
 if ttl>0 then
  local generation=ARGV[1]..':'..owner
  redis.call('SET','slogan:live:presence-chain:'..owner,generation,'PX',math.max(300000,ttl*3))
  table.insert(result,owner) table.insert(result,tostring(ttl)) table.insert(result,generation)
 else
  redis.call('DEL','slogan:live:presence-chain:'..owner)
  if redis.call('ZREM',KEYS[1],owner)==1 then
   redis.call('XADD',KEYS[2],'MAXLEN','~',1000,'*','scope','partners')
   redis.call('EXPIRE',KEYS[2],3600)
  end
 end
end
return {redis.call('ZCARD',KEYS[1]),result}`;
