-- O identificador que a pessoa lê é preenchido pelo gatilho, e não por quem escreve: sem um valor padrão na
-- coluna, o tipo gerado de `Insert` o exige em toda inserção, e cada escrita teria de mandar uma string vazia
-- só para o TypeScript deixar passar. O padrão vazio diz a verdade sobre quem preenche.

alter table public.clients alter column reference set default '';
alter table public.catalog_items alter column reference set default '';
alter table public.projects alter column reference set default '';
alter table public.quotes alter column reference set default '';
alter table public.crm_funnels alter column reference set default '';
alter table public.opportunities alter column reference set default '';
alter table public.contracts alter column reference set default '';
alter table public.charges alter column reference set default '';
alter table public.transactions alter column reference set default '';
alter table public.tasks alter column reference set default '';

-- O resumo do token também nasce no servidor, mas ele é obrigatório de verdade: linha sem ele seria um
-- documento público que nenhum link acha. O `check` garante o formato, e o padrão não existe de propósito.
