export type SearchablePagePlanAction = 'ocr' | 'skip-has-text' | 'skip-done'

export type SearchablePagePlanItem = {
  pdfPage: number
  action: SearchablePagePlanAction
}
