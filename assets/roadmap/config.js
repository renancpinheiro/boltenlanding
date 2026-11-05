// Configuração pública do roadmap. Só valores públicos entram aqui:
// a URL do projeto e a chave publishable (sb_publishable_..., a antiga "anon") do Supabase
// e a site key do Turnstile. A chave secret (sb_secret_...) nunca entra aqui.
// Nenhuma chave secreta (service role, Anthropic, sal dos hashes) vai para este arquivo.
//
// Enquanto supabaseUrl estiver vazio, a página usa os dados de exemplo
// de assets/roadmap/dados-exemplo.js e não grava nada.
window.ROADMAP_CONFIG = {
  supabaseUrl: "https://jrigjnrwmvmkgybingdg.supabase.co",
  supabaseAnonKey: "sb_publishable_M5p-Z91YUXQLn8-X6EDleA_AdwrFFH5",
  turnstileSiteKey: ""
};
