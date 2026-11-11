import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { db } from './store.js';
try {
  const config=loadConfig();
  await db.$connect();
  if(process.env.CATALOG_SOURCE !== 'legacy') console.log(`[node] Live catalog: public.products (${await db.liveProduct.count({where:{is_active:true}})} active products); reviews: public.reviews`);
  const server=createApp(config).listen(config.port,config.host,()=>console.log(`Veyrix commerce listening on ${config.host}:${config.port}`));
  server.on('error',()=>{console.error('The commerce listener could not start. Check its host and port.');void db.$disconnect().finally(()=>process.exit(1));});
  for(const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>{server.close(()=>{void db.$disconnect().finally(()=>process.exit(0));});});
} catch {
  console.error('The commerce service could not start. Check setup/node/.env, database connectivity, and the installed schema.');
  await db.$disconnect();process.exitCode=1;
}
