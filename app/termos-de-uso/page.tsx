import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "../components/public/legal-page-shell";

export const metadata: Metadata = {
  title: "Termos de Uso | SPA Express Cambucás",
  description:
    "Conheça as condições de uso, cadastro e agendamento do SPA Express Cambucás.",
};

export default function TermsOfUsePage() {
  return (
    <LegalPageShell
      eyebrow="TRANSPARÊNCIA E CONFIANÇA"
      title="Termos de Uso"
      description="Estes termos apresentam as regras para utilização do site, criação de conta e realização de agendamentos."
      lastUpdated="29 de agosto de 2026"
    >
      <nav className="legal-index" aria-label="Índice dos Termos de Uso">
        <strong>Nesta página</strong>

        <a href="#aceitacao">1. Aceitação dos termos</a>
        <a href="#servicos">2. Serviços da plataforma</a>
        <a href="#cadastro">3. Cadastro e conta</a>
        <a href="#menores">4. Atendimento de menores</a>
        <a href="#agendamentos">5. Agendamentos</a>
        <a href="#cancelamentos">6. Cancelamentos</a>
        <a href="#responsabilidades">7. Responsabilidades</a>
        <a href="#comunicacoes">8. Comunicações</a>
        <a href="#privacidade">9. Privacidade</a>
        <a href="#alteracoes">10. Alterações</a>
      </nav>

      <section id="aceitacao">
        <h2>1. Aceitação dos termos</h2>

        <p>
          Estes Termos de Uso regulam o acesso e a utilização do
          site e do sistema de agendamentos do SPA Express Cambucás.
        </p>

        <p>
          Ao criar uma conta, realizar um agendamento ou utilizar as
          funcionalidades da plataforma, a pessoa usuária declara
          que leu e concorda com estes termos e que está ciente da{" "}
          <Link href="/politica-de-privacidade">
            Política de Privacidade
          </Link>
          .
        </p>

        <p>
          Caso não concorde com alguma condição, a pessoa usuária
          não deverá concluir o cadastro ou utilizar a plataforma.
        </p>
      </section>

      <section id="servicos">
        <h2>2. Serviços da plataforma</h2>

        <p>
          A plataforma permite consultar serviços, profissionais,
          preços, durações aproximadas e horários disponíveis, além
          de criar e acompanhar agendamentos.
        </p>

        <p>
          As informações exibidas podem ser atualizadas conforme a
          disponibilidade das profissionais, alterações no catálogo
          ou necessidades operacionais do estabelecimento.
        </p>

        <p>
          O uso do site não garante a disponibilidade permanente de
          determinado serviço, profissional, data ou horário.
        </p>
      </section>

      <section id="cadastro">
        <h2>3. Cadastro e conta da cliente</h2>

        <p>
          Para utilizar determinadas funcionalidades, será
          necessário informar dados verdadeiros, completos e
          atualizados, como nome, telefone, e-mail e senha.
        </p>

        <p>
          A pessoa usuária é responsável por manter sua senha
          confidencial e por não compartilhar o acesso à conta com
          terceiros não autorizados.
        </p>

        <p>
          Caso identifique acesso indevido, perda da senha ou
          atividade suspeita, deverá entrar em contato com o SPA
          Express Cambucás assim que possível.
        </p>

        <p>
          Contas criadas com informações falsas, utilizadas de forma
          fraudulenta ou contrária a estes termos poderão ser
          suspensas ou encerradas.
        </p>
      </section>

      <section id="menores">
        <h2>4. Atendimento de menores de 18 anos</h2>

        <p>
          Pessoas menores de 18 anos poderão receber atendimento,
          desde que haja participação e autorização de seus pais ou
          responsáveis legais.
        </p>

        <p>
          A conta e o agendamento deverão ser criados ou
          acompanhados pelo responsável legal, utilizando dados de
          contato que permitam sua identificação e comunicação.
        </p>

        <p>
          Para crianças menores de 12 anos, a conta e o agendamento
          deverão ser realizados diretamente por pelo menos um dos
          pais ou pelo responsável legal.
        </p>

        <p>
          O responsável declara possuir autoridade para autorizar o
          atendimento e fornecer os dados necessários ao
          agendamento, sempre considerando o melhor interesse da
          criança ou adolescente.
        </p>

        <p>
          O SPA Express Cambucás poderá solicitar a presença ou a
          confirmação do responsável antes da realização do
          atendimento.
        </p>
      </section>

      <section id="agendamentos">
        <h2>5. Agendamentos e disponibilidade</h2>

        <p>
          Os horários apresentados dependem da agenda e da
          disponibilidade cadastrada por cada profissional.
        </p>

        <p>
          O agendamento somente será considerado concluído após a
          confirmação exibida pelo sistema. A cliente deverá
          conferir serviço, profissional, data e horário antes de
          finalizar.
        </p>

        <p>
          Durações são estimativas e podem variar conforme as
          características do serviço e do atendimento.
        </p>

        <p>
          Em situações excepcionais, o SPA poderá entrar em contato
          para propor alteração de horário, profissional ou data.
        </p>
      </section>

      <section id="cancelamentos">
        <h2>6. Cancelamentos e reagendamentos</h2>

        <p>
          Caso não possa comparecer, a cliente deverá cancelar ou
          solicitar alteração com a maior antecedência possível,
          permitindo que o horário seja disponibilizado novamente.
        </p>

        <p>
          O cancelamento realizado pelo sistema libera o horário,
          mas um novo agendamento dependerá da disponibilidade
          existente no momento da nova solicitação.
        </p>

        <p>
          O SPA poderá cancelar ou reagendar atendimentos em razão
          de indisponibilidade profissional, emergência, falha
          operacional ou caso fortuito, comunicando a cliente pelos
          meios disponíveis.
        </p>
      </section>

      <section id="responsabilidades">
        <h2>7. Responsabilidades e uso adequado</h2>

        <p>A pessoa usuária compromete-se a:</p>

        <ul>
          <li>Fornecer informações verdadeiras e atualizadas.</li>
          <li>Utilizar a plataforma somente para fins legítimos.</li>
          <li>Não tentar acessar contas ou áreas restritas.</li>
          <li>
            Não interferir no funcionamento, segurança ou
            disponibilidade do sistema.
          </li>
          <li>
            Não realizar agendamentos falsos, abusivos ou sem
            intenção de comparecimento.
          </li>
        </ul>

        <p>
          O SPA adota medidas razoáveis para manter o sistema
          disponível e seguro, mas não garante funcionamento
          ininterrupto, especialmente em situações de manutenção,
          falhas de terceiros ou eventos fora de seu controle.
        </p>
      </section>

      <section id="comunicacoes">
        <h2>8. Comunicações</h2>

        <p>
          A plataforma poderá enviar mensagens operacionais
          relacionadas à conta e aos agendamentos, como confirmações,
          alterações, cancelamentos e lembretes.
        </p>

        <p>
          Links para WhatsApp apenas direcionam a pessoa usuária para
          uma conversa externa. O envio da mensagem ocorre somente
          após uma ação realizada pela própria pessoa no WhatsApp.
        </p>

        <p>
          Comunicações promocionais, quando existentes, deverão ser
          tratadas separadamente e poderão ser recusadas.
        </p>
      </section>

      <section id="privacidade">
        <h2>9. Privacidade e proteção de dados</h2>

        <p>
          O tratamento de dados pessoais segue a legislação
          aplicável e está detalhado na{" "}
          <Link href="/politica-de-privacidade">
            Política de Privacidade
          </Link>
          .
        </p>

        <p>
          A plataforma não solicita informações médicas, condições
          de saúde, alergias ou outros dados de saúde durante o
          cadastro e o agendamento online.
        </p>
      </section>

      <section id="alteracoes">
        <h2>10. Alterações destes termos</h2>

        <p>
          Estes Termos de Uso poderão ser atualizados para refletir
          alterações legais, operacionais ou nas funcionalidades do
          sistema.
        </p>

        <p>
          A versão vigente e a data da última atualização estarão
          disponíveis nesta página. Alterações relevantes poderão
          ser comunicadas pelos canais cadastrados.
        </p>

        <p>
          Estes termos são regidos pelas leis da República
          Federativa do Brasil.
        </p>
      </section>
    </LegalPageShell>
  );
}