# Segurança de conclusão e pagamentos — revisão da etapa

Branch: `fix/payment-concurrency-security`.
Worktree: `D:\Projetos\SPA-Express-Cambucas-payment-concurrency-security`.
Base: `origin/main` em `9bf9a02f9041b2b521de72c442ed751c1093db95`, atualizada em 08/10/2026.
A worktree de agendamentos e seus artefatos foram preservados. O SQL manual já foi aplicado no Supabase pelo usuário, que confirmou a verificação posterior das funções, políticas e permissões esperadas. Essa confirmação foi fornecida na conversa; o agente não acessou produção, não executou o SQL remotamente e não enviou e-mails reais. A proposta foi aplicada e testada anteriormente em PostgreSQL local descartável 17.6. Os arquivos SQL ficam no repositório como referência de revisão e reprodução local; este commit não executa nem reaplica o SQL.

## Referência de produção e limites

A fonte é o CSV anexado pelo usuário, SHA-256 `63684dd96ffa8568b8b2e366e0a874ceeeda953cab60744d894025b094eecb98`. As migrations antigas não foram usadas como contrato. O anexo está acessível e contém as definições dos dois RPCs, RLS, permissões efetivas, triggers, constraints e índices. Não contém a lista integral de colunas/defaults/labels dos enums. Em 08/10/2026 o usuário confirmou que o preflight de produção corresponde à proposta (colunas, enums, políticas, constraints e hashes), com ambos os contadores de duplicidade iguais a zero e PostgreSQL 17.6. Não houve conexão remota pelo agente; os resultados completos do preflight não foram recebidos como dump.

O SQL usa somente campos já referenciados pelos RPCs, triggers e políticas auditados, com `%ROWTYPE` e enum existente. Não acrescenta colunas, índices ou estados. Antes de aplicar, conferir as colunas, enums, permissões e definições retornadas pelo preflight; ausência/divergência exige interromper a aplicação e revisar o contrato. O script também aborta se os RPCs/helpers ou as políticas relevantes divergirem da auditoria, ou se faltarem colunas/unicidade/RLS/owner exigidos. Os fingerprints e comparações normalizam CRLF/LF para evitar divergência causada apenas pelas quebras de linha do Windows.

## Problemas comprovados e caminhos examinados

- `payments_professional_update` autoriza UPDATE de todas as colunas do pagamento vinculado. A API possui UPDATE efetivo, portanto RLS precisa fechar esse caminho.
- `complete_professional_appointment` lê sem bloqueio, atualiza atendimento só pelo ID e confirma pagamento sem condição pending. Pode sobrescrever método, notas e responsável de uma confirmação administrativa concorrente.
- `update_professional_appointment_status` também lê sem bloqueio e escreve só por ID. Uma leitura confirmed antiga permite cancelar depois de outra sessão concluir, incluindo efeitos do trigger de cancelamento.
- `current_professional_id` valida professionals.active, sem exigir profiles.active ou role. Os RPCs auditados herdam essa lacuna.
- `appointments_team_update` permite conclusão direta por UPDATE, contornando os RPCs. A restrição adicional proposta fecha a escrita direta de completed e a alteração direta de registros completed por não administradores.
- Na aplicação, o painel administrativo chama `confirmAdminPayment`, que já exige UPDATE pending e valida RETURNING; não foi alterado. O painel profissional usa `completeProfessionalAppointment` e `updateProfessionalAppointmentStatus`. A conclusão via RPC de status continua disponível sem recebimento, conforme produção.
- Foram examinadas as rotas administrativas de agendamento, as leituras de agenda/listas/relatórios e os serviços de cliente/equipe. Não há outro escritor de pagamentos no código da aplicação. Nenhum relatório, fórmula, receita, regra de reserva/cancelamento ou processador de e-mails foi modificado. Os ajustes posteriores de JSX/CSS da cliente estão descritos abaixo.

## SQL proposto

