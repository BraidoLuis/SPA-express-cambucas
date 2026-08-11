-- Sincroniza o cancelamento do agendamento
-- com seu pagamento pendente.

alter type public.payment_status
add value if not exists 'cancelled';

create or replace function public.cancel_pending_payment_with_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled'
    and old.status is distinct from new.status
  then
    update public.payments
    set
      status = 'cancelled'::text::public.payment_status,
      notes = case
        when notes is null or trim(notes) = ''
          then 'Cancelado junto com o agendamento'
        else notes || E'\nCancelado junto com o agendamento'
      end,
      updated_at = now()
    where appointment_id = new.id
      and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists cancel_payment_after_appointment_cancellation
on public.appointments;

create trigger cancel_payment_after_appointment_cancellation
after update of status
on public.appointments
for each row
execute function public.cancel_pending_payment_with_appointment();