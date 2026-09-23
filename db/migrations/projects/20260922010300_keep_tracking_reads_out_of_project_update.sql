-- Abrir ou renovar o acompanhamento mexe apenas nas credenciais e na telemetria do link. Isso não é uma
-- edição do projeto e não pode mudar o "Atualizado em" que o cliente lê. O gatilho passa a observar somente
-- as colunas de conteúdo; as demais escritas continuam funcionando sem falsificar a data da entrega.
drop trigger if exists projects_set_updated_at on public.projects;

create trigger projects_set_updated_at
  before update of
    slug, name, url, description, is_public, client_id, owner_id, folder_id, status, tags, tools,
    budget_min, budget_max, started_at, due_at, progress, cover_url, hue, glyph, logo_url
  on public.projects
  for each row execute function public.set_updated_at();
