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

