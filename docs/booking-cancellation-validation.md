# Validação de agendamentos e cancelamentos em produção

Nenhuma consulta deste documento foi executada contra serviços reais. As migrations locais não foram usadas para inferir o comportamento de produção.

A interface lê somente `cancellationEnabled` e `cancellationNoticeHours` de `spa_settings.booking_rules` por um endpoint autenticado de servidor. Configuração ausente/inválida é informada, sem assumir duas horas. O endpoint usa a configuração de Supabase já necessária às rotas administrativas. Nenhum segredo é devolvido ao navegador.

O banco continua responsável por autorizar e revalidar cancelamentos, disponibilidade e regras de criação. Precisamos conferir as definições abaixo no SQL Editor, somente com leitura. Elas confirmam os contratos de retorno dos RPCs, as políticas de acesso/UPDATE/SELECT, a validação definitiva do prazo e os triggers de agendamento/notificação. Não compartilhar dados de clientes nem valores de credenciais.

## Contrato de cancelamento confirmado nesta revisão

A definição de produção de `validate_configured_client_cancellation_notice_017()` foi fornecida pelo usuário em 08/10/2026 e revisada como texto. Não executamos essa função nem consultas contra produção.

- `cancellationEnabled` corresponde ao campo administrativo “Aplicar prazo mínimo de cancelamento”. `true` aplica a antecedência; `false` não exige essa antecedência. Não é uma autorização geral de cancelamento.
- Atendimento futuro e estados elegíveis continuam sendo restrições. A interface só oferece cancelamento de `pending`/`confirmed`; a requisição de UPDATE usa o ID explícito e `status in ('pending', 'confirmed')`. RLS e triggers permanecem responsáveis pela autorização definitiva.
- O trigger inicializa as horas em zero e aceita somente texto com 1 a 5 dígitos (`^[0-9]{1,5}$`). Nulo, ausente, decimal, negativo, espaços, notação científica textual ou mais de cinco dígitos resultam em zero. Uma string como `"00007"` resulta em 7.
- O endpoint lê as horas com o operador JSONB `->>`, preservando o texto original. Assim, o texto `"2.0"` não é confundido com `"2"` pela desserialização JavaScript. A resposta traz o número efetivo usado para a checagem.
- Com a flag ativa, o trigger rejeita `start_at <= now() + make_interval(hours => notice_hours)`. A interface também rejeita a igualdade. Com a flag inativa, exige atendimento futuro, mas ignora o número de horas para a antecedência.
- Configuração indisponível (falha de consulta, linha ausente ou flag não identificável como booleano) continua bloqueando a ação na interface. Com uma flag válida, horas ausentes/inválidas usam zero conforme o contrato; isso não significa indisponibilidade da configuração.

## Confirmação, concorrência e falha de recarga

O UPDATE condicionado verifica o estado no banco durante a mutação. Se a equipe concluiu/marcou ausência/cancelou o atendimento antes disso, o UPDATE retorna zero registros. A aplicação não sobrescreve o estado, não anuncia novo cancelamento e não chama o processamento de e-mail dessa tentativa. A mensagem orienta atualizar os agendamentos, pois o atendimento pode ter sido cancelado ou alterado.

Após o banco devolver o ID esperado com `status=cancelled`, a aplicação marca esse ID como cancelado no estado local e fecha o diálogo antes de recarregar a lista. Isso remove o botão Cancelar nas abas Início/Meus agendamentos mesmo se a recarga falhar. A atualização local mantém os demais dados e registros e preserva um estado local já alterado pela equipe. A recarga pode informar erro, mas não desfaz a confirmação nem repete a mutação.

Uma resposta de outro acesso ou de componente desmontado não atualiza o estado local nem inicia a recarga do acesso seguinte. A confirmação do UPDATE também precisa ocorrer antes de qualquer atualização local de sucesso.

Ao abrir e confirmar o diálogo, a configuração e o relógio são revalidados. Se o prazo vencer com a flag ativa, a mutação não é enviada e o diálogo mostra o vencimento. Com `false`, o diálogo permite um atendimento ainda futuro sem exigir as horas; se o atendimento já iniciou, a mensagem informa essa restrição. Configuração que não pôde ser carregada mantém a ação bloqueada com mensagem informativa.

## Consultas somente de leitura

