export const LIVE_PUBLIC = 'slogan:live:public';
export const LIVE_EXPIRIES = 'slogan:live:presence-expiries';
export const liveOwner = (id: string) => `slogan:live:owner:${id}`;
export const publishLive = `
if redis.call('EXISTS',KEYS[2])==1 then return 0 end
redis.call('XADD',KEYS[1],'MAXLEN','~',1000,'*','scope',ARGV[1])
redis.call('EXPIRE',KEYS[1],3600)
redis.call('SET',KEYS[2],'1','EX',3600)
return 1`;
export const renewLivePresence = `
local prior=redis.call('EXISTS',KEYS[1])
redis.call('SET',KEYS[1],'1','EX',ARGV[2])
local now=redis.call('TIME')
redis.call('ZADD',KEYS[3],now[1]*1000+math.floor(now[2]/1000)+ARGV[2]*1000,ARGV[1])
if prior==0 then
 redis.call('XADD',KEYS[2],'MAXLEN','~',1000,'*','scope','partners')
 redis.call('EXPIRE',KEYS[2],3600)
end
return prior`;
export const expireLivePresence = `
local generation=ARGV[2]
if generation and redis.call('GET',KEYS[4])~=generation then return -1 end
local ttl=redis.call('PTTL',KEYS[1])
if ttl>0 then
 if generation then redis.call('PEXPIRE',KEYS[4],math.max(300000,ttl*3)) end
 return ttl
end
if generation then redis.call('DEL',KEYS[4]) end
if redis.call('ZREM',KEYS[3],ARGV[1])==1 then
 redis.call('XADD',KEYS[2],'MAXLEN','~',1000,'*','scope','partners')
 redis.call('EXPIRE',KEYS[2],3600)
end
return 0`;
