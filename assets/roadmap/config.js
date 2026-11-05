// Configuração pública do roadmap. Só valores públicos entram aqui:
// a URL do projeto e a chave anon (publishable) do Supabase e a site key do Turnstile.
// Nenhuma chave secreta (service role, Anthropic, sal dos hashes) vai para este arquivo.
//
// Enquanto supabaseUrl estiver vazio, a página usa os dados de exemplo
// de assets/roadmap/dados-exemplo.js e não grava nada.
window.ROADMAP_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  turnstileSiteKey: ""
};
