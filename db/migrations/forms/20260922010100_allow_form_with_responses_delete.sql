-- A tela deixa claro que excluir o formulário remove também as respostas. A primeira chave usava `restrict`,
-- o que protegia o histórico, mas contradizia a ação e ainda impedia apagar um projeto que tivesse recebido
-- formulário. O cliente criado pela resposta continua na base porque o vínculo dele é independente.
alter table public.intake_form_submissions
  drop constraint intake_form_submissions_form_id_fkey,
  add constraint intake_form_submissions_form_id_fkey
    foreign key (form_id) references public.intake_forms (id) on delete cascade;