Os dois RPCs conservam nomes, parâmetros, defaults e tipos de retorno. Ambos validam UID, perfil ativo/role professional, vínculo ativo e propriedade do atendimento. A ordem dos bloqueios é a mesma: profiles FOR SHARE → professionals FOR SHARE → appointments FOR NO KEY UPDATE → payments FOR NO KEY UPDATE. Autorização e estado são verificados nos registros bloqueados depois das esperas. Os UPDATEs incluem ID/vínculo/estado esperado, conferem RETURNING e a inserção de auditoria exige exatamente uma linha.

FOR NO KEY UPDATE bloqueia alterações do atendimento sem bloquear FOR KEY SHARE das FKs. Isso importa porque o trigger de pagamento insere uma notificação referenciando o atendimento. O UPDATE administrativo existente bloqueia apenas o pagamento; suas leituras de atendimento e FKs não invertem os bloqueios exclusivos dos RPCs. Não substituímos esse trigger nem desativamos seus efeitos. Ver [bloqueios de linhas do PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html) e [revalidação de UPDATE em Read Committed](https://www.postgresql.org/docs/current/transaction-iso.html).

Uma conclusão só altera confirmed já iniciado. Recebimento só atualiza pending; paid é preservado integralmente, inclusive amount, method, notes, confirmed_by, paid_at e updated_at. Outros estados não podem receber nova confirmação nesse RPC. Sem recebimento, nenhum pagamento é atualizado; pagamento ausente conserva o fallback pending do contrato antigo. Repetir conclusão não gera novo UPDATE/auditoria; repetir o mesmo status no RPC de status retorna o registro, sem efeitos novos. Qualquer falha intermediária, zero linhas ou falha de auditoria aborta toda a operação, inclusive notificações inseridas por triggers.

O RPC de status preserva as transições auditadas:
pending → confirmed/cancelled; confirmed → completed/cancelled/no_show; retorno idempotente para mesmo status. As checagens de atendimento futuro e motivo de cancelamento permanecem. Sua conclusão sem recebimento não altera pagamento. Cancelamento e conclusão concorrentes revalidam o estado bloqueado: quem perde não pode sobrescrever um estado terminal.

RLS: remove-se apenas payments_professional_update; payments_select e payments_admin_update permanecem. Adiciona-se appointments_completed_rpc_only, RESTRICTIVE para authenticated, vedando completed na entrada/saída de UPDATE direto de não admin. Os RPCs SECURITY DEFINER de owner postgres continuam podendo concluir, com validação explícita. A política não altera prazos, motivos, disponibilidade ou transições; fecha o atalho direto para transições já proibidas pelo contrato do RPC. UPDATE administrativo e cancelamento de cliente elegível continuam nos caminhos existentes. Ver [políticas restritivas](https://www.postgresql.org/docs/current/sql-createpolicy.html).

EXECUTE: apenas authenticated e o owner continuam autorizados nos dois RPCs; PUBLIC, anon e service_role são revogados. Não há chamada service_role desses RPCs no projeto. Outros RPCs/helpers/grants globais permanecem. search_path passa a pg_catalog, public, pg_temp e tabelas/auth/helpers são qualificados. Ver [segurança de SECURITY DEFINER e EXECUTE](https://www.postgresql.org/docs/current/sql-createfunction.html).

## Contrato da aplicação e compatibilidade

O JSON da conclusão mantém appointment_id, appointment_status e payment_status, acrescentando:
- payment_updated: boolean, true somente quando ESTE RPC confirmou pending;
- payment_id: UUID do pagamento observado, ou null quando não existe.

O serviço profissional confere os dois campos juntos, se presentes, e o ID da leitura posterior. Se payment_updated=false e o pagamento é paid, aceita os metadados válidos já confirmados pela administradora, em vez de exigir o método escolhido pela profissional. Se true, continua exigindo o método do pedido. Contrato parcial, zero linhas, resposta incompatível e leitura posterior não confirmada permanecem resultados incertos, sem repetir a mutação. A leitura posterior continua necessária no caminho legado; sua falha informa que a conclusão pode ter sido salva.

O JSON legado é aceito com as verificações anteriores. A consulta prévia foi mantida exclusivamente para compatibilidade com a versão antiga, e NÃO é a proteção contra concorrência. A proteção atômica está nos bloqueios e UPDATEs do SQL manual, cuja aplicação e verificação estrutural no Supabase já foram confirmadas pelo usuário. Os testes reais de concorrência foram executados no modelo local, sem acesso automático a produção.

A versão atual da aplicação é compatível com o SQL novo: parâmetros/tipos/chaves antigos são preservados e não há UPDATE direto profissional de pagamentos. Na corrida em que admin confirma depois da consulta prévia, a versão antiga pode mostrar confirmação incerta por diferença de método; o banco novo preserva o pagamento. O ajuste desta branch permite reconhecer essa confirmação preservada.

Os guardas existentes de cliques, gerações/acessos, consultas, loading, desmontagem e recarga continuam intactos. Não se repete automaticamente a mutação. Após confirmação, falha de recarga continua recebendo feedback separado. Os painéis administrativo e profissional não foram alterados nesta etapa; a interface da cliente recebeu os ajustes pontuais descritos abaixo.

## Ordem de aplicação e reversão

1. Executar [preflight](sql/payment-concurrency-preflight.sql), somente leitura, no SQL Editor e salvar o resultado/backups. Confirmar colunas/enums/overloads, unicidade, owner/RLS, helpers, triggers e grants. Se houver divergência, não aplicar; entregar o resultado para revisão.
2. Preparar clone LOCAL descartável com schema atual e fixtures sintéticas, sem cron/workers, chaves de e-mail ou serviços externos. Aplicar o SQL e executar os testes PostgreSQL e de navegador abaixo. O modelo local e os testes PostgreSQL foram executados; diferenças e evidências estão no [relatório local](payment-concurrency-local-validation.md). A interface da cliente foi validada no Chromium com mocks; os testes manuais dos fluxos de pagamento via Supabase/PostgREST e aparelhos reais continuam pendentes.
3. Após revisão e autorização de produção, drenar/suspender novas mutações durante a janela de aplicação e esperar as operações antigas terminarem. Substituir função não troca o corpo de uma chamada antiga já em execução. Não encerrar sessões automaticamente. Essa manutenção não foi realizada pelo agente.
4. Executar SOMENTE [aplicação](sql/payment-concurrency-apply.sql), arquivo inteiro em transação. Locks de tabelas e timeout curto impedem aplicação parcial; falha exige ROLLBACK e investigação. Não executar os outros arquivos SQL em lote.
5. Executar [verificação posterior](sql/payment-concurrency-verify.sql), somente leitura, comparando triggers/constraints/índices/helpers com o backup. Confirmar anon/service_role=false e authenticated=true nos RPCs, ausência da política profissional de pagamentos e nova política restritiva.
6. Publicar a aplicação apenas após aprovação e depois da validação do banco. A aplicação e a verificação posterior do SQL no Supabase já foram realizadas manualmente pelo usuário; não repetir os passos de aplicação como parte do PR. Merge/deploy da aplicação ainda dependem de aprovação.

Reversão preferida: reverter a aplicação mantendo o SQL seguro, já que o contrato é aditivo. [Rollback do banco](sql/payment-concurrency-rollback.sql) restaura exatamente os corpos/grants/política do anexo e remove a nova política; verifica fingerprints dos corpos novos antes de sobrescrever. REABRE as vulnerabilidades, exige revisão/autorização separadas e só serve se o backup anterior coincidir com o anexo. Não modifica dados, não desfaz reservas/pagamentos e não deve ser usado para “desfazer” operações comerciais. Se houve outro patch de SQL, usar o backup real revisado, não este rollback.

## Testes PostgreSQL reproduzíveis — executados no modelo local

Inicialmente não havia PostgreSQL/Docker/WSL utilizável. Após informar a alternativa, foram usados binários oficiais portáteis do PostgreSQL 17.6, sem instalador/serviço Windows/alteração permanente de PATH. O SQL e os testes abaixo foram executados no modelo local; sete cenários observaram bloqueios reais entre conexões independentes. Ver [evidências, reprodução e diferenças](payment-concurrency-local-validation.md). Mocks não substituíram esses testes.

Usar SOMENTE o banco local chamado spa_payment_test. Restaurar schema atual em um banco descartável; criar fixtures sintéticas via SQL local conforme as colunas/defaults obtidos no preflight, sem API Auth ou e-mail real. Não fornecemos INSERTs de auth.users porque seu contrato não consta do anexo. Precisamos de perfis:
professional ativo e vínculo ativo dono do atendimento; admin ativo; inativo; client; professional ativo sem vínculo; outra professional ativa; professional ativo com vínculo inativo.
Fixture principal: confirmed, start_at <= now(), serviço/vínculo válido, duração/horário sem bloqueios e um pagamento pending. Nenhum worker pode consumir as notificações de teste.

Regressão transacional, em uma sessão como owner do clone:
```powershell
psql -h 127.0.0.1 -U postgres -d spa_payment_test -v appointment_id=UUID_ATENDIMENTO -v professional_id=UUID_PERFIL_PRO -v admin_id=UUID_PERFIL_ADMIN -v inactive_id=UUID_PERFIL_INATIVO -v client_id=UUID_PERFIL_CLIENTE -v unlinked_id=UUID_PERFIL_SEM_VINCULO -v other_professional_id=UUID_OUTRA_PRO -v inactive_link_id=UUID_PRO_VINCULO_INATIVO -f tests/sql/payment-concurrency-regression.sql
```
Substituir todos os UUIDs. O roteiro valida fixtures, identidade nos dois RPCs, todos os estados REAIS do enum de pagamento com/sem recebimento, pagamento ausente, repetição, futuro/estado inelegível, RLS de UPDATE direto e rollback de falha intermediária/zero linhas/auditoria. O RPC de status também tem verificações de conclusão sem recebimento, repetição sem nova auditoria e rollback de zero linhas/falha de auditoria. As injeções de falha são triggers temporários apenas na transação do teste. Tudo termina em ROLLBACK; erro inesperado com ON_ERROR_STOP encerra a execução e exige rollback se a sessão permanecer aberta.

Para concorrência, abrir dois terminais psql no mesmo clone, usando [sessão A](sql/payment-concurrency-session-a.sql) e [sessão B](sql/payment-concurrency-session-b.sql). CADA cenário exige uma fixture nova/prístina; A confirma sua transação e pode deixar notificações sintéticas enfileiradas. Manter consumidores desligados. Não limpar por data nem apagar dados reais.

Exemplo: admin confirma DURANTE a conclusão:
```powershell
# Terminal A — bloqueia só o pagamento e pausa interativamente.
psql -h 127.0.0.1 -U postgres -d spa_payment_test -v scenario=admin_first -v appointment_id=UUID_ATENDIMENTO -v professional_id=UUID_PERFIL_PRO -v admin_id=UUID_PERFIL_ADMIN -f docs/sql/payment-concurrency-session-a.sql
# Terminal B — inicia enquanto A está pausada. Deve aguardar o pagamento.
psql -h 127.0.0.1 -U postgres -d spa_payment_test -v operation=complete -v appointment_id=UUID_ATENDIMENTO -v professional_id=UUID_PERFIL_PRO -v admin_id=UUID_PERFIL_ADMIN -f docs/sql/payment-concurrency-session-b.sql
```
B obtém o atendimento e aguarda pagamento; liberar A antes de 30 segundos. A deve atualizar/rodar o trigger/commit sem bloquear no atendimento de B. B então conclui com payment_updated=false, preservando o registro pago por A. Ausência de bloqueio observado, timeout ou deadlock exige investigação; não considerar sucesso.

| A / scenario | B / operation | Resultado esperado depois de liberar A |
| --- | --- | --- |
| admin_first | complete | completed + paid, método/notas/responsável/data da admin intactos; 1 auditoria de conclusão |
| professional_first | admin | completed + paid da profissional; UPDATE admin retorna ZERO linhas |
| professional_first | complete | segunda conclusão nega estado completed; 1 auditoria de conclusão total |
| cancel_first | complete | cancelled; pagamento pending vira cancelled pelo trigger; conclusão negada |
| professional_first | cancel | completed + paid; cancelamento perde e não sobrescreve |
| admin_first, concluída ANTES de iniciar B | complete | completed; pagamento/admin totalmente preservados |

A captura lock antes de esperar input; B só é iniciado depois. Para observar espera, usar terceira sessão owner com pg_stat_activity/pg_blocking_pids, sem expor query text. No SQL Editor uma aba/conexão não garante duas sessões independentes; usar os terminais locais.

Após cada cenário, conferir como owner do clone:
```sql
-- Substituir UUID_ATENDIMENTO; guardar também o snapshot/baseline ANTES do cenário.
select id,status from public.appointments where id='UUID_ATENDIMENTO'::uuid;
select id,appointment_id,status,amount,method,notes,confirmed_by,paid_at,updated_at
from public.payments where appointment_id='UUID_ATENDIMENTO'::uuid;
select action,count(*) from public.audit_logs
where entity_id='UUID_ATENDIMENTO' group by action;
select channel,notification_type,recipient_id,count(*) from public.notifications
where appointment_id='UUID_ATENDIMENTO'::uuid group by channel,notification_type,recipient_id;
select pid,wait_event_type,wait_event,pg_blocking_pids(pid)
from pg_stat_activity where datname='spa_payment_test';
```
Conferir delta de auditoria/notificações em relação ao baseline, não presumir zero histórico. Os triggers e filas existentes devem permanecer; nenhum envio externo deve ocorrer. Repetir com READ COMMITTED. Em REPEATABLE READ/SERIALIZABLE, 40001 pode ocorrer e deve abortar integralmente, sem retry automático de mutação.

## Interface da cliente e navegação por datas

O aviso de antecedência encerrada agora mostra “Prazo de cancelamento encerrado.” abaixo das ações, alinhado à direita no desktop e sem overflow no mobile. Mensagens de configuração indisponível e demais motivos permanecem distintas; FAQ e diálogo conservam a explicação completa das horas configuradas. A regra de cancelamento e a validação definitiva no banco não foram alteradas.

Ao abrir cada serviço, a data inicial é hoje em America/Sao_Paulo. Setas acessíveis de Dia anterior/Próximo dia, calendário e atalhos compartilham a seleção; a seta anterior fica desabilitada em hoje e datas passadas são rejeitadas. A troca limpa o horário, os horários livres e os encaixes, invalida imediatamente a consulta anterior e consulta novamente os dois RPCs existentes. Uma resposta antiga também não pode encerrar o loading da data atual. A disponibilidade continua determinada pelos RPCs; mostrar hoje não libera horários proibidos.

As datas do calendário usam componentes de data, sem conversão por toISOString(), inclusive em viradas de mês/ano. Os testes cobrem um navegador com fuso Pacific/Kiritimati, diferente do estabelecimento, respostas fora de ordem, desmontagem/troca de acesso, calendário/atalhos, cliques rápidos e dia sem horários. Capturas em 320 pixels revelaram overflow; o ajuste limita a largura dos painéis e mantém espaço para serviço/profissional/horário/valor, sem cortar o aviso.

Para repetir somente os testes da interface, iniciar um servidor local da worktree em 127.0.0.1:3001 e executar:

~~~powershell
npx playwright test --config tests/browser/client-booking.config.ts
~~~

BOOKING_UI_URL pode selecionar outra porta local. A configuração recusa servidores remotos, e os testes interceptam Supabase e APIs locais para impedir acesso real e notificações. Capturas e resultados do navegador são gerados somente na pasta temporária do Windows, fora do repositório.

Pendências de navegador: fluxos de pagamentos com sessões reais de teste (lista abaixo), dispositivo real/Safari, calendário nativo mobile, mudança de data/encaixes e aviso de cancelamento nas abas Início/Meus agendamentos. Não executar esses testes com dados reais sem planejamento/autorização apropriados.

## Navegador e permissões a validar no clone

- Confirmação admin antes/durante/depois da conclusão: conferir valores/metadados, feedback e que só pending é confirmado.
- Concluir sem receber, pagamento ausente e já pago; não alterar valores/regras de receita ou fórmulas dos relatórios.
- Duas sessões profissionais concluindo, conclusão vs cancelamento em ambas as ordens e cliques repetidos.
- Acesso de profissional inativa, role client/admin com vínculo, vínculo inativo/ausente, outra profissional, futuro e estado inelegível: nenhum sucesso, sem erros internos.
- Chamada direta de UPDATE de payments como professional deve retornar zero/negada, preservando SELECT. UPDATE direto completed deve ser negado; RPC autorizado deve funcionar.
- Desmontar/sair/trocar de conta com RPC/leitura/recarga pendentes; nenhuma resposta antiga deve alterar o novo acesso ou esconder seu loading.
- Falhar recarga após confirmação: estado local confirmado e feedback separado, sem repetir a mutação. Falhar leitura de confirmação: feedback incerto orienta conferir agenda.
- Execução anon/service_role dos dois RPCs negada; authenticated sem perfil/vínculo elegível também negado.

## Pendências mais amplas, fora desta alteração

current_professional_id permanece intacta. O anexo mostra consumidores nas políticas de appointments, disponibilidade/exceções, payments_select, professional_services, schedule_blocks, service_media, services e Storage; e nos RPCs de criação de atendimento extra, bloqueio e serviço. Validar perfil/role globalmente exige revisar esses consumidores e catálogo/leitura pública em outra etapa.

As permissões efetivas TRUNCATE/TRIGGER e outros grants amplos de anon/authenticated no anexo exigem revisão separada: RLS não protege TRUNCATE. A política de atualização própria de professionals também permite colunas administrativas como active; o hardening desses campos é pendência separada. Não alteramos grants/políticas globais nesta correção. A política admin de payments permanece ampla para operações administrativas fora deste fluxo; o caminho do painel só confirma pending.

As políticas de INSERT de appointments também merecem revisão separada: não restringem o status inicial ao caminho de reserva. Esta proposta protege a conclusão de atendimentos existentes por UPDATE/RPC; não altera INSERT nem as regras de criação de reservas nesta etapa.

A verificação estrutural de produção foi confirmada pelo usuário e os testes reais de banco foram aprovados no modelo local. Isso não substitui a validação manual dos fluxos da aplicação no Supabase nem comprova todos os caminhos e configurações de produção. A correção é limitada ao fluxo solicitado.

## Arquivos e validação

Alterados: app/lib/services/professional-agenda-service.ts; app/lib/payment-errors.ts; app/components/client/client-dashboard.tsx; app/globals.css.
Novos: app/lib/services/payment-concurrency.test.ts; este documento; seis arquivos docs/sql/payment-concurrency-*.sql; tests/sql/payment-concurrency-regression.sql; quatro arquivos tests/postgres/*; docs/payment-concurrency-local-validation.md; docs/payment-concurrency-postgres-results.json; app/lib/booking-calendar.ts; app/lib/booking-calendar.test.ts; tests/browser/client-booking-navigation.spec.ts; tests/browser/client-booking.config.ts.

- npm test: 473 testes aprovados em 19 arquivos, incluindo 30 testes de pagamentos com mocks/promises controladas e 17 testes de calendário.
- npx tsc --noEmit: aprovado.
- npm run lint: aprovado, zero erros e 11 avisos preexistentes de imagens.
- npm run build: aprovado, compilação/TypeScript/geração das 14 páginas concluídos.
- git diff --check: aprovado; arquivos novos também conferidos contra arquivo vazio.
- SQL/PostgreSQL 17.6: aplicação, pós-verificação, regressões transacionais, sete cenários de concorrência real, RLS e rollback/reaplicação aprovados no modelo local. Corrigidos dois terminadores ausentes no rollback após falha real de sintaxe.
- Chromium: 15 cenários aprovados em larguras de 1440, 390 e 320 pixels; os cinco de 320 pixels foram repetidos após o último ajuste do título. Autenticação/dados/RPCs/APIs locais foram simulados e as demais chamadas externas bloqueadas. Não houve mutações ou e-mails reais.
- Supabase: aplicação manual e pós-verificação estrutural confirmadas pelo usuário. O modelo local não comprova JWT/PostgREST reais, schema integral de produção ou ambiente Linux/extensões. Fluxos manuais de pagamento e aparelho real/Safari continuam pendentes. Ver relatório específico.
