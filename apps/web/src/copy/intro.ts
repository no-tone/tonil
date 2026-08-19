/* The prose on the home page.

   Here rather than inline in the page because it is bilingual, and a template
   with two copies of every paragraph interleaved is unreadable. Not in
   @repo/content either: that package holds what more than one surface needs
   (the CV, the app registry, the site summaries) and this is one page's copy.

   Written in the first person and kept to facts. Anything that described a
   mood rather than a job has been cut. */

export interface Paragraph {
  en: string;
  pt: string;
}

export const INTRO: Paragraph[] = [
  {
    en: "I'm a software engineer. I build web applications end to end - the front-end, the API behind it, and the infrastructure it runs on.",
    pt: "Sou engenheiro de software. Construo aplicações web de ponta a ponta - o front-end, a API por trás e a infraestrutura onde corre.",
  },
  {
    en: "I currently work at a digital solutions studio on websites, online stores and applications that integrate with clients' management systems. Before that I spent five months on a public-sector AI project, building a chatbot avatar with speech-to-text and lip-sync, and a year at a cloud management provider, working on onboarding flows for a banking platform and a new expression editor.",
    pt: "Trabalho atualmente num estúdio de soluções digitais, em sites, lojas online e aplicações integradas com os sistemas de gestão dos clientes. Antes disso passei cinco meses num projeto de IA no setor público, onde construí um avatar de chatbot com speech-to-text e sincronização labial, e um ano num fornecedor de gestão cloud, em fluxos de onboarding para uma plataforma bancária e num novo editor de expressões.",
  },
  {
    en: "I'm finishing an MSc in Software Engineering. Portuguese is my first language; I work in English.",
    pt: "Estou a terminar um mestrado em Engenharia de Software. O português é a minha primeira língua; trabalho em inglês.",
  },
  {
    en: "Most of my time goes to the parts that don't demo well - content security policies, edge middleware, dependency hygiene, and keeping a codebase small enough that changing it stays cheap.",
    pt: "A maior parte do meu tempo vai para as partes que não se demonstram bem - content security policies, middleware na edge, higiene de dependências, e manter uma base de código pequena o suficiente para que mudá-la continue barato.",
  },
];
