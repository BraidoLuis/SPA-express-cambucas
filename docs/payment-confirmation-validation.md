# Revisão da confirmação de pagamentos

Branch: `fix/payment-confirmation-validation`.
Base atualizada de `origin/main`: `2b75488341f77850d219e2500a0d1703e20dc35d`.
Worktree separada: `D:\Projetos\SPA-Express-Cambucas-payment-confirmation-validation`.

A worktree de agendamentos e suas alterações locais foram preservadas. Nenhum SQL, migration, fórmula de relatório, período, valor, critério de receita, dependência, CSS, autenticação ou processador de e-mails foi alterado. As duas chaves adicionadas em page.tsx usam a geração de acesso já existente para remontar os painéis administrativos/profissionais; não mudam a autenticação.

## Evidências e correções

O caminho administrativo real é AdminTodayTable → confirmAdminPayment → UPDATE payments. A função já exigia `status = pending`, verificava erro e rejeitava ausência de data. Preservamos essa condição. O problema restante era aceitar qualquer objeto retornado e selecionar somente id. Agora exige ID válido, appointment_id esperado, status paid, método/notas solicitados, responsável autenticado e data válida retornados pelo UPDATE. Zero linhas ou retorno parcial produz confirmação incerta, sem publicar sucesso. Não acrescentamos uma segunda atualização nem envio de mensagens.

O caminho profissional real é formulário de conclusão → completeProfessionalAppointment → RPC complete_professional_appointment → leitura do estado salvo. A definição de produção foi fornecida pelo usuário em 08/10/2026, como texto, e retorna jsonb com:
- appointment_id;
- appointment_status = completed;
- payment_status = paid quando há recebimento, ou o estado existente (pending como fallback) sem recebimento.

O serviço anteriormente ignorava data e aceitava somente ausência de erro. Agora valida esse JSON e consulta o atendimento pelo ID, confirmando completed e o pagamento compatível. Quando há novo recebimento, confirma também metadados essenciais do pagamento. O retorno completed do RPC é um literal, não uma linha RETURNING do UPDATE do atendimento; a leitura posterior é necessária, mas confirma um estado legível, não a propriedade exclusiva da tentativa.

A conclusão sem receber permanece disponível: envia p_payment_received=false e p_payment_method=null, mantém o pagamento pendente, pago, estornado ou cancelado existente, e aceita o fallback pending quando não há pagamento. Não foi exigido pagamento para concluir.

Quando a interface já sabe que o pagamento está paid, abre o formulário com recebimento desmarcado. Se a consulta prévia encontra um pagamento paid, mesmo que o checkbox estivesse marcado, o serviço usa o ramo sem recebimento do RPC: conclui o atendimento preservando método, notas, responsável e data registrados anteriormente, inclusive pela administradora. Falha/ausência de confirmação dessa leitura impede enviar um recebimento às cegas; é uma falha de verificação, não uma nova regra comercial. O ramo sem recebimento não depende dessa consulta prévia.

PaymentRequests/runPaymentAction mantêm o bloqueio síncrono até terminar a operação/recarga. Uma segunda chamada antes da próxima renderização não inicia nova mutação. Cleanup por layout effect invalida operações/consultas após desmontagem, e as chaves pela geração de acesso também protegem troca de conta, inclusive novo acesso da mesma conta. Versões independentes das consultas impedem uma resposta antiga de substituir a lista atual. A recarga da profissional usa o mês atualmente exibido.

Depois de confirmação válida, o pagamento/atendimento é atualizado localmente e o formulário é fechado antes da recarga. Na administradora, o aviso pertence ao painel pai: a tabela desmonta durante o loading da lista, mas a mensagem e a verificação da recarga continuam válidas enquanto o painel/acesso permanecer montado. Se ela falha, o resultado permanece confirmado, os botões da operação já concluída deixam de oferecer repetição e a mensagem orienta atualizar a tela sem confirmar novamente. Nenhuma mutação é repetida automaticamente. Os indicadores agregados da administradora continuam usando as fórmulas existentes; se não puderem ser recarregados, podem permanecer desatualizados até uma leitura bem-sucedida. Não recalculamos receita no navegador para mascarar a falha.

Erros de mutação e leituras posteriores são apresentados com mensagens públicas. Não mostramos host, SQL, políticas, triggers ou conteúdo interno das exceções.

Não há rota intermediária que confirme esses pagamentos no código atual: esses serviços usam o cliente Supabase autenticado diretamente. Rotas de e-mail não são chamadas pela nova implementação. AdminTable é uma função demonstrativa exportada sem referências em app; não foi alterada.

