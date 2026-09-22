create function public.change_charge_payment(
  p_organization_id uuid,
  p_charge_id uuid,
  p_operation text,
  p_installment_id uuid default null,
  p_method public.payment_method default null,
  p_paid_on date default null
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_charge public.charges%rowtype;
  v_installment public.charge_installments%rowtype;
  v_transaction_id uuid;
  v_method public.payment_method;
  v_date date := coalesce(p_paid_on, (now() at time zone 'America/Sao_Paulo')::date);
begin
  if not public.can_write(p_organization_id) then
    raise exception 'Sem permissão para alterar o financeiro';
  end if;
  select * into v_charge from public.charges
    where id = p_charge_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Esse registro não existe mais'; end if;

  if p_operation = 'cancel' then
    if v_charge.cancelled_at is not null then return; end if;
    if exists (select 1 from public.charge_installments where charge_id = p_charge_id and paid_at is not null) then
      raise exception 'Há parcelas pagas e o registro não pode ser cancelado';
    end if;
    update public.charges set cancelled_at = now() where id = p_charge_id;
    insert into public.charge_events (organization_id, charge_id, kind)
      values (p_organization_id, p_charge_id, 'cancelled');
    return;
  end if;

  if v_charge.cancelled_at is not null then raise exception 'Esse registro foi cancelado'; end if;
  select * into v_installment from public.charge_installments
    where id = p_installment_id and charge_id = p_charge_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Essa parcela não existe mais'; end if;

  if p_operation = 'pay' then
    if v_installment.paid_at is not null then raise exception 'Essa parcela já foi baixada'; end if;
    v_method := coalesce(p_method, v_charge.method);
    insert into public.transactions (
      organization_id, kind, status, title, description, amount, date,
      method_type, method_label, visual_type, visual_avatar_url, charge_id, created_by
    ) values (
      p_organization_id,
      case when v_charge.direction = 'outgoing' then 'expense'::public.transaction_kind else 'income'::public.transaction_kind end,
      'confirmed', coalesce(v_charge.client_company, v_charge.client_name, v_charge.title),
      'Parcela ' || v_installment.number || ' de ' || v_charge.title, v_installment.amount, v_date,
      v_method, case v_method when 'pix' then 'Pix' when 'card' then 'Cartão' when 'boleto' then 'Boleto' else 'Transferência bancária' end,
      'person', coalesce(v_charge.client_avatar_url, v_charge.image_url), p_charge_id, auth.uid()
    ) returning id into v_transaction_id;
    update public.charge_installments
      set paid_at = (v_date + time '12:00') at time zone 'UTC', paid_method = v_method,
          reported = false, transaction_id = v_transaction_id
      where id = p_installment_id;
    insert into public.charge_events (organization_id, charge_id, kind, detail)
      values (p_organization_id, p_charge_id, 'paid', 'Parcela ' || v_installment.number);
  elsif p_operation = 'reopen' then
    if v_installment.paid_at is null then raise exception 'Essa parcela ainda está em aberto'; end if;
    update public.charge_installments
      set paid_at = null, paid_method = null, reported = false, transaction_id = null
      where id = p_installment_id;
    delete from public.transactions where id = v_installment.transaction_id and organization_id = p_organization_id;
    insert into public.charge_events (organization_id, charge_id, kind, detail)
      values (p_organization_id, p_charge_id, 'reopened', 'Parcela ' || v_installment.number);
  else
    raise exception 'Operação inválida';
  end if;
end;
$$;

revoke all on function public.change_charge_payment(uuid, uuid, text, uuid, public.payment_method, date) from public, anon;
grant execute on function public.change_charge_payment(uuid, uuid, text, uuid, public.payment_method, date) to authenticated;
