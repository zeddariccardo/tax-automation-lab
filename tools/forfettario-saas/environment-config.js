// The artifact supplies an immutable binding separately from runtime configuration.
export function validateEnvironment(config, binding) {
  if (!config || !binding || !['development','production'].includes(binding.environment)
    || config.environment !== binding.environment || config.supabaseUrl !== binding.supabaseUrl
    || config.saasOrigin !== binding.saasOrigin) throw Error('ENVIRONMENT_MISMATCH');
  const app=new URL(config.saasOrigin),api=new URL(config.supabaseUrl);
  if(app.origin!==config.saasOrigin || api.origin!==config.supabaseUrl)throw Error('ORIGIN_INVALID');
  if(binding.environment==='production' && (app.protocol!=='https:' || api.protocol!=='https:'
    || /localhost|^127\.|^\[::1\]$/.test(app.hostname)
    || config.saasOrigin===binding.publicSiteOrigin || config.studioMfa!==true))throw Error('PRODUCTION_CONFIG_INVALID');
  return config;
}