## Complementação: loading da agenda após invalidação

A revisão reproduziu uma lacuna: beginAction() invalida a publicação das consultas em andamento. Se a conclusão falhava antes da confirmação, runPaymentAction não iniciava recarga; o finally da consulta antiga exigia currentRead e deixava agendaLoading ativo mesmo depois de a consulta terminar.

Agora a validade dos dados e a titularidade do loading são independentes. beginRead registra quem iniciou o loading de cada canal. invalidateReads impede publicar dados/erros antigos, preservando essa titularidade. finishRead permite finalizar somente a última consulta pendente daquele canal, na mesma montagem/geração de acesso, e libera a titularidade uma única vez. Nova consulta substitui o dono anterior; activate/deactivate descartam os donos de outro acesso/montagem.

Os finally da agenda e dos dois carregamentos administrativos usam finishRead, sem enfraquecer currentRead nas atualizações de dados/erros. A consulta invalidada pode encerrar o próprio loading quando termina, mesmo depois de uma falha da operação, mas não pode encerrar o loading de uma consulta mais recente. A recarga de pagamento também finaliza seu token ao terminar.

Não há recarga nem repetição automática da mutação quando ela falha. A falha da operação continua separada da falha posterior de recarga após confirmação válida. As regressões usam promises controladas para término bem-sucedido/erro da consulta antiga, substituição por consulta nova (antes/depois do término), desmontagem e novo acesso da mesma conta com operação/consultas pendentes.

## Limitação comprovada de concorrência no banco

A definição fornecida do RPC:
- consulta o atendimento sem FOR UPDATE;
- testa confirmed antes de um UPDATE de appointments apenas pelo ID;
- atualiza payments apenas pelo ID, sem condição no estado anterior;
- usa paid_at = coalesce(paid_at, now()), preservando a data existente, mas pode sobrescrever método, notas e confirmed_by;
- devolve completed como literal, sem verificar a quantidade de linhas do UPDATE do atendimento.

Duas sessões podem ler confirmed antes de uma concluir. Uma administradora também pode confirmar o pagamento entre a leitura prévia e o UPDATE do RPC. O bloqueio da interface, a consulta prévia e a leitura posterior NÃO resolvem essas corridas de forma atômica. O UPDATE administrativo condicional protege seu próprio caminho, mas não impede um RPC concorrente de sobrescrever o pagamento depois.

A proteção completa depende de revisar, no banco, a reserva/bloqueio do atendimento, a transição condicionada ao estado atual, a atualização condicionada do pagamento e a confirmação das linhas efetivamente alteradas, preservando conclusão sem recebimento e pagamentos já pagos. Não alteramos SQL nesta etapa. As definições abaixo são necessárias para avaliar como fazê-lo sem interferir nos triggers, nas políticas e na auditoria existentes.

## Consultas somente de leitura para o SQL Editor

Não executar migrations locais como fonte de verdade. Nenhuma consulta abaixo foi executada pela revisão contra serviços reais.

```sql
-- Colunas, tipos e defaults (sem dados pessoais/financeiros).
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('appointments', 'payments', 'audit_logs')
order by table_name, ordinal_position;

-- Função já fornecida, para conferir versão corrente, e autorização profissional.
select p.oid::regprocedure as assinatura,
       pg_get_function_result(p.oid) as retorno,
       p.prosecdef as security_definer,
       p.proconfig as configuracao,
       pg_get_functiondef(p.oid) as definicao
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and p.proname in (
    'complete_professional_appointment',
    'current_professional_id',
    'current_user_role'
  )
order by assinatura;

-- Habilitação/forçamento de RLS e políticas de SELECT/UPDATE.
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('appointments', 'payments', 'audit_logs');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('appointments', 'payments', 'audit_logs')
order by tablename, policyname;

-- Permissões de coluna/tabela que podem afetar a leitura das confirmações.
select grantee, table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in ('appointments', 'payments')
  and grantee in ('authenticated', 'anon')
order by table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('appointments', 'payments')
  and grantee in ('authenticated', 'anon')
order by table_name, column_name, grantee, privilege_type;

-- Triggers, inclusive proteção de transição, pagamentos, auditoria e notificações.
select c.relname as tabela, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) as trigger_definition,
       p.oid::regprocedure as assinatura,
       pg_get_functiondef(p.oid) as function_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and n.nspname = 'public'
  and c.relname in ('appointments', 'payments', 'audit_logs')
order by c.relname, t.tgname;

-- Cardinalidade de pagamento por atendimento e integridade referencial.
select c.relname as tabela, con.conname, pg_get_constraintdef(con.oid) as definicao
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('appointments', 'payments', 'audit_logs')
order by c.relname, con.conname;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('appointments', 'payments', 'audit_logs')
order by tablename, indexname;
```

