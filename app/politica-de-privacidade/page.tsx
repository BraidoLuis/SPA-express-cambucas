import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "../components/public/legal-page-shell";

export const metadata: Metadata = {
  title: "Política de Privacidade | SPA Express Cambucás",
  description:
    "Saiba como o SPA Express Cambucás coleta, utiliza e protege seus dados pessoais.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="SEUS DADOS, NOSSO CUIDADO"
      title="Política de Privacidade"
      description="Esta política explica quais dados utilizamos, por que eles são necessários e quais direitos você possui."
      lastUpdated="22 de setembro de 2026"
    >
      <nav
        className="legal-index"
        aria-label="Índice da Política de Privacidade"
      >
        <strong>Nesta página</strong>

        <a href="#controlador">1. Controlador dos dados</a>
        <a href="#dados">2. Dados coletados</a>
        <a href="#finalidades">3. Como utilizamos os dados</a>
        <a href="#bases-legais">4. Bases legais</a>
        <a href="#menores">5. Dados de menores</a>
        <a href="#compartilhamento">6. Compartilhamento</a>
        <a href="#armazenamento">7. Armazenamento e segurança</a>
        <a href="#retencao">8. Retenção e exclusão</a>
        <a href="#direitos">9. Direitos do titular</a>
        <a href="#tecnologias">10. Tecnologias utilizadas</a>
        <a href="#alteracoes">11. Alterações</a>
      </nav>

      <section id="controlador">
        <h2>1. Quem controla os dados pessoais</h2>

        <p>
          O SPA Express Cambucás é responsável pelas decisões
          relacionadas ao tratamento dos dados pessoais utilizados
          no cadastro, nos agendamentos e no atendimento às
          clientes.
        </p>

        <p>
          A responsável pelo tratamento é Eliane Cristina Braido.
          Os dados de identificação e contato do estabelecimento
          estão disponíveis ao final desta página.
        </p>
      </section>

      <section id="dados">
        <h2>2. Dados pessoais coletados</h2>

        <p>
          Conforme a funcionalidade utilizada, poderemos tratar:
        </p>

        <ul>
          <li>Nome completo.</li>
          <li>Número de telefone e WhatsApp.</li>
          <li>Endereço de e-mail.</li>
          <li>
            Quando o acesso pelo Google for utilizado, nome,
            endereço de e-mail, identificador da conta e imagem de
            perfil, quando disponibilizada pelo provedor.
          </li>
          <li>
            Credenciais, identificadores e informações de sessão
            processadas pelo serviço de autenticação.
          </li>
          <li>
            Informações do agendamento, como serviço, profissional,
            data, horário, duração, preço e situação.
          </li>
          <li>
            Preferências de comunicação e registros de confirmações.
          </li>
          <li>
            Dados técnicos essenciais, como endereço IP, navegador,
            registros de acesso, falhas e informações necessárias à
            segurança.
          </li>
        </ul>

        <p>
          Quando o cadastro for realizado pelo Google, o número de
          telefone será solicitado no primeiro acesso para completar
          o perfil da cliente. O SPA Express Cambucás não recebe nem
          armazena a senha utilizada na conta Google.
        </p>

        <div className="legal-notice">
          <strong>Dados de saúde</strong>

          <p>
            O cadastro e o agendamento online não solicitam
            informações médicas, alergias, condições de saúde ou
            outros dados pessoais sensíveis relacionados à saúde.
          </p>
        </div>
      </section>

      <section id="finalidades">
        <h2>3. Como utilizamos os dados</h2>

        <p>Os dados poderão ser utilizados para:</p>

        <ul>
          <li>Criar e administrar a conta da cliente.</li>
          <li>Autenticar o acesso à plataforma.</li>
          <li>
            Permitir o acesso opcional por meio da conta Google e
            associar os dados fornecidos pelo provedor ao perfil da
            cliente.
          </li>
          <li>
            Solicitar e manter os dados necessários para completar o
            cadastro realizado por meio de um provedor externo.
          </li>
          <li>
            Consultar horários e criar, confirmar, alterar ou
            cancelar agendamentos.
          </li>
          <li>
            Permitir que profissionais consultem suas próprias
            agendas.
          </li>
          <li>
            Enviar confirmações, avisos e informações operacionais.
          </li>
          <li>Prestar suporte e responder solicitações.</li>
          <li>Prevenir fraudes, abusos e acessos indevidos.</li>
          <li>
            Cumprir obrigações legais, regulatórias ou determinações
            de autoridades competentes.
          </li>
          <li>
            Produzir informações administrativas e estatísticas
            internas relacionadas aos atendimentos.
          </li>
        </ul>

        <p>
          Os dados não serão utilizados para finalidades
          incompatíveis com aquelas informadas nesta política.
        </p>
      </section>

      <section id="bases-legais">
        <h2>4. Bases legais do tratamento</h2>

        <p>
          O tratamento poderá ocorrer conforme as hipóteses
          previstas na Lei Geral de Proteção de Dados, incluindo:
        </p>

        <ul>
          <li>
            Execução de contrato e procedimentos relacionados à
            prestação dos serviços solicitados.
          </li>
          <li>
            Cumprimento de obrigação legal ou regulatória.
          </li>
          <li>
            Exercício regular de direitos em processos judiciais,
            administrativos ou arbitrais.
          </li>
          <li>
            Legítimo interesse, após avaliação dos direitos e das
            expectativas da pessoa titular.
          </li>
          <li>
            Consentimento, quando essa for a base adequada e houver
            uma escolha livre e informada.
          </li>
        </ul>

        <p>
          Quando o tratamento depender de consentimento, ele poderá
          ser revogado pelos canais de contato, sem afetar os
          tratamentos realizados anteriormente de forma legítima.
        </p>
      </section>

      <section id="menores">
        <h2>5. Dados de crianças e adolescentes</h2>

        <p>
          Pessoas menores de 18 anos poderão receber atendimento,
          desde que o uso da plataforma ocorra por intermédio ou com
          a assistência de seus pais ou responsáveis legais.
        </p>

        <p>
          Para crianças menores de 12 anos, a conta e o agendamento
          deverão ser realizados diretamente pelo responsável legal,
          utilizando os dados de contato do responsável.
        </p>

        <p>
          O tratamento será limitado ao necessário para organizar e
          prestar o atendimento, considerando prioritariamente o
          melhor interesse da criança ou adolescente.
        </p>

        <p>
          Caso seja identificada uma conta de criança criada sem a
          participação do responsável, o SPA poderá suspender o
          acesso e solicitar a regularização ou exclusão dos dados.
        </p>
      </section>

      <section id="compartilhamento">
        <h2>6. Compartilhamento com fornecedores</h2>

        <p>
          Os dados poderão ser processados por fornecedores
          necessários ao funcionamento da plataforma, sempre
          limitados às atividades contratadas:
        </p>

        <ul>
          <li>
            <b>Supabase:</b> autenticação, gerenciamento de sessões,
            banco de dados e infraestrutura relacionada ao sistema.
          </li>
          <li>
            <b>Vercel:</b> hospedagem, disponibilização da aplicação
            e processamento de registros técnicos de acesso.
          </li>
          <li>
            <b>Google:</b> autenticação da identidade quando a
            própria pessoa escolhe utilizar a opção de acesso com
            Google.
          </li>
          <li>
            <b>Resend:</b> envio de e-mails operacionais e
            confirmações.
          </li>
          <li>
            <b>Google Maps:</b> exibição do mapa e da localização
            após a pessoa decidir carregar o conteúdo externo.
          </li>
          <li>
            <b>WhatsApp:</b> somente quando a própria pessoa decide
            abrir um link e iniciar uma conversa externa.
          </li>
        </ul>

        <p>
          Também poderá haver compartilhamento quando exigido por
          lei, determinação judicial ou autoridade competente.
        </p>

        <p>
          Alguns fornecedores podem processar dados fora do Brasil.
          Nesses casos, serão observados os requisitos aplicáveis à
          transferência internacional de dados.
        </p>

        <p>
          O SPA Express Cambucás não comercializa dados pessoais.
        </p>
      </section>

      <section id="armazenamento">
        <h2>7. Armazenamento e segurança</h2>

        <p>
          São adotadas medidas técnicas e administrativas razoáveis
          para proteger os dados contra acessos não autorizados,
          perda, alteração, divulgação ou destruição indevida.
        </p>

        <p>
          Entre as medidas utilizadas estão autenticação, controle
          de acesso por perfil, restrições no banco de dados,
          comunicação segura e limitação de acesso às informações.
        </p>

        <p>
          Nenhum sistema é completamente imune a incidentes. Caso
          ocorra um incidente relevante, serão adotadas as medidas
          necessárias e realizadas as comunicações exigidas pela
          legislação.
        </p>
      </section>

      <section id="retencao">
        <h2>8. Retenção e exclusão</h2>

        <p>
          Os dados serão mantidos pelo período necessário para
          cumprir as finalidades informadas, prestar os serviços,
          manter o histórico dos atendimentos e atender obrigações
          legais ou o exercício regular de direitos.
        </p>

        <p>
          Quando não forem mais necessários, os dados poderão ser
          excluídos ou anonimizados, salvo quando a conservação for
          permitida ou exigida pela legislação.
        </p>

        <p>
          A exclusão da conta poderá ser solicitada pelos canais de
          contato. Algumas informações poderão ser conservadas pelo
          prazo necessário ao cumprimento de obrigações legais e à
          proteção de direitos.
        </p>

        <p>
          A revogação da autorização concedida ao SPA Express
          Cambucás nas configurações da conta Google impede novas
          autorizações pelo provedor, mas não exclui automaticamente
          a conta ou os dados já mantidos pela plataforma. A exclusão
          deverá ser solicitada pelos canais de contato informados
          nesta política.
        </p>
      </section>

      <section id="direitos">
        <h2>9. Direitos da pessoa titular</h2>

        <p>
          Nos termos da LGPD, a pessoa titular poderá solicitar,
          conforme aplicável:
        </p>

        <ul>
          <li>Confirmação da existência de tratamento.</li>
          <li>Acesso aos dados pessoais.</li>
          <li>Correção de dados incompletos ou desatualizados.</li>
          <li>
            Anonimização, bloqueio ou eliminação de dados
            desnecessários ou tratados irregularmente.
          </li>
          <li>Informações sobre compartilhamento.</li>
          <li>Portabilidade, quando aplicável.</li>
          <li>Revogação do consentimento.</li>
          <li>
            Revisão ou oposição a determinados tratamentos, quando
            cabível.
          </li>
        </ul>

        <p>
          Para segurança, poderá ser necessário confirmar a
          identidade da pessoa solicitante antes do atendimento do
          pedido.
        </p>
      </section>

      <section id="tecnologias">
        <h2>10. Cookies e tecnologias locais</h2>

        <p>
          A plataforma utiliza cookies e tecnologias semelhantes
          estritamente necessários para autenticação, segurança,
          manutenção da sessão e funcionamento dos recursos de
          agendamento.
        </p>

        <p>Entre os recursos armazenados no navegador estão:</p>

        <ul>
          <li>
            Informações essenciais de autenticação e sessão
            administradas pelo Supabase.
          </li>
          <li>
            A preferência entre tema claro e escuro, armazenada por
            meio da chave <code>spa-theme</code>.
          </li>
          <li>
            O registro de que o aviso sobre cookies foi visualizado,
            armazenado por meio da chave{" "}
            <code>spaexpress-cookie-notice-v1</code>.
          </li>
        </ul>

        <p>
          Quando a pessoa escolhe entrar com Google, ela é
          direcionada ao serviço de autenticação do Google, que
          poderá utilizar cookies e outras tecnologias conforme suas
          próprias políticas.
        </p>

        <p>
          O conteúdo incorporado do Google Maps somente será
          carregado depois que a pessoa selecionar a opção
          “Carregar mapa”. Ao carregar esse conteúdo, o Google poderá
          processar endereço IP, informações do navegador e utilizar
          cookies ou tecnologias próprias.
        </p>

        <p>
          A escolha de carregar o mapa não é armazenada
          permanentemente pelo SPA Express Cambucás e poderá ser
          solicitada novamente em um novo acesso.
        </p>

        <p>
          Atualmente, o SPA Express Cambucás não utiliza Google
          Analytics, Meta Pixel, cookies de publicidade ou
          tecnologias destinadas à criação de perfis
          comportamentais.
        </p>

        <p>
          Caso tecnologias opcionais de análise ou publicidade sejam
          adicionadas futuramente, esta política e o aviso de cookies
          serão atualizados, e as escolhas necessárias serão
          apresentadas antes de sua ativação.
        </p>

        <p>
          A exclusão ou o bloqueio de recursos essenciais pelo
          navegador poderá afetar o login, a permanência da sessão e
          outras funcionalidades da plataforma.
        </p>

        <p>
          Mais informações sobre o tratamento realizado pelo Google
          estão disponíveis na{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Política de Privacidade do Google
          </a>
          .
        </p>
      </section>

      <section id="alteracoes">
        <h2>11. Alterações desta política</h2>

        <p>
          Esta Política de Privacidade poderá ser atualizada para
          acompanhar mudanças legais, operacionais ou tecnológicas.
        </p>

        <p>
          A versão vigente e a data da última atualização estarão
          sempre disponíveis nesta página.
        </p>

        <p>
          O uso da plataforma também está sujeito aos{" "}
          <Link href="/termos-de-uso">Termos de Uso</Link>.
        </p>
      </section>
    </LegalPageShell>
  );
}