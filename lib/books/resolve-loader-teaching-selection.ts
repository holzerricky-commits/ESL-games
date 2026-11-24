export type LoaderTeachingTarget = { unitId: string; pdfPage: number }

/**
 * Unit and page the book loader should open.
 *
 * A locked resume (this visit’s place, or an explicit open page) stays on its own unit.
 * Otherwise a saved place replaces the class-strip chip, including the page — a page
 * from the chip must not be stored on the saved unit.
 */
export function resolveLoaderTeachingUnitAndPage(args: {
  preferredUnitId: string | null | undefined
  preferResumePage: number | null | undefined
  lockPreferredUnit: boolean
  openTarget: LoaderTeachingTarget | null
  pageForUnit: (unitId: string) => number | null
}): { unitId: string; resumePage: number | null } {
  const preferred = args.preferredUnitId?.trim() ?? ''
  const resume =
    typeof args.preferResumePage === 'number' &&
    Number.isFinite(args.preferResumePage) &&
    args.preferResumePage >= 1
      ? Math.floor(args.preferResumePage)
      : null

  if (args.lockPreferredUnit && preferred && resume != null) {
    return { unitId: preferred, resumePage: resume }
  }

  if (args.openTarget?.unitId) {
    const page =
      typeof args.openTarget.pdfPage === 'number' &&
      Number.isFinite(args.openTarget.pdfPage) &&
      args.openTarget.pdfPage >= 1
        ? Math.floor(args.openTarget.pdfPage)
        : 1
    return { unitId: args.openTarget.unitId, resumePage: page }
  }

  if (preferred) {
    const fromUnit = args.pageForUnit(preferred)
    const fromUnitPage =
      typeof fromUnit === 'number' && Number.isFinite(fromUnit) && fromUnit >= 1
        ? Math.floor(fromUnit)
        : null
    return { unitId: preferred, resumePage: resume ?? fromUnitPage }
  }

  return { unitId: '', resumePage: resume }
}
