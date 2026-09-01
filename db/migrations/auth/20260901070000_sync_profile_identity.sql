-- A foto e o nome vindos do Google e do GitHub só eram copiados no insert do usuário, então quem
-- criou a conta por e-mail e só depois entrou por um provedor ficava sem foto para sempre. O gotrue
-- atualiza raw_user_meta_data quando a identidade é vinculada, e é isso que este gatilho escuta.
-- Só preenche o que está vazio: o que a pessoa definir no produto não pode ser sobrescrito pelo provedor.
create or replace function public.handle_user_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    full_name = coalesce(
      full_name,
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    avatar_url = coalesce(
      avatar_url,
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    email = coalesce(new.email, email)
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_identity_changed
  after update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_user_identity();

revoke execute on function public.handle_user_identity() from public, anon;
