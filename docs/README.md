# AGROLINK  
+ Arthur Henrique Araújo Santos - arthurhsantos2018@gmail.com
+ Leonardo Augusto Pereira do Carmo - leonardoaugustopcarmo@gmail.com
+ Lucas Jácome Magalhães de Jesus - lucas.jacome66@outlook.com
+ Miguel Lima Barcellos - miguel.limabarcellos@gmail.com
+ Pedro Barros Lemos - pedrobarroslemos813@gmail.com
+ Victor Ferreira de Almeida - victorferreiralmeida@gmail.com

**Professores:**  

+ Prof. Cleiton Silva Tavares  

+ Prof. Cristiano de Macêdo Neto  

+ Prof. João Paulo Carneiro Aramuni  

Curso de Engenharia de Software, Campus Lourdes  

Instituto de Informática e Ciências Exatas – Pontifícia Universidade de Minas Gerais (PUC MINAS), Belo Horizonte – MG – Brasil  

---

## Resumo  
O AGROLINK é um sistema inteligente de monitoramento e gestão rural voltado para produtores e gerentes de fazendas de médio e grande porte. O projeto propõe substituir a comunicação informal e desorganizada, comumente realizada por aplicativos de mensagens, por uma solução estruturada e orientada a dados. A aplicação centraliza informações operacionais, permite o registro de ocorrências com geolocalização e possibilita o acompanhamento de tarefas em tempo real. Como resultado, busca-se reduzir perdas, aumentar a eficiência operacional e melhorar a tomada de decisões no contexto agrícola.

---

## SUMÁRIO  

### Apresentação  

#### 1.1 Problema  
A gestão de atividades no meio rural, especialmente em propriedades de médio e grande porte, ainda depende fortemente de comunicação informal, como mensagens e ligações. Esse modelo dificulta a organização das informações, a rastreabilidade de ocorrências e o controle das tarefas executadas no campo. Como consequência, surgem atrasos na resolução de problemas, falhas de comunicação entre equipes e aumento de perdas operacionais.

#### 1.2 Objetivos do trabalho  
O objetivo do AGROLINK é desenvolver uma plataforma que centralize a comunicação e o controle operacional no campo, proporcionando maior organização e eficiência. Entre os principais objetivos, destacam-se:  
- Permitir o registro de ocorrências com localização precisa  
- Centralizar a comunicação entre equipes e gestores  
- Possibilitar o acompanhamento de tarefas em tempo real  
- Criar um histórico estruturado de atividades e problemas  
- Apoiar a tomada de decisão baseada em dados  

#### 1.3 Definições e Abreviaturas  
- **SaaS (Software as a Service):** Modelo de software baseado em assinatura  
- **GPS (Global Positioning System):** Sistema de localização geográfica  
- **ERP (Enterprise Resource Planning):** Sistema integrado de gestão empresarial  

---

## Nosso Produto  

#### 2.1 Visão do Produto  
O AGROLINK é uma solução digital que visa transformar a forma como a gestão operacional rural é realizada. A plataforma conecta produtores, gerentes e trabalhadores de campo em um único ambiente, permitindo maior visibilidade das atividades, melhor comunicação e resposta mais rápida a problemas. A proposta é sair de um modelo reativo e desorganizado para uma abordagem estratégica baseada em dados.

#### 2.2 Nosso Produto  
O sistema permitirá:  
- Registro de ocorrências no campo com geolocalização  
- Centralização da comunicação entre usuários  
- Acompanhamento de tarefas em tempo real  
- Armazenamento de histórico estruturado de atividades  

O AGROLINK não se propõe a ser um sistema ERP completo ou uma solução financeira, mas sim uma ferramenta especializada na gestão operacional e comunicação no campo.

#### 2.3 Personas  

**Produtor Rural (Gestor)**  
Responsável pela administração da fazenda e pela tomada de decisões. Necessita de informações rápidas, confiáveis e organizadas para agir com eficiência.

**Gerente Operacional**  
Atua como intermediário entre o produtor e a equipe de campo, coordenando tarefas e garantindo que as atividades sejam executadas corretamente.

**Trabalhador de Campo**  
Responsável pela execução das tarefas operacionais. Precisa de uma ferramenta simples, prática e acessível para registrar ocorrências e acompanhar suas atividades.

3. [Requisitos](3.requisitos.md#requisitos "Requisitos") <br />
	3.1. Requisitos Funcionais <br />
	3.2. Requisitos Não-Funcionais <br />
	3.3. Restrições Arquiteturais <br />
	3.4. Mecanismos Arquiteturais <br />

4. [Modelagem](4.modelagem.md#modelagem "Modelagem e projeto arquitetural") <br />
	4.1. Visão de Negócio <br />
	4.2. Visão Lógica <br />
	4.3. Modelo de dados (opcional) <br />

5. [Wireframes](5.wireframe.md#wireframes "Wireframes") <br />

6. [Solução](6.solucao.md#solucao "Projeto da Solução") <br />

7. [Avaliação](7.avaliacao.md#avaliacao "Avaliação da Arquitetura") <br />
	7.1. Cenários <br />
	7.2. Avaliação <br />

[Ferramentas](#ferramentas "Ferramentas")<br />

<a name="ferramentas"></a>
# Ferramentas

_Inclua o URL do repositório (Github, Bitbucket, etc) onde você armazenou o código da sua prova de conceito/protótipo arquitetural da aplicação como anexos. A inclusão da URL desse repositório de código servirá como base para garantir a autenticidade dos trabalhos._

| Ambiente  | Plataforma              |Link de Acesso |
|-----------|-------------------------|---------------|
|Repositório de código | GitHub | https://github.com/ICEI-PUC-Minas-PPLES-TI/plf-es-2026-1-ti5-0492100-agrolink — monorepo em [`code/`](../code/README.md) (back · [front](../code/front/README.md) · [mobile](../code/mobile/README.md)) | 
|Hospedagem / demo ao vivo | ngrok | https://zoom-gallstone-bootleg.ngrok-free.dev — `npm run dev` + `npm run demo:tunnel` em `code/front/agrolink`. Ver [`code/README.md`](../code/README.md#demonstração-pública-apresentação). |
|Protótipo Interativo | Figma / wireframes | [`5.wireframe.md`](5.wireframe.md) |

### Credenciais de demonstração

| Papel | E-mail | Senha |
|--------|--------|--------|
| Gerente (web) | `gerente1@agrolink.demo` | `AgrolinkDemo1!` |
| Funcionário de campo (mobile) | `campo1@agrolink.demo` | `AgrolinkDemo1!` |
| Produtor | `produtor@agrolink.demo` | `AgrolinkDemo1!` |

Contas criadas automaticamente com perfil Spring `dev` (`agrolink.demo-seed=true`). Fazenda demo: **Parque das Mangabeiras**.