```sql
-- Valor atual dos dois campos utilizados pela interface (sem outros dados).
select id,
       booking_rules -> 'cancellationEnabled' as cancellation_enabled,
       booking_rules -> 'cancellationNoticeHours' as cancellation_notice_hours,
       booking_rules ->> 'cancellationNoticeHours' as cancellation_notice_hours_text,
       jsonb_typeof(booking_rules -> 'cancellationNoticeHours') as cancellation_notice_hours_type
from public.spa_settings
where id = true;

-- Tipos e defaults dos campos existentes.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('appointments', 'spa_settings')
order by table_name, ordinal_position;

-- RPCs, incluindo sobrecargas, tipo de retorno e definição real.
select p.oid::regprocedure as signature,
       pg_get_function_result(p.oid) as result_type,
       p.prosecdef as security_definer,
       p.proconfig as function_configuration,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and p.proname in (
    'create_client_appointment',
    'create_professional_extra_appointment',
    'update_professional_appointment_status',
    'complete_professional_appointment',
    'get_available_slots',
    'get_public_spa_settings'
  )
order by signature;

-- RLS efetivamente habilitada e políticas relacionadas.
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('appointments', 'spa_settings');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('appointments', 'spa_settings')
order by tablename, policyname;

-- Triggers ativos e suas funções: prazo, transições e fila de notificações.
select c.relname as table_name, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) as trigger_definition,
       p.oid::regprocedure as function_signature,
       pg_get_functiondef(p.oid) as function_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname = 'public'
  and c.relname in ('appointments', 'spa_settings')
order by c.relname, t.tgname;

-- Constraints e índices que impedem horários sobrepostos.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.appointments'::regclass;

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'appointments';
```

Se as funções/políticas/triggers acima chamarem outras funções para validar disponibilidade, perfil ativo, vínculo ou prazo, também precisamos das respectivas definições (`pg_get_functiondef`). A fronteira estrita da antecedência foi confirmada no trigger fornecido. As outras funções/políticas/triggers, inclusive a restrição definitiva de atendimento futuro quando a flag é false, continuam pendentes de consulta; não foram presumidas a partir das migrations.

## Verificação no navegador, em ambiente de teste

- Conferir a opção “Aplicar prazo mínimo de cancelamento”: true aplica a antecedência e false permite um atendimento ainda futuro sem essa antecedência. Testar horas nulas, ausentes, em texto, decimais e fora do formato conforme o trigger.
- Abrir o mesmo diálogo pelas abas Início e Meus agendamentos; deixar o prazo vencer antes de confirmar. A mensagem deve informar o vencimento, sem anunciar cancelamento.
- Confirmar que o UPDATE por ID condicionado a pending/confirmed e seu SELECT são permitidos pela RLS da cliente, e que os RPCs de equipe deixam o estado final legível. Zero registros não pode gerar sucesso.
- Abrir confirmação e, em outra sessão de teste, alterar pela equipe para cancelled, completed ou no_show: a requisição antiga não deve sobrescrever esse estado nem anunciar novo cancelamento.
- Repetir cliques antes de terminar criação/cancelamento: apenas uma requisição de mutação por operação. A data/horário em confirmação não deve mudar durante o envio.
- Trocar o mês da agenda da profissional com uma mutação pendente: a recarga deve usar o mês que está sendo exibido.
- Trocar de conta/encerrar sessão com consulta ou operação pendente; a resposta antiga não pode atualizar o painel seguinte.
- Criar com os três perfis; verificar conflito de horário e falhas de conexão sem detalhes internos. Se a confirmação ficar incerta, consultar a agenda antes de repetir.
- Simular falha do endpoint de e-mail/atualização da lista após confirmação do banco: a reserva/cancelamento deve permanecer bem-sucedida, sem repetir criação. Depois do cancelamento confirmado, o estado local deve mostrar cancelled e remover o botão Cancelar, mesmo com erro de recarga.

## Arquivos desta revisão

Alterados:

- `app/components/admin/admin-appointment-form.tsx`
- `app/components/admin/admin-dashboard.tsx`
- `app/components/client/client-dashboard.tsx`
- `app/components/professional/professional-dashboard.tsx`
- `app/components/shared/action-dialog.tsx`
- `app/lib/services/admin-appointment-service.ts`
- `app/lib/services/appointment-service.ts`
- `app/lib/services/professional-agenda-service.ts`
- `app/lib/services/professional-extra-appointment-service.ts`
- `app/page.tsx`

Novos:

- `app/api/appointments/cancellation-rules/route.ts`
- `app/api/appointments/cancellation-rules/route.test.ts`
- `app/components/shared/use-booking-requests.ts`
- `app/lib/booking-errors.ts`
- `app/lib/booking-requests.ts`
- `app/lib/booking-requests.test.ts`
- `app/lib/cancellation-rules.ts`
- `app/lib/cancellation-rules.test.ts`
- `app/lib/client-cancellation.ts`
- `app/lib/client-cancellation.test.ts`
- `app/lib/services/cancellation-rules-service.ts`
- `app/lib/services/booking-mutations.test.ts`
- `docs/booking-cancellation-validation.md`

Validação da correção complementar: npm test passou (347 testes, 15 arquivos); npx tsc --noEmit passou; npm run lint passou sem erros (12 avisos existentes: 11 de imagens e um de diretiva eslint sem uso em coverage/block-navigation.js); npm run build passou; git diff --check passou. Os testes de banco e navegador acima continuam pendentes. Nenhum serviço real é utilizado nos testes com mocks.
