export type BMADStage = {
  id: string
  name: string
  role: string
  prompt: string
}

export type SOP = {
  id: string
  name: string
  description: string
  stages: BMADStage[]
}

export const SOPS: SOP[] = [
  {
    id: "bmad-full",
    name: "BMAD Full Pipeline",
    description: "Business Analyst → PM → Architect → Developer → QA → Code Review",
    stages: [
      { id: "ba", name: "Business Analysis", role: "Business Analyst", prompt: "Analyze the business requirements for this task. Define success criteria, stakeholders, and constraints." },
      { id: "pm", name: "Product Management", role: "Product Manager", prompt: "Define the product spec: user stories, acceptance criteria, scope boundaries, and priority." },
      { id: "arch", name: "Architecture", role: "Software Architect", prompt: "Design the technical architecture. Define components, interfaces, data models, and tradeoffs." },
      { id: "dev", name: "Development", role: "Senior Developer", prompt: "Implement the solution. Write clean, tested, production-ready code." },
      { id: "qa", name: "QA Review", role: "QA Engineer", prompt: "Review for bugs, edge cases, test coverage, and quality issues." },
      { id: "cr", name: "Code Review", role: "Tech Lead", prompt: "Review code for standards, security, performance, and maintainability." },
    ]
  },
  {
    id: "bmad-dev",
    name: "Dev + QA",
    description: "Developer → QA → Code Review",
    stages: [
      { id: "dev", name: "Development", role: "Senior Developer", prompt: "Implement the solution. Write clean, production-ready code." },
      { id: "qa", name: "QA Review", role: "QA Engineer", prompt: "Review for bugs, edge cases, test coverage." },
      { id: "cr", name: "Code Review", role: "Tech Lead", prompt: "Review for standards, security, maintainability." },
    ]
  },
  {
    id: "quick-think",
    name: "Quick Think",
    description: "PM → Architect only — plan without building",
    stages: [
      { id: "pm", name: "Product Management", role: "Product Manager", prompt: "Define the product spec: user stories, acceptance criteria, scope boundaries." },
      { id: "arch", name: "Architecture", role: "Software Architect", prompt: "Design the technical approach. Keep it concise and decision-focused." },
    ]
  }
]
