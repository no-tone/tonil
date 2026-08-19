/* CV content - the single source of truth for every surface that shows it.

   Lives here rather than in apps/web because it is no longer one app's data:
   the site renders it at /cv, the API server-renders it for
   crawlers, and apps/ssh-cv serves it over SSH. Anything that has to agree
   about what the CV says reads it from this module.

   Fully bilingual: every field is authored per language (pt is European
   Portuguese, pt-PT), so switching language re-renders in that language and
   not just the section headings. Tech names (React, CSP, Docker…) stay
   untranslated in both.

   Organisations are described by what they do rather than named. That is a
   deliberate editorial choice, not an oversight - see docs/architecture.md. */

/** The languages the CV is authored in. */
export type CvLang = "en" | "pt";

export interface Experience {
  role: string;
  org: string;
  period: string;
  place: string;
  bullets: string[];
}

export interface Education {
  title: string;
  period: string;
  bullets: string[];
}

/** A ranked "what I'm best at" row: a short key and its one-line expansion. */
export interface BestAt {
  k: string;
  v: string;
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export const EXPERIENCE: Record<CvLang, Experience[]> = {
  en: [
    {
      role: "Application Engineer",
      org: "digital solutions studio",
      period: "feb 2026 - now",
      place: "hybrid",
      bullets: [
        "Websites, online stores and applications with management-system integration, supporting businesses' digital transformation.",
      ],
    },
    {
      role: "Software Engineer",
      org: "public-sector AI project",
      period: "sep 2025 - jan 2026",
      place: "remote",
      bullets: [
        "Built a chatbot avatar and voice system: speech-to-text, response integration and realistic lip-sync for natural interactions between citizens and staff.",
        "Applied NLP, generative AI and data science to streamline administrative processes and digital governance.",
      ],
    },
    {
      role: "Software Engineering Intern",
      org: "cloud management provider",
      period: "aug 2024 - jul 2025",
      place: "hybrid",
      bullets: [
        "Built interactive onboarding sliders that cut onboarding time ~15% for a banking platform.",
        "Led a web component for managing document elements; shipped a new expression editor from usability testing.",
      ],
    },
  ],
  pt: [
    {
      role: "Engenheiro de Aplicações",
      org: "estúdio de soluções digitais",
      period: "fev 2026 - agora",
      place: "híbrido",
      bullets: [
        "Sites, lojas online e aplicações com integração de sistemas de gestão, apoiando a transformação digital das empresas.",
      ],
    },
    {
      role: "Engenheiro de Software",
      org: "projeto de IA no setor público",
      period: "set 2025 - jan 2026",
      place: "remoto",
      bullets: [
        "Construí um avatar de chatbot e sistema de voz: speech-to-text, integração de respostas e lip-sync realista para interações naturais entre cidadãos e funcionários.",
        "Apliquei PLN, IA generativa e ciência de dados para simplificar processos administrativos e a governação digital.",
      ],
    },
    {
      role: "Estagiário de Engenharia de Software",
      org: "fornecedor de gestão cloud",
      period: "ago 2024 - jul 2025",
      place: "híbrido",
      bullets: [
        "Construí sliders de onboarding interativos que reduziram o tempo de onboarding em ~15% numa plataforma bancária.",
        "Liderei um componente web para gerir elementos de documentos; lancei um novo editor de expressões a partir de testes de usabilidade.",
      ],
    },
  ],
};

export const EDUCATION: Record<CvLang, Education[]> = {
  en: [
    {
      title: "MSc, Software Engineering",
      period: "2025 - 2027 (exp.)",
      bullets: ["Software architecture, testing and engineering practice."],
    },
    {
      title: "BSc, Computer Science",
      period: "2022 - 2025",
      bullets: [
        "Algorithms, data structures, systems, databases and web foundations.",
      ],
    },
  ],
  pt: [
    {
      title: "Mestrado em Engenharia de Software",
      period: "2025 - 2027 (prev.)",
      bullets: ["Arquitetura de software, testes e prática de engenharia."],
    },
    {
      title: "Licenciatura em Ciência de Computadores",
      period: "2022 - 2025",
      bullets: [
        "Algoritmos, estruturas de dados, sistemas, bases de dados e fundamentos web.",
      ],
    },
  ],
};

export const BEST_AT: Record<CvLang, BestAt[]> = {
  en: [
    {
      k: "Full-stack product engineering",
      v: "Astro and Angular front-ends through to typed APIs and the databases behind them.",
    },
    {
      k: "Cross-platform apps",
      v: "Ionic daily, Tauri for desktop. One codebase, native where it matters.",
    },
    {
      k: "Web components & design systems",
      v: "Reusable, framework-agnostic UI primitives with real accessibility.",
    },
    {
      k: "Security & privacy",
      v: "CSP, edge middleware, dependency hygiene. Secure by default.",
    },
    {
      k: "Applied AI / NLP",
      v: "Chat, voice and generative features wired into real products.",
    },
  ],
  pt: [
    {
      k: "Engenharia de produto full-stack",
      v: "Front-ends em Astro e Angular até APIs tipadas e as bases de dados por trás.",
    },
    {
      k: "Aplicações multiplataforma",
      v: "Ionic no dia a dia, Tauri para desktop. Uma base de código, nativo onde é preciso.",
    },
    {
      k: "Web components e design systems",
      v: "Primitivas de UI reutilizáveis e agnósticas ao framework, com acessibilidade a sério.",
    },
    {
      k: "Segurança e privacidade",
      v: "CSP, middleware na edge, higiene de dependências. Seguro por defeito.",
    },
    {
      k: "IA aplicada / PLN",
      v: "Chat, voz e funcionalidades generativas integradas em produtos reais.",
    },
  ],
};

export const SKILLS: Record<CvLang, SkillGroup[]> = {
  en: [
    {
      label: "languages",
      items: [
        "TypeScript",
        "JavaScript",
        "Kotlin",
        "Python",
        "C#",
        "Rust",
        "Java",
      ],
    },
    {
      label: "frameworks",
      items: ["Astro", "Angular", "Ionic", "Next.js", "Svelte", "Tauri"],
    },
    {
      label: "data",
      items: ["SQL Server", "SQLite", "PostgreSQL", "Firebase"],
    },
    {
      label: "infra",
      items: ["Docker", "Cloudflare Workers"],
    },
  ],
  pt: [
    {
      label: "linguagens",
      items: [
        "TypeScript",
        "JavaScript",
        "Kotlin",
        "Python",
        "C#",
        "Rust",
        "Java",
      ],
    },
    {
      label: "frameworks",
      items: ["Astro", "Angular", "Ionic", "Next.js", "Svelte", "Tauri"],
    },
    {
      label: "dados",
      items: ["SQL Server", "SQLite", "PostgreSQL", "Firebase"],
    },
    {
      label: "infra",
      items: ["Docker", "Cloudflare Workers"],
    },
  ],
};

export const SPOKEN: Record<CvLang, string[]> = {
  en: ["Portuguese: native", "English: C1"],
  pt: ["Português: nativo", "Inglês: C1"],
};

export const INTERESTS: Record<CvLang, string[]> = {
  en: ["Weightlifting", "Nature walks", "Chess", "Formula 1", "Motorcycles"],
  pt: ["Musculação", "Caminhadas na natureza", "Xadrez", "Fórmula 1", "Motos"],
};