Se as funções/políticas/triggers chamarem outros validadores, precisamos também de suas definições pg_get_functiondef. A ausência de SELECT legível após a operação impede a confirmação pelo navegador; não significa automaticamente que o banco desfez a operação.

## Testes no navegador, somente em ambiente de teste autorizado

- Confirmar pagamento pendente nas abas Visão geral e Agendamentos, verificando ID, método, responsável/data e feedback. Repetir cliques antes da renderização e durante uma requisição lenta: apenas uma chamada por operação.
- Fazer duas confirmações administrativas concorrentes: uma confirma, a outra recebe resultado incerto/alterado; método/responsável/data da primeira devem permanecer.
- Concluir atendimento confirmado já iniciado com recebimento: verificar completed e paid. Concluir sem recebimento: completed com estado de pagamento preservado, incluindo pending.
- Confirmar pela administradora e depois concluir pela profissional, com checkbox marcado e desmarcado: não regravar os dados do pagamento já pago.
- Confirmar pela administradora DEPOIS da consulta prévia da profissional e ANTES do RPC, e concluir simultaneamente em duas sessões profissionais. Esses cenários continuam dependentes da proteção atômica no banco; não devem ser considerados resolvidos.
- Conferir RLS de SELECT/UPDATE administrativo e SELECT profissional nas colunas retornadas. Simular zero linhas, resposta parcial e leitura pós-RPC negada: nenhuma mensagem de sucesso; orientar consulta da agenda antes de repetir.
- Trocar de conta, sair, voltar para a mesma conta ou desmontar a tabela com mutação/consulta pendente: nenhuma resposta antiga deve fechar formulário, publicar feedback ou recarregar o novo acesso.
- Deixar leitura antiga pendente, confirmar e falhar a recarga: o estado confirmado local deve persistir. No painel administrativo, conferir também a outra aba após a falha.
- Deixar a leitura da agenda pendente, iniciar conclusão e falhar a operação antes da confirmação. Quando a leitura antiga terminar (sucesso ou erro), o loading deve encerrar sem publicar seus dados/erro e sem iniciar recarga ou repetir a mutação.
- Invalidar uma leitura antiga e iniciar outra: o término da antiga não pode esconder o loading da nova. Se a nova terminar primeiro, a antiga não pode publicar dados nem encerrar o loading outra vez.
- Nos dois cenários anteriores, desmontar/sair/trocar de conta/entrar novamente na mesma conta com as promises pendentes: nenhum callback antigo pode alterar dados, erro ou loading do novo acesso.
- Trocar o mês da agenda enquanto a conclusão está pendente: a recarga deve usar o mês exibido.
- Falhar a recarga depois de confirmação válida: formulário fechado e operação marcada localmente, mensagem de confirmação com falha de atualização, sem reenvio automático e sem convite a confirmar novamente.
- Falhar RPC, conexão, acesso e leitura posterior: mensagem pública, sem SQL/host/erro interno. Falha de auditoria/trigger exige conferência do comportamento transacional na definição corrente.
- Relatórios: conferir que fórmulas, períodos, valores e critérios de receita continuam iguais; atualização dos totais depende da recarga normal.

## Arquivos desta etapa

Alterados:

- app/components/admin/admin-dashboard.tsx
- app/components/professional/professional-dashboard.tsx
- app/lib/services/admin-dashboard-service.ts
- app/lib/services/professional-agenda-service.ts
- app/page.tsx

Novos:

- app/components/shared/use-payment-requests.ts
- app/lib/payment-errors.ts
- app/lib/payment-requests.ts
- app/lib/payment-requests.test.ts
- app/lib/services/payment-mutations.test.ts
- docs/payment-confirmation-validation.md

## Validação automatizada

- `npm test`: aprovado, 290 testes em 12 arquivos; inclui 12 regressões novas com promises controladas para o loading.
- `npx tsc --noEmit`: aprovado.
- `npm run lint`: aprovado, zero erros e 11 avisos preexistentes de imagens (@next/next/no-img-element).
- `npm run build`: aprovado, compilação, TypeScript e geração de páginas concluídas com Next.js 16.4.0.
- `git diff --check`: aprovado.

A preservação da worktree de agendamentos foi verificada por branch/HEAD, status, diff, índice e hashes de 141 arquivos, sem divergências. Os testes utilizam mocks e promises controladas, sem contas, banco, Storage, serviços de pagamento ou e-mails reais. Os testes do SQL Editor/navegador continuam pendentes.

