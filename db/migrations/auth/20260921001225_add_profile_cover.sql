-- A capa do perfil da pessoa (2026-09-20, a pedido da página da conta "super completa", sobre referências
-- de perfil de rede social): a foto larga atrás do rosto, no topo da ficha.
--
-- Mora em `profiles`, ao lado da foto, porque é da pessoa e não da equipe. O arquivo sobe para o mesmo balde
-- `user-avatars`, na pasta da pessoa, então as policies que já existem (só ela escreve na própria pasta, ler é
-- público) valem para a capa sem mudar nada.

alter table public.profiles
  add column cover_url text;

comment on column public.profiles.cover_url is
  'Endereço público da capa do perfil, no balde user-avatars, na pasta da pessoa.';
